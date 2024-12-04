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
export default defineConfig({
  plugins: [react()],
  define: Object.keys(DefaultVariables).reduce((dv, key) => {
    dv[`import.meta.env.${key}`] = process.env[key] || DefaultVariables[key];
    return dv;
  }, {}),
});
