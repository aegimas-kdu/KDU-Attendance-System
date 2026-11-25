import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // There is a stray package-lock.json in C:\Users\HP. Without this, Turbopack
  // walks up looking for the workspace root, finds that one, and warns on
  // every build.
  turbopack: { root: here },
};

export default nextConfig;
