/**
 * Builds the app for Vercel using the Build Output API (.vercel/output):
 *   static/                 built client, served by Vercel's CDN
 *   functions/index.func/   the Express app as one Node.js function
 *
 * Vercel runs this via the `vercel-build` npm script.
 */
import { build } from "esbuild";
import { nodeFileTrace } from "@vercel/nft";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, ".vercel", "output");
const funcDir = path.join(output, "functions", "index.func");
const serverBundle = "dist/vercel/index.mjs";

await fs.rm(output, { recursive: true, force: true });

// 1. Client
execSync("npx vite build", { stdio: "inherit" });
await fs.cp(path.join(root, "dist", "public"), path.join(output, "static"), { recursive: true });

// 2. Server bundle (esbuild resolves the @shared path alias; npm packages stay external)
await build({
  entryPoints: ["server/vercel.ts"],
  outfile: serverBundle,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  logLevel: "info",
});

// 3. Copy the bundle plus every file it needs at runtime into the function
const { fileList, warnings } = await nodeFileTrace([serverBundle], {
  base: root,
  // Dev-only or replaced on Vercel (geo lookups use Vercel's location headers)
  ignore: ["node_modules/geoip-lite/**", "node_modules/vite/**", "node_modules/@replit/**"],
});
for (const warning of warnings) {
  if (!String(warning.message).includes("Failed to resolve dependency")) continue;
  console.warn("trace warning:", warning.message);
}

let fileCount = 0;
for (const file of fileList) {
  const source = path.join(root, file);
  const stat = await fs.lstat(source);
  if (stat.isDirectory()) continue;
  const target = path.join(funcDir, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { dereference: true });
  fileCount++;
}

// Fallback page for client-side routes
await fs.mkdir(path.join(funcDir, "dist", "public"), { recursive: true });
await fs.copyFile(
  path.join(root, "dist", "public", "index.html"),
  path.join(funcDir, "dist", "public", "index.html"),
);

await fs.writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: serverBundle,
      launcherType: "Nodejs",
      // Express parses bodies itself (multer needs the raw stream)
      shouldAddHelpers: false,
      // Next to the Neon database (us-west-2) and the GCS bucket (us-west1)
      regions: ["pdx1"],
      maxDuration: 60,
      environment: { NODE_ENV: "production" },
    },
    null,
    2,
  ),
);

// 4. Routing: static files first, everything else goes to the function
await fs.writeFile(
  path.join(output, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "^/assets/.+\\.(js|css|woff2?|png|svg)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2,
  ),
);

console.log(`Vercel output ready: ${fileCount} files in the function`);
