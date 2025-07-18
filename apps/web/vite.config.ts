import reactScan from "@react-scan/vite-plugin-react-scan";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";
import inspect from "vite-plugin-inspect";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    inspect(),
    react() as PluginOption[],
    tailwindcss() as PluginOption[],
    reactScan(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg}"],
        cleanupOutdatedCaches: true,
      },
      // Force update on chunk loading errors
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { port: 3000, allowedHosts: [".deco.host"] },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  build: {
    rollupOptions: {
      external: ["cloudflare:workers"],
    },
  },
});
