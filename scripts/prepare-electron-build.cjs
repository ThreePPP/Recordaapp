const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const processesToKill = ["ScreenStudio.exe", "recordapp.exe"];

function killProcessWindows(imageName) {
  if (process.platform !== "win32") {
    return;
  }

  const result = spawnSync("taskkill", ["/F", "/T", "/IM", imageName], {
    stdio: "pipe",
  });

  if (result.status === 0) {
    console.log(`[prepare-electron-build] Stopped ${imageName}`);
    return;
  }

  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (
    output.includes("No tasks are running") ||
    output.includes("not found") ||
    output.includes("cannot find")
  ) {
    return;
  }

  if (output.trim()) {
    console.log(`[prepare-electron-build] taskkill ${imageName}: ${output.trim()}`);
  }
}

async function safeRm(targetPath) {
  try {
    await fs.rm(targetPath, {
      force: true,
      recursive: true,
      maxRetries: 20,
      retryDelay: 250,
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function main() {
  for (const proc of processesToKill) {
    killProcessWindows(proc);
  }

  await fs.mkdir(distDir, { recursive: true });

  const distEntries = await fs.readdir(distDir).catch(() => []);
  const staleArchives = distEntries
    .filter((name) => name.endsWith(".nsis.7z"))
    .map((name) => path.join(distDir, name));

  const cleanupTargets = [
    path.join(distDir, "win-unpacked"),
    path.join(distDir, "win-ia32-unpacked"),
    path.join(distDir, "win-arm64-unpacked"),
    ...staleArchives,
  ];

  for (const target of cleanupTargets) {
    await safeRm(target);
  }

  console.log("[prepare-electron-build] Build output pre-clean complete.");
}

main().catch((error) => {
  console.error("[prepare-electron-build] Failed to clean build outputs.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
