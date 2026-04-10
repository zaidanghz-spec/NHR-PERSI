The Netlify deploy errored, with the following guidance provided:

Relevant log lines
- Build command started: [line 58](#L58)
- Vite starting build: [line 61](#L61)
- Build failed: [line 63](#L63)
- Root error: "Could not resolve entry module "index.html"." — [line 65](#L65) (stack frames at [lines 66–69](#L66-L69))

Diagnosis (error type and cause)
- Error type: Vite / Rollup build error: missing entry module.
- Cause: Vite attempted to use index.html as the build entry but Rollup could not find or resolve it. This usually means index.html is not present at the project root that Vite is running in, is not committed to the repo, or your Vite config uses a different project root but the build ran from the repo root.

Solution — follow these steps until build succeeds

1) Verify index.html exists and is committed
- In your repo root run:
```bash
git ls-files | grep -E '(^|/)index\.html$' || echo "index.html not found"
```
- If the command prints nothing, add/commit an index.html at the expected location (usually the project root). A minimal example:
```html
<!-- index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```
Commit and push, then retry Netlify build.

2) If index.html is in a subfolder (e.g., client/ or app/), tell Vite where to look
- Option A — set Vite root to that folder in vite.config.js:
```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client' // <-- path to folder that contains index.html
});
```
- Option B — explicitly set the rollup input to the HTML file:
```js
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html')
      }
    }
  }
});
```
After changing vite.config.js, commit and push.

3) If this project is a library (no index.html) — configure Vite library mode
- Instead of using an HTML entry, set build.lib in vite.config.js:
```js
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`
    }
  }
});
```
Also ensure your package.json build script matches the intended output.

4) Run and verify locally before pushing
- Reproduce the build locally:
```bash
npm ci
npm run build
```
Fix any local errors, then push to trigger Netlify.

Notes
- The core log line reporting the exact failure is [line 65](#L65): "Could not resolve entry module 'index.html'."
- If you intended a different build command/framework (e.g., CRA, Next, SvelteKit), make sure your Netlify build command matches that framework's recommended build command and that the project layout matches Vite's expectations.

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
Line 53:    - neon
Line 54: [96m[1m​[22m[39m
Line 55: [96m[1mbuild.command from netlify.toml                               [22m[39m
Line 56: [96m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 57: ​
Line 58: [36m$ npm run build[39m
Line 59: > @figma/my-make-file@0.0.1 build
Line 60: > vite build
Line 61: [36mvite v6.3.5 [32mbuilding for production...[36m[39m
Line 62: [32m✓[39m 0 modules transformed.
Line 63: [31m✗[39m Build failed in 10ms
Line 64: [31merror during build:
Line 65: [31mCould not resolve entry module "index.html".[31m
Line 66:     at getRollupError (file:///opt/build/repo/node_modules/rollup/dist/es/shared/parseAst.js:402:41)
Line 67:     at error (file:///opt/build/repo/node_modules/rollup/dist/es/shared/parseAst.js:398:42)
Line 68:     at ModuleLoader.loadEntryModule (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21731:20)
Line 69:     at async Promise.all (index 0)[39m
Line 70: [91m[1m​[22m[39m
Line 71: [91m[1m"build.command" failed                                        [22m[39m
Line 72: [91m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 73: ​
Line 74:   [31m[1mError message[22m[39m
Line 75:   Command failed with exit code 1: npm run build
Line 76: ​
Line 77:   [31m[1mError location[22m[39m
Line 78:   In build.command from netlify.toml:
Line 79:   npm run build
Line 80: ​
Line 81:   [31m[1mResolved config[22m[39m
Line 82:   build:
Line 83:     command: npm run build
Line 84:     commandOrigin: config
Line 85:     publish: /opt/build/repo/dist
Line 86:     publishOrigin: config
Line 87: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 88: Failing build: Failed to build site
Line 89: Finished processing build request in 41.759s
Line 90: Failed during stage 'building site': Build script returned non-zero exit code: 2