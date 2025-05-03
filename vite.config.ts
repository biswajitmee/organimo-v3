import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      // Add aliases for your project directories here
      '@': '/src', // Example: Map "@" to your "src" directory
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Define manual chunks here if needed
        }
      }
    },
    chunkSizeWarningLimit: 5000 // Set your desired limit in kB
  }
});
