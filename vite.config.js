import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: repository ? `/${repository}/` : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        background: resolve('background.html'),
        toast: resolve('toast.html'),
      },
    },
  },
});
