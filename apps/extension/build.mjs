// Builds the Klar extension into ./dist.
//   KLAR_APP_ORIGINS="https://klar.example,http://localhost:3000" npm run build
// The first origin is used as the dashboard URL.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const watch = process.argv.includes("--watch");

const origins = (process.env.KLAR_APP_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
for (const o of origins) {
  const u = new URL(o);
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.origin !== o || (u.protocol !== "https:" && !local)) {
    throw new Error(`Invalid app origin "${o}". Use https (http only for localhost).`);
  }
}

const define = {
  __APP_ORIGINS__: JSON.stringify(origins),
  __APP_URL__: JSON.stringify(origins[0]),
  __EXT_VERSION__: JSON.stringify(pkg.version),
};

const shared = { root, define, logLevel: "warn", configFile: false };

await build({
  ...shared,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    watch: watch ? {} : null,
    rollupOptions: {
      input: { popup: resolve(root, "popup.html"), background: resolve(root, "src/background.ts") },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});

// Content scripts cannot be ES modules, so each is bundled as a standalone IIFE.
for (const name of ["bridge", "capture"]) {
  await build({
    ...shared,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      watch: watch ? {} : null,
      lib: { entry: resolve(root, `src/${name}.ts`), formats: ["iife"], name: `klar_${name}`, fileName: () => `${name}.js` },
    },
  });
}

const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
const manifest = {
  manifest_version: 3,
  name: "Klar for Schoology",
  short_name: "Klar",
  version: pkg.version,
  description: "Connects your Schoology gradebook to Klar. Reads grades only with your consent and never sees your password.",
  icons,
  action: { default_popup: "popup.html", default_title: "Klar", default_icon: icons },
  background: { service_worker: "background.js", type: "module" },
  // storage: connection state. scripting: register the reader on custom school domains.
  // No cookies, history, tabs, notifications or webRequest.
  permissions: ["storage", "scripting"],
  host_permissions: ["https://*.schoology.com/*", ...origins.map((o) => `${o}/*`)],
  // Schools that host Schoology on their own domain grant that one host at runtime.
  optional_host_permissions: ["https://*/*"],
  content_scripts: [
    { matches: ["https://*.schoology.com/grades/grades*"], js: ["capture.js"], run_at: "document_idle" },
    { matches: origins.map((o) => `${o}/*`), js: ["bridge.js"], run_at: "document_start" },
  ],
  minimum_chrome_version: "116",
};
writeFileSync(resolve(root, "dist/manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Built Klar extension v${pkg.version} for ${origins.join(", ")}`);
