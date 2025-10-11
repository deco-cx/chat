import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import deco from "./plugin.ts";

import path from "path";
import process from "node:process";

const VITE_SERVER_ENVIRONMENT_NAME = "server";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      configPath: "wrangler.toml",
      viteEnvironment: {
        name: VITE_SERVER_ENVIRONMENT_NAME,
      },
    }),
    tailwindcss(),
    deco(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./view/src"),
    },
  },

  define: {
    // Ensure proper module definitions for Cloudflare Workers context
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
    global: "globalThis",
    // '__filename': '""',
    // '__dirname': '""',
  },

  // Clear cache more aggressively
  cacheDir: "node_modules/.vite",
});
