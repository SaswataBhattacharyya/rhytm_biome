// Expo SDK 52+ configures npm-workspace monorepos automatically
// (watchFolders + nodeModulesPaths). Kept explicit so Codex can adjust.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
