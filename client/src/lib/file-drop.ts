/**
 * Helpers for uploading files and folders dropped from the user's computer.
 * Kept free of React so the traversal and upload planning can be unit tested.
 */

/** A dropped file plus the folders it sits in, relative to the drop (e.g. ["Brand", "Logos"]). */
export interface DroppedFile {
  file: File;
  dirs: string[];
}

export interface ExistingFolder {
  id: number;
  name: string;
  parentId: number | null;
}

export interface UploadProgress {
  total: number;
  done: number;
  failed: number;
  current?: string;
}

export interface UploadResult {
  uploaded: number;
  foldersCreated: number;
  failures: { path: string; error: string }[];
}

// Minimal shapes of the (non-standard but universally supported) File System Entry API
interface EntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}
interface FileEntryLike extends EntryLike {
  file(success: (file: File) => void, error?: (err: unknown) => void): void;
}
interface DirectoryEntryLike extends EntryLike {
  createReader(): {
    readEntries(success: (entries: EntryLike[]) => void, error?: (err: unknown) => void): void;
  };
}

const IGNORED_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

/** OS metadata and hidden files that nobody means to upload. */
export function isIgnoredName(name: string): boolean {
  return name.startsWith(".") || name.startsWith("~$") || IGNORED_NAMES.has(name.toLowerCase());
}

/** True when a drag carries files from the OS (as opposed to an in-page drag). */
export function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types).includes("Files");
}

/** "report.final.pdf" -> "report.final" */
export function displayNameFor(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * Captures the dropped entries. Must run synchronously inside the drop event:
 * the DataTransfer is emptied as soon as the event handler returns.
 */
export function snapshotDrop(dataTransfer: DataTransfer): { entries: EntryLike[]; files: File[] } {
  const entries: EntryLike[] = [];
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = (item as any).webkitGetAsEntry?.() as EntryLike | null;
    if (entry) entries.push(entry);
  }
  // Browsers without entry support only give flat files (no folders)
  return { entries, files: entries.length ? [] : Array.from(dataTransfer.files ?? []) };
}

function readFile(entry: FileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readDirectory(entry: DirectoryEntryLike): Promise<EntryLike[]> {
  const reader = entry.createReader();
  const all: EntryLike[] = [];
  // readEntries returns batches (about 100 at a time) until it returns an empty one
  for (;;) {
    const batch = await new Promise<EntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

/** Walks dropped entries (recursing into folders) into a flat list of files. */
export async function collectDroppedFiles(snapshot: { entries: EntryLike[]; files: File[] }): Promise<DroppedFile[]> {
  const result: DroppedFile[] = snapshot.files
    .filter((file) => !isIgnoredName(file.name))
    .map((file) => ({ file, dirs: [] }));

  const walk = async (entry: EntryLike, dirs: string[]) => {
    if (isIgnoredName(entry.name)) return;
    if (entry.isFile) {
      result.push({ file: await readFile(entry as FileEntryLike), dirs });
    } else if (entry.isDirectory) {
      const children = await readDirectory(entry as DirectoryEntryLike);
      const childDirs = [...dirs, entry.name];
      for (const child of children) await walk(child, childDirs);
    }
  };
  for (const entry of snapshot.entries) await walk(entry, []);
  return result;
}

interface UploadOptions {
  targetFolderId: number | null;
  existingFolders: ExistingFolder[];
  createFolder: (name: string, parentId: number | null) => Promise<number>;
  uploadFile: (file: File, name: string, folderId: number | null) => Promise<void>;
  onProgress?: (progress: UploadProgress) => void;
  maxFileSize?: number;
  concurrency?: number;
}

/**
 * Recreates the dropped folder structure under the target folder (reusing folders
 * that already exist with the same name) and uploads every file into place.
 */
export async function uploadDroppedFiles(items: DroppedFile[], options: UploadOptions): Promise<UploadResult> {
  const { targetFolderId, existingFolders, createFolder, uploadFile, onProgress } = options;
  const maxFileSize = options.maxFileSize ?? Infinity;
  const concurrency = options.concurrency ?? 3;

  const result: UploadResult = { uploaded: 0, foldersCreated: 0, failures: [] };
  const progress: UploadProgress = { total: items.length, done: 0, failed: 0 };
  onProgress?.({ ...progress });

  // Resolve each distinct folder path to a folder id, parents before children
  const folderIds = new Map<string, number | null>([["", targetFolderId]]);
  const folderErrors = new Map<string, string>();
  const known = [...existingFolders];
  const paths = Array.from(new Set(items.flatMap(({ dirs }) => dirs.map((_, i) => dirs.slice(0, i + 1).join("/")))))
    .sort((a, b) => a.split("/").length - b.split("/").length);

  for (const path of paths) {
    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const parentError = folderErrors.get(parentPath);
    if (parentError) {
      folderErrors.set(path, parentError);
      continue;
    }
    const parentId = folderIds.get(parentPath) ?? null;
    const existing = known.find(
      (folder) => folder.parentId === parentId && folder.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      folderIds.set(path, existing.id);
      continue;
    }
    try {
      const id = await createFolder(name, parentId);
      known.push({ id, name, parentId });
      folderIds.set(path, id);
      result.foldersCreated++;
    } catch (error) {
      folderErrors.set(path, `Could not create folder "${name}": ${errorMessage(error)}`);
    }
  }

  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const { file, dirs } = items[next++];
      const dirPath = dirs.join("/");
      const displayPath = dirPath ? `${dirPath}/${file.name}` : file.name;
      progress.current = displayPath;
      onProgress?.({ ...progress });

      let error = folderErrors.get(dirPath);
      if (!error && file.size > maxFileSize) {
        error = `Larger than ${Math.round(maxFileSize / 1024 / 1024)} MB`;
      }
      if (!error) {
        try {
          await uploadFile(file, displayNameFor(file.name), folderIds.get(dirPath) ?? null);
          result.uploaded++;
        } catch (err) {
          error = errorMessage(err);
        }
      }
      if (error) {
        result.failures.push({ path: displayPath, error });
        progress.failed++;
      }
      progress.done++;
      onProgress?.({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

  progress.current = undefined;
  onProgress?.({ ...progress });
  return result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
