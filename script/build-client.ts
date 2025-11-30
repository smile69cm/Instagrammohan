import { build as viteBuild } from "vite";
import { rm, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function buildClient() {
  await rm(path.join(rootDir, "dist"), { recursive: true, force: true });
  await mkdir(path.join(rootDir, "dist"), { recursive: true });

  console.log("Building client for Vercel...");
  await viteBuild({
    root: path.join(rootDir, "client"),
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      outDir: path.join(rootDir, "dist"),
      emptyOutDir: false,
    },
    resolve: {
      alias: {
        "@": path.join(rootDir, "client", "src"),
        "@shared": path.join(rootDir, "shared"),
        "@assets": path.join(rootDir, "attached_assets"),
      },
    },
  });

  console.log("Client build complete!");
}

buildClient().catch((err) => {
  console.error(err);
  process.exit(1);
});
