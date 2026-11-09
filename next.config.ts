import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Native addons (the canvas pdf.js draws PDF pages on for local models) load from node_modules
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
