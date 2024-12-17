import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { favicons } from "favicons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// override these with ".env" / ".env.local" dotenv file or environment variables.
const DefaultPublicVariables = {
  SITENAME: "FlareDrive",
  SHORT_SITENAME: "", // Optional, if not present, app will use SITENAME instead.
};

// `npm run cfdev`
const backend = {
  target: "http://127.0.0.1:8788",
  changeOrigin: true,
  secure: false,
};

/**
 * Generate favicon.ico, manifest.json and other files dynamically.
 */
async function generateAssets(variables) {
  const manifest = JSON.parse(await fs.readFile(__dirname + "/assets/manifest.json", { encoding: "utf8" }));

  let source = "";
  if (!process.env.FAVICON_URL) {
    source = path.join(__dirname, "assets/favicon.png");
  } else if (process.env.FAVICON_URL.startsWith("http://") || process.env.FAVICON_URL.startsWith("https://")) {
    console.log("fetching favicon", process.env.FAVICON_URL);
    let res = await fetch(process.env.FAVICON_URL);
    source = Buffer.from(await res.arrayBuffer());
  } else {
    source = path.join(__dirname, process.env.FAVICON_URL);
  }

  const response = await favicons(source, {});
  // console.log(response.images) // Array of { name: string, contents: <buffer> }
  const faviconFiles = {
    "favicon.ico": "favicon.ico",
    "favicon-32x32.png": "favicon.png",
    "android-chrome-192x192.png": "favicon-192x192.png",
  };
  for (let file of response.images) {
    if (!faviconFiles[file.name]) {
      continue;
    }
    await fs.writeFile(path.join(__dirname, "public", faviconFiles[file.name]), file.contents);
  }
  manifest.name = variables.SITENAME;
  manifest.short_name = variables.SHORT_SITENAME || variables.SITENAME;
  fs.writeFile(path.join(__dirname, "public/manifest.json"), JSON.stringify(manifest, null, 2));
}

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const publicVariables = Object.keys(DefaultPublicVariables).reduce((v, key) => {
    if (env[key] !== undefined) {
      v[key] = env[key];
    } else {
      v[key] = DefaultPublicVariables[key];
    }
    return v;
  }, {});

  if (command === "serve") {
    try {
      // CF wrangler backend use .dev.vars in dev mode.
      // https://developers.cloudflare.com/workers/configuration/environment-variables/
      fs.copyFile(path.join(__dirname, ".env.local"), path.join(__dirname, ".dev.vars"));
    } catch (e) {}
  }

  let assetExists = false;
  try {
    await fs.access(path.join(__dirname, "public/manifest.json"));
    assetExists = true;
  } catch (e) {}
  if (!assetExists || command === "build") {
    await generateAssets(publicVariables);
  }

  return {
    server: {
      proxy: {
        "/api/": backend,
        "/dav/": backend,
        "/s/": backend,
      },
    },
    plugins: [react()],

    // Vite only expose "VITE_" prefix envs to import.meta.env (ES2020, replace process.env)
    // Use define to expose other envs.
    // See: https://vite.dev/config/shared-options.html#envprefix .
    // import.meta.env variables can be referenced in index.html via `%VITE_ENVNAME%` syntax.
    // Note the vite projet is for CloudFlare pages project (JavaScript SPA),
    // which is fullly static and runned in build time so any changes in env must be re-build to take effect.
    // For functions (functions/), env is dynamic and can be changed at any time.
    define: Object.keys(publicVariables).reduce((dv, key) => {
      dv[`import.meta.env.${key}`] = JSON.stringify(publicVariables[key]);
      return dv;
    }, {}),
  };
});
