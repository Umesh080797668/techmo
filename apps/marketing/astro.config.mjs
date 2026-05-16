import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [tailwind()],
  server: { port: 4000, host: true },
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
