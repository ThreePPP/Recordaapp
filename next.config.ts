import type { NextConfig } from "next";

// Static export is needed when packaging with electron-builder.
// Activate it by passing --build-target=electron or setting BUILD_TARGET=electron
// (cross-env handles the env var on both Windows and Unix).
const isElectronBuild =
  process.env["BUILD_TARGET"] === "electron" ||
  process.argv.includes("--build-target=electron");

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Static export — required so electron-builder can bundle HTML/CSS/JS
  // into the .exe without needing a running Next.js server.
  ...(isElectronBuild && {
    output: "export",
    // Trailing slash ensures index.html is found correctly.
    trailingSlash: true,
    // Image optimisation is not supported in static export mode.
    images: { unoptimized: true },
  }),
};

export default nextConfig;
