import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const metadataPath = resolve(dist, "asset-manifest.json");
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

const fail = (message) => {
  throw new Error(`Production asset check failed: ${message}`);
};

if (metadata.schemaVersion !== 1) {
  fail("unexpected metadata schema version");
}

const entry = metadata.entries?.["notice/entries/notice-block"];

if (!entry || entry.surface !== "editor-parent") {
  fail("Notice editor-parent entry metadata is missing");
}

if (entry.handle !== "yamabiko-blocks-notice-block-editor") {
  fail("Notice entry handle is not explicit or stable");
}

if (
  !Array.isArray(entry.dependencies) ||
  !Array.isArray(entry.css) ||
  !/^[a-f0-9]{64}$/.test(entry.version)
) {
  fail("entry dependencies, CSS, or version metadata is invalid");
}

const requiredExternals = new Map([
  ["react", ["React", "react"]],
  ["react-dom", ["ReactDOM", "react-dom"]],
  ["react-dom/client", ["ReactDOM", "react-dom"]],
  ["react/jsx-runtime", ["ReactJSXRuntime", "react-jsx-runtime"]],
  ["react/jsx-dev-runtime", ["ReactJSXRuntime", "react-jsx-runtime"]],
]);

for (const [request, [global, handle]] of requiredExternals) {
  const mapping = metadata.externals?.find(
    (candidate) => candidate.request === request,
  );

  if (mapping?.global !== global || mapping?.handle !== handle) {
    fail(`external mapping is invalid for ${request}`);
  }
}

const wordpressRule = metadata.externals?.find(
  (candidate) => candidate.request === "@wordpress/*",
);

if (
  wordpressRule?.global !== "wp.<camelCasePackage>" ||
  wordpressRule?.handle !== "wp-<package>"
) {
  fail("@wordpress/* external mapping is invalid");
}

const emittedFiles = [entry.file, ...entry.css];
const hash = createHash("sha256");
const forbidden = [
  "/@vite/client",
  "import.meta.hot",
  "localhost:5173",
  "127.0.0.1:5173",
  "react.development.js",
  "react.production.min.js",
  "react-dom.development.js",
  "react-dom.production.min.js",
];

for (const relativePath of emittedFiles) {
  if (
    typeof relativePath !== "string" ||
    relativePath.startsWith("/") ||
    relativePath.includes("..")
  ) {
    fail(`unsafe emitted path: ${String(relativePath)}`);
  }

  const absolutePath = resolve(dist, relativePath);
  const fileStat = await stat(absolutePath);

  if (!fileStat.isFile()) {
    fail(`emitted path is not a file: ${relativePath}`);
  }

  const content = await readFile(absolutePath);
  hash.update(relativePath);
  hash.update(content);

  const text = content.toString("utf8");
  const marker = forbidden.find((candidate) => text.includes(candidate));

  if (marker) {
    fail(`development or bundled runtime marker found: ${marker}`);
  }
}

if (hash.digest("hex") !== entry.version) {
  fail("entry content version does not match emitted files");
}

process.stdout.write("Production asset metadata and output are valid.\n");
