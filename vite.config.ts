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
        // React et motion servent partout : chacun son fichier, mis en cache une fois.
        // CodeMirror n'a pas de groupe : il reste dans le morceau du labo, chargé à la demande.
        codeSplitting: {
          groups: [
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: "motion", test: /[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: { port: 5173 },
});
