import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  collectDroppedFiles,
  isFileDrag,
  snapshotDrop,
  uploadDroppedFiles,
  type ExistingFolder,
  type UploadProgress,
  type UploadResult,
} from "@/lib/file-drop";

// Matches the server's asset upload limit
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type DropHandler = (dataTransfer: DataTransfer, folderId: number | null, label: string) => void;

const AssetDropContext = createContext<DropHandler | null>(null);

// A folder row inside the file panel receives the same drag events as the panel;
// the innermost target claims each event so only it highlights and uploads.
const claimedEvents = new WeakSet<Event>();

/** Makes an element accept files/folders dragged from the computer, uploading into `folderId`. */
export function useFileDropTarget(folderId: number | null, label: string) {
  const onDropFiles = useContext(AssetDropContext);
  const [isFileOver, setIsFileOver] = useState(false);
  const clearTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  if (!onDropFiles) return { isFileOver: false, dropProps: {} };

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (isFileDrag(e.dataTransfer)) e.preventDefault();
    },
    onDragOver: (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      const isMine = !claimedEvents.has(e.nativeEvent);
      claimedEvents.add(e.nativeEvent);
      if (isMine) e.dataTransfer.dropEffect = "copy";
      setIsFileOver(isMine);
      // dragover repeats while the pointer is inside; when it stops, the pointer left
      window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setIsFileOver(false), 150);
    },
    onDrop: (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      // Don't stop propagation: react-dnd needs the drop to finish its own drag state
      e.preventDefault();
      window.clearTimeout(clearTimer.current);
      setIsFileOver(false);
      if (claimedEvents.has(e.nativeEvent)) return;
      claimedEvents.add(e.nativeEvent);
      onDropFiles(e.dataTransfer, folderId, label);
    },
  };
  return { isFileOver, dropProps };
}

/** A panel that uploads dropped files/folders into `folderId`, with a drop overlay. */
export function FileDropArea({
  folderId,
  label,
  className,
  children,
}: {
  folderId: number | null;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { isFileOver, dropProps } = useFileDropTarget(folderId, label);
  return (
    <div {...dropProps} className={cn("relative", className)}>
      {children}
      {isFileOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10">
          <div className="flex items-center gap-2 rounded-md bg-background/95 px-4 py-2 text-sm font-medium shadow">
            <Upload className="h-4 w-4 text-blue-500" />
            Drop to upload to "{label}"
          </div>
        </div>
      )}
    </div>
  );
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error || body?.message || `${response.status} ${response.statusText}`);
}

async function createFolder(name: string, parentId: number | null): Promise<number> {
  const response = await fetch("/api/assets/folders", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    // The server derives the real path from the parent
    body: JSON.stringify({ name, parentId, path: "/" }),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()).id;
}

async function uploadFile(file: File, name: string, folderId: number | null): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  if (folderId !== null) formData.append("folderId", String(folderId));
  const response = await fetch("/api/assets/files", { method: "POST", credentials: "include", body: formData });
  if (!response.ok) throw await responseError(response);
}

interface UploadJob {
  label: string;
  progress: UploadProgress;
  result?: UploadResult;
}

/** Provides drop-to-upload for everything inside it and shows upload progress. */
export function AssetDropUploadProvider({ folders, children }: { folders: ExistingFolder[]; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [job, setJob] = useState<UploadJob | null>(null);
  const isUploading = useRef(false);
  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  const onDropFiles = useCallback<DropHandler>(
    (dataTransfer, folderId, label) => {
      // Has to happen synchronously, while the drop event still owns the data
      const snapshot = snapshotDrop(dataTransfer);
      if (isUploading.current) {
        toast({ title: "Upload in progress", description: "Please wait for the current upload to finish." });
        return;
      }
      isUploading.current = true;

      (async () => {
        try {
          const items = await collectDroppedFiles(snapshot);
          if (items.length === 0) {
            toast({ title: "Nothing to upload", description: "The dropped items didn't contain any files." });
            return;
          }
          setJob({ label, progress: { total: items.length, done: 0, failed: 0 } });
          const result = await uploadDroppedFiles(items, {
            targetFolderId: folderId,
            existingFolders: foldersRef.current,
            maxFileSize: MAX_FILE_SIZE,
            createFolder,
            uploadFile,
            onProgress: (progress) => setJob((current) => current && { ...current, progress }),
          });
          setJob((current) => current && { ...current, result });
        } catch (error) {
          console.error("Drag-and-drop upload failed:", error);
          setJob(null);
          toast({
            title: "Upload failed",
            description: error instanceof Error ? error.message : "Could not read the dropped items.",
            variant: "destructive",
          });
        } finally {
          isUploading.current = false;
          queryClient.invalidateQueries({ queryKey: ["/api/assets/folders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/assets/files"] });
        }
      })();
    },
    [queryClient, toast],
  );

  // Clean runs dismiss themselves; runs with failures stay until closed
  useEffect(() => {
    if (!job?.result || job.result.failures.length > 0) return;
    const timer = window.setTimeout(() => setJob(null), 5000);
    return () => window.clearTimeout(timer);
  }, [job?.result]);

  return (
    <AssetDropContext.Provider value={onDropFiles}>
      {children}
      {job && <UploadProgressPanel job={job} onClose={() => setJob(null)} />}
    </AssetDropContext.Provider>
  );
}

function UploadProgressPanel({ job, onClose }: { job: UploadJob; onClose: () => void }) {
  const { progress, result, label } = job;
  const failures = result?.failures ?? [];
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg" role="status">
      <div className="mb-2 flex items-start gap-2">
        {!result ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-500" />
        ) : failures.length ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {!result
              ? `Uploading to "${label}"`
              : failures.length
                ? `Uploaded ${result.uploaded} of ${progress.total} files`
                : `Uploaded ${result.uploaded} ${result.uploaded === 1 ? "file" : "files"} to "${label}"`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {!result
              ? `${progress.done} of ${progress.total}${progress.current ? ` · ${progress.current}` : ""}`
              : result.foldersCreated
                ? `${result.foldersCreated} ${result.foldersCreated === 1 ? "folder" : "folders"} created`
                : "Done"}
          </p>
        </div>
        {result && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {!result && <Progress value={percent} className="h-1.5" />}
      {failures.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs">
          {failures.map((failure) => (
            <li key={failure.path} className="text-destructive">
              <span className="font-medium">{failure.path}</span>: {failure.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
