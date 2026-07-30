import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

interface EntryDefinition {
  source: string;
  handle: string;
  surface: "editor-parent";
}

interface ExternalMapping {
  request: string;
  global: string;
  handle: string;
}

interface ViteManifestEntry {
  file: string;
  css?: string[];
}

const root = import.meta.dirname;
const sourceRoot = resolve(root, "src");
const dist = resolve(root, "dist");
const developmentOrigin =
  process.env.YAMABIKO_BLOCKS_VITE_ORIGIN ?? "http://localhost:5173";

const entryInputs: EntryDefinition[] = [
  {
    source: resolve(root, "src/Notice/entries/notice-block.entry.ts"),
    handle: "yamabiko-blocks-notice-block-editor",
    surface: "editor-parent",
  },
];

const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const normalizeEntryKey = (source: string): string => {
  const relativeSource = relative(sourceRoot, source).split(sep).join("/");

  if (relativeSource.startsWith("../") || relativeSource.startsWith("/")) {
    throw new Error(`Vite entry is outside app/src: ${source}`);
  }

  const segments = relativeSource.split("/");
  const filename = segments.pop();

  if (!filename || !/\.entry\.tsx?$/.test(filename)) {
    throw new Error(
      `Vite entry must end in .entry.ts or .entry.tsx: ${source}`,
    );
  }

  segments.push(filename.replace(/\.entry\.tsx?$/, ""));
  return segments.map(toKebabCase).join("/");
};

const createEntryDefinitions = (): Map<string, EntryDefinition> => {
  const definitions = new Map<string, EntryDefinition>();
  const handles = new Set<string>();

  for (const entry of entryInputs) {
    const key = normalizeEntryKey(entry.source);

    if (definitions.has(key)) {
      throw new Error(`Duplicate normalized Vite entry key: ${key}`);
    }

    if (handles.has(entry.handle)) {
      throw new Error(`Duplicate public script handle: ${entry.handle}`);
    }

    definitions.set(key, entry);
    handles.add(entry.handle);
  }

  return definitions;
};

const entryDefinitions = createEntryDefinitions();

const fixedExternalMappings = new Map<string, ExternalMapping>([
  ["react", { request: "react", global: "React", handle: "react" }],
  [
    "react-dom",
    { request: "react-dom", global: "ReactDOM", handle: "react-dom" },
  ],
  [
    "react-dom/client",
    {
      request: "react-dom/client",
      global: "ReactDOM",
      handle: "react-dom",
    },
  ],
  [
    "react/jsx-runtime",
    {
      request: "react/jsx-runtime",
      global: "ReactJSXRuntime",
      handle: "react-jsx-runtime",
    },
  ],
  [
    "react/jsx-dev-runtime",
    {
      request: "react/jsx-dev-runtime",
      global: "ReactJSXRuntime",
      handle: "react-jsx-runtime",
    },
  ],
]);

const toCamelCase = (value: string): string =>
  value.replace(/-([a-z0-9])/g, (_match, character: string) =>
    character.toUpperCase(),
  );

const resolveExternal = (request: string): ExternalMapping | undefined => {
  const fixed = fixedExternalMappings.get(request);

  if (fixed) {
    return fixed;
  }

  const wordpressPackage = /^@wordpress\/([a-z0-9-]+)(\/.*)?$/.exec(request);

  if (!wordpressPackage) {
    return undefined;
  }

  const packageName = wordpressPackage[1];
  const subpath = wordpressPackage[2];

  if (subpath) {
    throw new Error(
      `Import WordPress packages from their package root: ${request}`,
    );
  }

  return {
    request,
    global: `wp.${toCamelCase(packageName)}`,
    handle: `wp-${packageName}`,
  };
};

const sourceManifestKey = (source: string): string =>
  relative(root, source).split(sep).join("/");

