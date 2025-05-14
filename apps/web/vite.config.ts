import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://react.dev/learn/react-compiler#usage-with-vite
const ReactCompilerConfig = {
  target: '19' // '17' | '18' | '19'
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
        babel: {
          plugins: [
            ["babel-plugin-react-compiler", ReactCompilerConfig],
          ],
        },
      }), tailwindcss()],
  server: { port: 3000 },
});
