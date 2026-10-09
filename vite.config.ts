import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// La base est servie à côté du site, dans /db/ (cf. scripts/split_db.py). En développement,
// `public/db` est un lien vers une base construite localement.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: {
    // Le paquet officiel charge son .wasm par une URL relative : le pré-bundling la casse.
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@codemirror") || id.includes("@uiw") || id.includes("@lezer")) return "editor";
            if (id.includes("motion") || id.includes("framer")) return "motion";
            if (id.includes("react") || id.includes("scheduler")) return "react";
          }
        },
      },
    },
  },
  server: { port: 5173 },
});
