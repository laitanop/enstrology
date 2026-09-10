import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const x402Aliases = {
  "@x402/core/client": "./node_modules/@x402/core/dist/esm/client/index.mjs",
  "@x402/evm": "./node_modules/@x402/evm/dist/esm/index.mjs",
  "@x402/evm/exact/client": "./node_modules/@x402/evm/dist/esm/exact/client/index.mjs",
  "@x402/evm/upto/client": "./node_modules/@x402/evm/dist/esm/upto/client/index.mjs",
  "@x402/svm/exact/client": "./node_modules/@x402/svm/dist/esm/exact/client/index.mjs",
};

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: x402Aliases,
  },
};

export default nextConfig;
