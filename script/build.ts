import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const allowlist = [
  "@google/generative-ai",
  "@neondatabase/serverless",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm(path.join(rootDir, "dist"), { recursive: true, force: true });

  console.log("building client...");
  const startClient = Date.now();
  
  await viteBuild({
    root: path.join(rootDir, "client"),
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      outDir: path.join(rootDir, "dist", "public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover'],
          }
        }
      }
    },
    resolve: {
      alias: {
        "@": path.join(rootDir, "client", "src"),
        "@shared": path.join(rootDir, "shared"),
        "@assets": path.join(rootDir, "attached_assets"),
      },
    },
    logLevel: 'info',
  });
  
  console.log(`built client in ${((Date.now() - startClient) / 1000).toFixed(2)}s`);

  console.log("building server...");
  const startServer = Date.now();
  
  const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: [path.join(rootDir, "server/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(rootDir, "dist/index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
  
  console.log(`built server in ${((Date.now() - startServer) / 1000).toFixed(2)}s`);
  console.log("Build complete!");
}

buildAll().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
