The Netlify deploy errored, with the following guidance provided:

Relevant log lines
- Build command started: [line 52](#L52)
- Vite started building: [line 55](#L55)
- Build failed: [line 58](#L58)
- Actual error: Vite could not load a module — [line 60](#L60) and stacktrace [line 63-L66](#L63-L66)

Diagnosis
- Error type: Module resolution / ENOENT (file not found) during Vite build.
- Cause: An import in src/app/utils/api.ts references utils/supabase/info but Vite cannot find that file at /opt/build/repo/utils/supabase/info (ENOENT). Most likely reasons:
  - The file utils/supabase/info.(ts|js|json) is missing from the repository (not committed).
  - The import path has the wrong relative path or wrong alias (e.g., using a bare import when the file lives elsewhere).
  - A case-sensitivity mismatch (works locally on macOS/Windows but fails on Linux build host).

Solution — what to check and how to fix
1) Verify the file exists and is committed
- From your repo root run (or check in your Git host UI):
```bash
git ls-files | grep -E '^utils/supabase/info'
# or search for any matching extensions
git ls-files | grep -E 'utils/supabase/info\.(ts|js|mjs|cjs|json)$'
```
- If no results: add the file to the repo, commit and push:
```bash
git add utils/supabase/info.ts   # or the correct filename
git commit -m "Add supabase info module"
git push
```

2) If the file exists locally but build still fails, check for case sensitivity
- Ensure the filename and every directory name exactly match the import (Linux is case-sensitive). For example if import is:
```ts
import info from 'utils/supabase/info'
```
then the path must be exactly utils/supabase/info.ts (not Utils/Supabase/Info.ts). Rename and commit if needed:
```bash
git mv utils/Supabase/info.ts utils/supabase/info.ts
git commit -m "Fix path casing for supabase info"
git push
```

3) If you intended a relative import (no alias) ensure the import is correct
- From src/app/utils/api.ts, a sibling file might need a relative path:
```ts
// instead of 'utils/supabase/info'
import info from '../../utils/supabase/info'
```
Adjust the relative path and commit.

4) If you use a path alias like 'utils' make sure the alias is configured for Vite (and matches where the files are)
- Verify utils alias maps to the correct folder in vite.config.ts. Example alias mapping:
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'utils': path.resolve(__dirname, 'src/utils') // adjust to where your utils actually live
    }
  }
})
```
- If you change the alias, commit and push.

Summary checklist
- [ ] Confirm utils/supabase/info file exists in the repo and is committed.
- [ ] Ensure import path exactly matches file path (including letter casing).
- [ ] If using aliases, verify vite.config.ts resolve.alias (and tsconfig paths if used) points to the correct directory.
- After making fixes, push and trigger a new build.

If you need, paste the value of the import line from src/app/utils/api.ts and a directory listing of where you expect info to live and I can give the exact change to make.

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
Line 57: [32m✓[39m 1708 modules transformed.
Line 58: [31m✗[39m Build failed in 1.53s
Line 59: [31merror during build:
Line 60: [31m[vite:load-fallback] Could not load /opt/build/repo/utils/supabase/info (imported by src/app/utils/api.ts): ENOENT: no such
Line 61:     at async open (node:internal/fs/promises:636:25)
Line 62:     at async Object.readFile (node:internal/fs/promises:1235:14)
Line 63:     at async Object.handler (file:///opt/build/repo/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:45843:27)
Line 64:     at async PluginDriver.hookFirstAndGetPlugin (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:22453:2
Line 65:     at async file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21445:33
Line 66:     at async Queue.work (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:22681:32)[39m
Line 67: [91m[1m​[22m[39m
Line 68: [91m[1m"build.command" failed                                        [22m[39m
Line 69: [91m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 70: ​
Line 71:   [31m[1mError message[22m[39m
Line 72:   Command failed with exit code 1: npm run build
Line 73: ​
Line 74:   [31m[1mError location[22m[39m
Line 75:   In build.command from netlify.toml:
Line 76:   npm run build
Line 77: ​
Line 78:   [31m[1mResolved config[22m[39m
Line 79:   build:
Line 80:     command: npm run build
Line 81:     commandOrigin: config
Line 82:     publish: /opt/build/repo/dist
Line 83:     publishOrigin: config
Line 84:   redirects:
Line 85:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
Line 86: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 87: Failing build: Failed to build site
Line 88: Finished processing build request in 34.66s