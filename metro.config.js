const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_conditionNames = ['react-native', 'require', 'browser', 'default'];

module.exports = config;
