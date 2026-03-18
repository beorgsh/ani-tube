import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Whenever we fetch starting with '/api/mapper', Vite intercepts it
      "/api/mapper": {
        target: "https://anilistmapper.vercel.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mapper/, ""),
      },
    },
  },
});
