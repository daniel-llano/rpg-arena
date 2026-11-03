/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const api = process.env.API_URL ?? "http://localhost:5175";

// The API serves the built app from its wwwroot, so the page, the API and the hub share one origin.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "../src/RpgArena.Api/wwwroot",
    emptyOutDir: true,
  },
  server: {
    port: 5176,
    proxy: {
      "/api": api,
      "/hubs": { target: api, ws: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
