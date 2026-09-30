// Metro config for the Yarn workspace (repo root = ..; tinyPetApp consumes ../shared).
// Expo SDK 52 auto-detects workspaces; we only make sure the repo root is watched and resolvable.
// @tinypet/shared is TypeScript source; Metro transpiles it (sourceExts already includes ts/tsx).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), repoRoot]));
config.resolver.nodeModulesPaths = Array.from(
  new Set([...(config.resolver.nodeModulesPaths ?? []), path.resolve(projectRoot, "node_modules"), path.resolve(repoRoot, "node_modules")]),
);

module.exports = config;
