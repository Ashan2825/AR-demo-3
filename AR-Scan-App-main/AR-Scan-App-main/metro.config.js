const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// AR.js ships a UMD bundle that `require`s three, while the app imports it as
// ESM. Package exports would hand those two callers different builds, giving
// three.js two module instances (and two sets of class identities). Pin every
// request to the ESM build so marker matrices and app objects agree.
const THREE_ENTRY = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: THREE_ENTRY };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
