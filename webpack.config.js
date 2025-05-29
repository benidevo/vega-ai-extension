const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const fs = require('fs');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  // Import the config to get client ID
  const configPath = './src/config/index.ts';
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Extract client ID based on mode
  let clientId;
  if (isProduction) {
    const prodMatch = configContent.match(/production:[\s\S]*?clientId:\s*['"]([^'"]+)['"]/);
    clientId = prodMatch ? prodMatch[1] : 'YOUR_CLIENT_ID.apps.googleusercontent.com';
  } else {
    const devMatch = configContent.match(/development:[\s\S]*?clientId:\s*['"]([^'"]+)['"]/);
    clientId = devMatch ? devMatch[1] : 'YOUR_CLIENT_ID.apps.googleusercontent.com';
  }

  console.log('🔧 Building with:', {
    mode: argv.mode || 'development',
    clientId: clientId,
    isProduction: isProduction
  });

  return {
    mode: argv.mode || 'development',
    devtool: 'source-map',
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/index.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.APP_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    }),
    new MiniCssExtractPlugin({
      filename: 'styles/[name].css',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            // Inject the client ID from config
            if (manifest.oauth2) {
              manifest.oauth2.client_id = clientId;
            }
            return JSON.stringify(manifest, null, 2);
          },
        },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/popup/index.html', to: 'popup/index.html' },
        { from: 'node_modules/htmx.org/dist/htmx.min.js', to: 'lib/htmx.min.js' },
        { from: 'node_modules/hyperscript.org/dist/_hyperscript.min.js', to: 'lib/hyperscript.min.js' },
      ],
    }),
  ],
  };
};
