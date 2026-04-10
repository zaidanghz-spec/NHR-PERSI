The Netlify deploy errored, with the following guidance provided:

Diagnosis
- Relevant error lines: [line 58](#L58)-[line 63](#L63) show the build failed and Rollup couldn't resolve an import; the specific failure is on [line 60](#L60).
- Error type and cause: Rollup/Vite failed to resolve the import "/utils/supabase/info" from src/app/utils/api.ts. This happens because the import specifier is not a valid relative path (it starts with a leading "/") and Rollup cannot locate that module in the project filesystem. In short: the importer uses an incorrect absolute-style import that doesn't resolve to a file in the repo (or the target file is missing).

Solution
1) Confirm the module exists
- Verify the module file exists and was committed. Check for a file like:
  - src/app/utils/supabase/info.ts or src/utils/supabase/info.ts
- If the file is missing, add/commit it and re-run the build.

2) Fix the import in src/app/utils/api.ts
- Replace the absolute-style import "/utils/supabase/info" with a proper relative path (or an alias you configured). Examples:
  - If info.ts is in the same folder as api.ts under utils:
```ts
// src/app/utils/api.ts
import { something } from "./supabase/info";
```
  - If info.ts lives at src/utils/supabase/info.ts and api.ts is at src/app/utils/api.ts, compute the correct relative path (example):
```ts
import { something } from "../../utils/supabase/info";
```
- After editing, run the build locally (npm run build) to confirm.

3) (Optional) Use Vite aliases for clean absolute imports
- If you want to use absolute imports like "@/..." or "utils/..." across the project, configure Vite resolve.alias (and update tsconfig.json paths if using TypeScript). Example vite.config.ts:
```ts
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "utils": path.resolve(__dirname, "src/utils")
    }
  }
});
```
- Then import with:
```ts
import { something } from "utils/supabase/info";
```
- Commit vite.config.ts and any tsconfig changes and rebuild.

4) Note about build.rollupOptions.external
- You might see advice to add the module to build.rollupOptions.external; do not do that for your own source files. If you ever consider externalizing something, first verify the package is in package.json or that the file was committed to the repo. Externalizing is for libraries you want Rollup to leave as external, not for application source files.

If you prefer, paste the import lines from src/app/utils/api.ts and the path to info.* and I’ll give the exact replacement.

The relevant error logs are:

Line 0: build-image version: 207bd4d38e2cd3af6515aa37c5942e41499b616a (noble-new-builds)
Line 1: buildbot version: 420ff06ebdfb3fd8215b1a0a158ab916a07fe5a9
Line 2: Fetching cached dependencies
Line 3: Failed to fetch cache, continuing with build
Line 4: Fetching build zip file
Line 5: Starting to prepare the repo for build
Line 6: Custom publish path detected. Proceeding with the specified path: 'dist'
Line 7: Custom build command detected. Proceeding with the specified command: 'npm run build'
Line 8: Installing dependencies
Line 9: mise [36m~/.config/mise/config.toml[0m tools: [34mpython[0m@3.14.3
Line 10: mise [36m~/.config/mise/config.toml[0m tools: [34mruby[0m@3.4.8
Line 11: mise [36m~/.config/mise/config.toml[0m tools: [34mgo[0m@1.26.0
Line 12: Downloading and installing node v22.22.1...
Line 13: Downloading https://nodejs.org/dist/v22.22.1/node-v22.22.1-linux-x64.tar.xz...
Line 48: [96m[1m​[22m[39m
Line 49: [96m[1mbuild.command from netlify.toml                               [22m[39m
Line 50: [96m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 51: ​
Line 52: [36m$ npm run build[39m
Line 53: > @figma/my-make-file@0.0.1 build
Line 54: > vite build
Line 55: [36mvite v6.3.5 [32mbuilding for production...[36m[39m
Line 56: transforming...
Line 57: [32m✓[39m 1655 modules transformed.
Line 58: [31m✗[39m Build failed in 1.45s
Line 59: [31merror during build:
Line 60: [31m[vite]: Rollup failed to resolve import "/utils/supabase/info" from "/opt/build/repo/src/app/utils/api.ts".
Line 61: This is most likely unintended because it can break your application at runtime.
Line 62: If you do want to externalize this module explicitly add it to
Line 63: `build.rollupOptions.external`[31m
Line 64:     at viteLog (file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:46345:15)
Line 65:     at file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:46403:18
Line 66:     at onwarn (file:///opt/build/repo/node_modules/@vitejs/plugin-react/dist/index.js:90:7)
Line 67:     at file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:46401:7
Line 68:     at onRollupLog (file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:46393:5)
Line 69:     at onLog (file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:46043:7)
Line 70:     at file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:20981:32
Line 71:     at Object.logger [as onLog] (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:22968:9)
Line 72:     at ModuleLoader.handleInvalidResolvedId (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21712:26)
Line 73:     at file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21670:26[39m
Line 74: [91m[1m​[22m[39m
Line 75: [91m[1m"build.command" failed                                        [22m[39m
Line 76: [91m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 77: ​
Line 78:   [31m[1mError message[22m[39m
Line 79:   Command failed with exit code 1: npm run build
Line 80: ​
Line 81:   [31m[1mError location[22m[39m
Line 82:   In build.command from netlify.toml:
Line 83:   npm run build
Line 84: ​
Line 85:   [31m[1mResolved config[22m[39m
Line 86:   build:
Line 87:     command: npm run build
Line 88:     commandOrigin: config
Line 89:     publish: /opt/build/repo/dist
Line 90:     publishOrigin: config
Line 91:   redirects:
Line 92:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
Line 93: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 94: Failing build: Failed to build site
Line 95: Finished processing build request in 33.652s