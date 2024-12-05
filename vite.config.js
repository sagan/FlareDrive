import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// override these with env.
const DefaultVariables = {
  SITENAME: "FlareDrive",
};

// Vite only expose "VITE_" prefix envs to import.meta.env (ES2020, replace process.env)
// Use define to expose other envs.
// See: https://vite.dev/config/shared-options.html#envprefix .
// import.meta.env variables can be referenced in index.html via `%VITE_ENVNAME%` syntax.
// Note the vite projet is for CloudFlare pages project (JavaScript SPA),
// which is fullly static and runned in build time so any changes in env must be re-build to take effect.
// For functions (functions/), env is dynamic and can be changed at any time.

export default defineConfig({
  server: {
    proxy: {
      "/dav": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        secure: false,
      },
    },
    cors: true,
  },
  plugins: [react()],
  define: Object.keys(DefaultVariables).reduce((dv, key) => {
    dv[`import.meta.env.${key}`] = process.env[key] || DefaultVariables[key];
    return dv;
  }, {}),
});
