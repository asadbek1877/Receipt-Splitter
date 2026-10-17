module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // removed deprecated 'expo-router/babel' (use 'babel-preset-expo' in SDK 50+)
      // Отключаем Tamagui babel plugin для production сборки
      // Это уберет оптимизацию, но решит проблему со сборкой
      ...(!isProduction ? [
        [
          '@tamagui/babel-plugin',
          {
            components: ['tamagui'],
            config: './tamagui.config.ts',
            logTimings: true,
            disableExtraction: true
          }
        ]
      ] : []),
      [
        'module-resolver',
        {
          // NOTE: no `root` option. `root: ['./']` makes this plugin rewrite a bare
          // `require(".")` (used inside expo-router 57 itself) to the project root
          // (index.ts), which breaks expo-router at runtime. Only the '@' alias is needed.
          alias: {
            '@': './src'
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        }
      ],
      'react-native-reanimated/plugin' // должен быть последним
    ]
  };
};