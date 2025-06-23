const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const deploymentMode = env?.DEPLOYMENT_MODE || 'opensource'; // 'opensource' or 'marketplace'
  
  console.log('🔧 Building with:', {
    mode: argv.mode || 'development',
    deploymentMode,
    isProduction
  });

  // Configuration based on deployment mode
  const config = {
    development: {
      clientId: '723024681965-pptqjhqv96n7g26dn43qlrntij2v5qnf.apps.googleusercontent.com',
      apiBaseUrl: 'http://localhost:8765',
      enableOAuth: true
    },
    production: {
      clientId: deploymentMode === 'opensource' 
        ? '723024681965-pptqjhqv96n7g26dn43qlrntij2v5qnf.apps.googleusercontent.com'
        : '', // Marketplace doesn't include OAuth
      apiBaseUrl: 'http://localhost:8765', // Default for all builds
      enableOAuth: deploymentMode === 'opensource'
    }
  };

  const currentConfig = isProduction ? config.production : config.development;

  return {
    mode: argv.mode || 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      popup: './src/popup/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name]/index.js',
      clean: true,
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
    optimization: isProduction ? {
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
          },
        },
      },
    } : {},
    plugins: [
      new webpack.DefinePlugin({
        'process.env.APP_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.DEPLOYMENT_MODE': JSON.stringify(deploymentMode),
        'process.env.ENABLE_OAUTH': JSON.stringify(currentConfig.enableOAuth),
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
              
              // Handle OAuth configuration based on deployment mode
              if (deploymentMode === 'marketplace' || !currentConfig.enableOAuth) {
                // Remove OAuth for marketplace builds
                delete manifest.oauth2;
                delete manifest.key;
              } else if (manifest.oauth2 && currentConfig.clientId) {
                // Include OAuth for open source builds
                manifest.oauth2.client_id = currentConfig.clientId;
              }
              
              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: 'src/icons', to: 'icons' },
          { from: 'src/popup/index.html', to: 'popup/index.html' },
        ],
      }),
    ],
  };
};