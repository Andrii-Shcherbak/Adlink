import assert from "node:assert/strict";
import test from "node:test";
import { collectDroppedFiles, displayNameFor, uploadDroppedFiles, type DroppedFile } from "./file-drop";

// Fake File System Entry API tree: objects are folders, strings are file contents
type Tree = { [name: string]: Tree | string };

function entryFor(name: string, node: Tree | string, batchSize = 2): any {
  if (typeof node === "string") {
    return { name, isFile: true, isDirectory: false, file: (ok: (f: File) => void) => ok(new File([node], name)) };
  }
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader() {
      const children = Object.entries(node).map(([childName, child]) => entryFor(childName, child, batchSize));
      let offset = 0;
      // Hand out entries in small batches, like browsers do
      return {
        readEntries(ok: (entries: any[]) => void) {
          ok(children.slice(offset, (offset += batchSize)));
        },
      };
    },
  };
}

const paths = (items: DroppedFile[]) => items.map(({ file, dirs }) => [...dirs, file.name].join("/")).sort();

test("collects nested folders across batched directory reads and skips OS junk", async () => {
  const items = await collectDroppedFiles({
    entries: [
      entryFor("Brand", {
        "logo.png": "png",
        ".DS_Store": "junk",
        Guides: { "a.pdf": "a", "b.pdf": "b", "c.pdf": "c", "Thumbs.db": "junk" },
        Empty: {},
      }),
      entryFor("notes.txt", "hello"),
    ],
    files: [],
  });

  assert.deepEqual(paths(items), [
    "Brand/Guides/a.pdf",
    "Brand/Guides/b.pdf",
    "Brand/Guides/c.pdf",
    "Brand/logo.png",
    "notes.txt",
  ]);
});

test("falls back to flat files when folder entries aren't available", async () => {
  const items = await collectDroppedFiles({ entries: [], files: [new File(["x"], "a.txt"), new File(["y"], ".hidden")] });
  assert.deepEqual(paths(items), ["a.txt"]);
});

test("displayNameFor strips only the last extension", () => {
  assert.equal(displayNameFor("report.final.pdf"), "report.final");
  assert.equal(displayNameFor("README"), "README");
  assert.equal(displayNameFor(".env"), ".env");
});

test("recreates folders under the target, reusing existing ones", async () => {
  const created: string[] = [];
  const uploads: string[] = [];
  let nextId = 100;

  const result = await uploadDroppedFiles(
    [
      { file: new File(["1"], "logo.png"), dirs: ["Brand"] },
      { file: new File(["2"], "a.pdf"), dirs: ["Brand", "Guides"] },
      { file: new File(["3"], "b.pdf"), dirs: ["Brand", "Guides"] },
      { file: new File(["4"], "top.txt"), dirs: [] },
    ],
    {
      targetFolderId: 7,
      // "brand" already exists inside folder 7 (matched case-insensitively)
      existingFolders: [{ id: 42, name: "brand", parentId: 7 }],
      createFolder: async (name, parentId) => {
        created.push(`${name}@${parentId}`);
        return nextId++;
      },
      uploadFile: async (file, name, folderId) => {
        uploads.push(`${name}->${folderId}`);
      },
    },
  );

  assert.deepEqual(created, ["Guides@42"]);
  assert.deepEqual(uploads.sort(), ["a->100", "b->100", "logo->42", "top->7"]);
  assert.deepEqual(result, { uploaded: 4, foldersCreated: 1, failures: [] });
});

test("reports per-file failures without stopping the rest", async () => {
  const progress: number[] = [];
  const result = await uploadDroppedFiles(
    [
      { file: new File(["ok"], "ok.txt"), dirs: [] },
      { file: new File(["too big!"], "big.bin"), dirs: [] },
      { file: new File(["x"], "fails.txt"), dirs: [] },
      { file: new File(["y"], "orphan.txt"), dirs: ["Broken", "Deeper"] },
    ],
    {
      targetFolderId: null,
      existingFolders: [],
      maxFileSize: 4,
      createFolder: async () => {
        throw new Error("403");
      },
      uploadFile: async (file) => {
        if (file.name === "fails.txt") throw new Error("Server said no");
      },
      onProgress: (p) => progress.push(p.done),
    },
  );

  assert.equal(result.uploaded, 1);
  assert.deepEqual(
    result.failures.map((f) => `${f.path}: ${f.error}`).sort(),
    [
      'Broken/Deeper/orphan.txt: Could not create folder "Broken": 403',
      "big.bin: Larger than 0 MB",
      "fails.txt: Server said no",
    ],
  );
  assert.equal(progress[progress.length - 1], 4);
});
