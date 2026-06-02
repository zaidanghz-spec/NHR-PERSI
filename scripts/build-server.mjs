import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist-server", { recursive: true });

await build({
  entryPoints: ["api/turso_ops.ts"],
  outfile: "dist-server/turso_ops.js",
  bundle: false,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
});
