import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { CLIENT_PORT } from "../shared/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: CLIENT_PORT,
    strictPort: true,
  },
  resolve: {
    alias: {
      'shared': '/../shared',
      'components': '/src/components',
      'repos': '/src/repos',
      'settings': '/src/settings',
      'analysis': '/src/analysis',
      'reducers': '/src/reducers',
      'state': '/src/state.tsx',
      'types': '/src/types',
      'requests': '/src/requests',
      'cookies': '/src/cookies',
      'date': '/src/date',
      'arrays': '/src/arrays',
      'utils': '/src/utils',
    },
  },
});
