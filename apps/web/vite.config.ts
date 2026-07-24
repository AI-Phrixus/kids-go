import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, "public"),
  server: { port: 5173 },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
