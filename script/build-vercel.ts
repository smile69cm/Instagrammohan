import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

async function buildForVercel() {
  await rm(path.join(rootDir, "dist"), { recursive: true, force: true });
  await mkdir(path.join(rootDir, "dist"), { recursive: true });
  await mkdir(path.join(rootDir, "dist/api"), { recursive: true });

  console.log("Building client...");
  await viteBuild({
    root: path.join(rootDir, "client"),
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

  console.log("Building API for Vercel serverless...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["api/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/api/index.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("Build complete!");
}

buildForVercel().catch((err) => {
  console.error(err);
  process.exit(1);
});
