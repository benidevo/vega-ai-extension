const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const packageJson = require('./package.json');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

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
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify('460747486884-p36vju3iqsmtgg8968jqnck6s4ga296r.apps.googleusercontent.com'),
        'process.env.APP_VERSION': JSON.stringify(packageJson.version),
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
              manifest.version = packageJson.version;

              manifest.oauth2 = {
                client_id: '460747486884-p36vju3iqsmtgg8968jqnck6s4ga296r.apps.googleusercontent.com',
                scopes: ["openid", "email"]
              };

              if (isProduction) {
                manifest.host_permissions = [
                  "https://*.linkedin.com/jobs/*"
                ];
              } else {
                manifest.host_permissions = [
                  "https://*.linkedin.com/jobs/*",
                  "http://localhost:*/*"
                ];
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