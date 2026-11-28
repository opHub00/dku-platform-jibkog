import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { aiApiPlugin } from "./server/vitePluginAiApi";

export default defineConfig({
  plugins: [react(), tailwindcss(), aiApiPlugin({ envDir: import.meta.dirname })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // .env는 프로젝트 루트에 둔다. 브라우저에는 VITE_로 시작하는 값(카카오 지도 JS 키)만 들어간다
  envDir: import.meta.dirname,
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 3000,
  },
});
