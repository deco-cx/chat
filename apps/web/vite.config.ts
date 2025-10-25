import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import inspect from "vite-plugin-inspect";

const fourMB = 4 * 1024 * 1024;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    inspect(),
    react() as PluginOption[],
    tailwindcss() as PluginOption[],
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: fourMB,
      },
      // Force update on chunk loading errors
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { host: "0.0.0.0", port: 3000, allowedHosts: [".deco.host"] },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
    // TODO: fix export of packages/sdk export files to not include these packages, then remove this
    exclude: ["@deco/cf-sandbox", "cloudflare:workers"],
  },
  build: {
    rollupOptions: {
      // TODO: fix export of packages/sdk export files to not include these packages, then remove this
      external: ["@deco/cf-sandbox", "cloudflare:workers"],
    },
  },
});