const developmentDescriptorPlugin = (): Plugin => ({
  name: "yamabiko-blocks-development-descriptor",
  apply: "serve",
  configureServer(server) {
    const descriptorPath = resolve(dist, ".vite/dev-server.json");
    const descriptor = {
      origin: developmentOrigin,
      client: "/@vite/client",
      entries: Object.fromEntries(
        [...entryDefinitions].map(([key, entry]) => [
          key,
          `/${sourceManifestKey(entry.source)}`,
        ]),
      ),
    };
    const writeDescriptor = () => {
      mkdirSync(dirname(descriptorPath), { recursive: true });
      writeFileSync(
        descriptorPath,
        `${JSON.stringify(descriptor, null, 2)}\n`,
        "utf8",
      );
    };
    const removeDescriptor = () => {
      rmSync(descriptorPath, { force: true });
    };

    server.httpServer?.once("listening", writeDescriptor);
    server.httpServer?.once("close", removeDescriptor);
  },
});

const productionMetadataPlugin = (): Plugin => {
  const dependencies = new Map<string, string[]>();

  return {
    name: "yamabiko-blocks-production-metadata",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const [entryKey, definition] of entryDefinitions) {
        const chunk = Object.values(bundle).find(
          (output) =>
            output.type === "chunk" &&
            output.facadeModuleId === definition.source,
        );

        if (chunk?.type !== "chunk") {
          this.error(`Missing output chunk for ${entryKey}`);
        }

        const handles = [...chunk.imports, ...chunk.dynamicImports]
          .map((request) => resolveExternal(request)?.handle)
          .filter((handle): handle is string => undefined !== handle);

        dependencies.set(entryKey, [...new Set(handles)].sort());
      }
    },
    writeBundle() {
      const emittedPaths = new Set<string>();
      const viteManifest = JSON.parse(
        readFileSync(resolve(dist, "manifest.json"), "utf8"),
      ) as Partial<Record<string, ViteManifestEntry>>;
      const entries = Object.fromEntries(
        [...entryDefinitions].map(([entryKey, definition]) => {
          const emitted = viteManifest[sourceManifestKey(definition.source)];

          if (!emitted) {
            throw new Error(`Missing Vite manifest entry for ${entryKey}`);
          }

          const css = emitted.css ?? [];
          const files = [emitted.file, ...css];
          const hash = createHash("sha256");

          for (const file of files) {
            if (emittedPaths.has(file)) {
              throw new Error(`Duplicate emitted asset path: ${file}`);
            }

            emittedPaths.add(file);
            hash.update(file);
            hash.update(readFileSync(resolve(dist, file)));
          }

          return [
            entryKey,
            {
              handle: definition.handle,
              surface: definition.surface,
              file: emitted.file,
              css,
              dependencies: dependencies.get(entryKey) ?? [],
              version: hash.digest("hex"),
            },
          ];
        }),
      );
      const externals = [
        ...fixedExternalMappings.values(),
        {
          request: "@wordpress/*",
          global: "wp.<camelCasePackage>",
          handle: "wp-<package>",
        },
      ];

      writeFileSync(
        resolve(dist, "asset-manifest.json"),
        `${JSON.stringify({ schemaVersion: 1, entries, externals }, null, 2)}\n`,
        "utf8",
      );
    },
  };
};

export default defineConfig({
  plugins: [react(), developmentDescriptorPlugin(), productionMetadataPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    origin: developmentOrigin,
  },
  build: {
    outDir: dist,
    emptyOutDir: true,
    manifest: "manifest.json",
    rollupOptions: {
      input: Object.fromEntries(
        [...entryDefinitions].map(([key, entry]) => [key, entry.source]),
      ),
      external: (request) => undefined !== resolveExternal(request),
      output: {
        format: "iife",
        name: "YamabikoBlocksNoticeBlock",
        globals: (request) => {
          const external = resolveExternal(request);

          if (!external) {
            throw new Error(`Missing WordPress external mapping: ${request}`);
          }

          return external.global;
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
