const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    assetExts: [...assetExts, 'db', 'sqlite'],
    sourceExts: [...sourceExts, 'mjs'],
    extraNodeModules: {
      'react-native-webrtc': __dirname + '/node_modules/react-native-webrtc',
    },
  },
};

module.exports = mergeConfig(defaultConfig, config); 