import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const distDirectory = fileURLToPath(new URL("./dist", import.meta.url));

await rm(distDirectory, { recursive: true, force: true });

await build({
  entryPoints: [fileURLToPath(new URL("./src/main.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("./dist/main.js", import.meta.url)),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  external: ["@colyseus/*", "express"],
});
