import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    // Local assessment previews must not be copied into the public deployment.
    publicDir: mode === 'production' ? 'public-site' : 'public',
    server: {
      host: 'localhost', port: Number(env.WEB_PORT || 5173), strictPort: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.data/**'] },
      proxy: { '/api': `http://127.0.0.1:${env.API_PORT || 3001}` },
    },
    build: { outDir: '../../build/web', emptyOutDir: true },
  };
});
