import { defineConfig } from 'vite';
import path from 'path';
import envCompatible from 'vite-plugin-env-compatible';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import { ViteMinifyPlugin } from 'vite-plugin-minify';

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  resolve: {
    alias: [
        {
            find: /^~(.*)$/,
            replacement: 'node_modules/$1',
        },
    ],
    extensions: [
      '.mjs',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
      '.vue'
    ]
  },
  plugins: [
    viteCommonjs(),
    envCompatible(),
    ViteMinifyPlugin(),
  ],
  mode: 'production',
  build: {
    rollupOptions: {
      input: {
        main: './vnc.html',
        screen: './screen.html',
      },
      output: {
        entryFileNames: '[name].bundle.js'
      }
    }
  },
  define: {}
})
