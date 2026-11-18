// expo-sqlite on web runs SQLite as WebAssembly, which needs the .wasm asset
// extension and cross-origin-isolation headers (for SharedArrayBuffer).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};
module.exports = config;
