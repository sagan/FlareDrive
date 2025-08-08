import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { favicons } from "favicons";
import { DEFAULT_SITENAME } from "./lib/constants";

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("vite run", __dirname);

// override these with ".env" / ".env.local" dotenv file or environment variables.
const DefaultPublicVariables: Record<string, string> = {
  SITENAME: DEFAULT_SITENAME,
  SHORT_SITENAME: "", // Optional, if not present, app will use SITENAME instead.
  JS_URL: "",
  CSS_URL: "",
};

// `npm run cfdev`
const backend = {
  // Wrangler 3.38.0+ changed default port from 8788 to 8787.
  // https://github.com/cloudflare/workers-sdk/issues/5534
  target: "http://127.0.0.1:8787",
  changeOrigin: true,
  secure: false,
};

// Generate wrangler.json config file (deployed as Workers)
async function generateWranglerConfig(env: Record<string, string>) {
  const templateFile = path.join(__dirname, "wrangler.example.json");
  const file = path.join(__dirname, "wrangler.json");

  const config = JSON.parse(await fs.readFile(templateFile, { encoding: "utf8" }));
  if (!env.R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME build env must be configured");
  }
  config.vars.R2_BUCKET_NAME = env.R2_BUCKET_NAME;
  config.r2_buckets = [{ binding: "BUCKET", bucket_name: env.R2_BUCKET_NAME }];
  if (env.KV_ID) {
    config.kv_namespaces = [{ binding: "KV", id: env.KV_ID }];
    config.vars.KV_ID = env.KV_ID;
  }
  if (env.DATABASE_ID) {
    config.d1_databases = [{ binding: "DB", database_name: "flaredrive", database_id: env.DATABASE_ID }];
    config.vars.DATABASE_ID = env.DATABASE_ID;
  }
  if (env.RUN_WORKER_FIRST) {
    const runWorkerFirst = JSON.parse(env.RUN_WORKER_FIRST);
    if (runWorkerFirst === true) {
      config.assets.run_worker_first = true;
    } else if (Array.isArray(runWorkerFirst)) {
      if (runWorkerFirst.includes("/*")) {
        config.assets.run_worker_first = true;
      } else {
        config.assets.run_worker_first.push(...runWorkerFirst);
      }
    } else {
      throw new Error(`invalid RUN_WORKER_FIRST value: must be either "true" or a string of JSON array`);
    }
  }
  const contents = JSON.stringify(config, null, 2);
  console.log("generate wrangler.json", contents);
  await fs.writeFile(file, contents);
}

/**
 * Generate favicon.ico, manifest.json and other files dynamically.
 */
async function generateAssets(variables: Record<string, string>) {
  const manifest = JSON.parse(await fs.readFile(path.join(__dirname, "assets/manifest.json"), { encoding: "utf8" }));

  let source: string | Buffer;
  if (!process.env.FAVICON_URL) {
    source = path.join(__dirname, "assets/favicon.png");
  } else if (process.env.FAVICON_URL.startsWith("http://") || process.env.FAVICON_URL.startsWith("https://")) {
    console.log("fetching favicon", process.env.FAVICON_URL);
    const res = await fetch(process.env.FAVICON_URL);
    source = Buffer.from(await res.arrayBuffer());
  } else {
    source = path.join(__dirname, process.env.FAVICON_URL);
  }

  const response = await favicons(source, {});
  // console.log(response.images) // Array of { name: string, contents: <buffer> }
  const faviconFiles: Record<string, string> = {
    "favicon.ico": "favicon.ico",
    "favicon-32x32.png": "assets/favicon.png",
    "android-chrome-192x192.png": "assets/favicon-192x192.png",
  };
  for (const file of response.images) {
    if (!faviconFiles[file.name]) {
      continue;
    }
    await fs.writeFile(path.join(__dirname, "public", faviconFiles[file.name]), file.contents);
  }
  manifest.name = variables.SITENAME;
  manifest.short_name = variables.SHORT_SITENAME || variables.SITENAME;
  await fs.writeFile(path.join(__dirname, "public/assets/manifest.json"), JSON.stringify(manifest, null, 2));
}

export default defineConfig(async ({ command, mode }) => {
  const env: Record<string, string> = {};
  // The type of proccess.env is `{[key: string]: string | undefined}`,
  // So we cann't use `const env = {...process.env, ...loadEnv(mode, __dirname, "")}`, which realy sucks.
  for (const [key, value] of Object.entries(process.env)) {
    if (value) {
      env[key] = value;
    }
  }
  Object.assign(env, loadEnv(mode, __dirname, ""));

  // Cloudflare Pages runtime has CF_PAGES=1 set.
  // Dynamic wrangler config file generation is only used in Cloudflare Workers mode.
  if (!env.CF_PAGES) {
    let wranglerConfigExists = false;
    try {
      await Promise.any([
        fs.access(path.join(__dirname, "wrangler.json")),
        fs.access(path.join(__dirname, "wrangler.jsonc")),
        fs.access(path.join(__dirname, "wrangler.toml")),
      ]);
      wranglerConfigExists = true;
    } catch (e) {
      /* empty */
    }
    if (!wranglerConfigExists) {
      await generateWranglerConfig(env);
    }
  }

  const publicVariables = Object.keys(DefaultPublicVariables).reduce<Record<string, string>>((v, key) => {
    if (env[key] !== undefined) {
      v[key] = env[key];
    } else {
      v[key] = DefaultPublicVariables[key];
    }
    return v;
  }, {});

  if (command === "serve") {
    try {
      // vite use ".env.local", but CF wrangler backend use .dev.vars in dev mode.
      // https://developers.cloudflare.com/workers/configuration/environment-variables/
      await fs.copyFile(path.join(__dirname, ".env.local"), path.join(__dirname, ".dev.vars"));
    } catch (e) {
      /* empty */
    }
  }

  let assetExists = false;
  try {
    await fs.access(path.join(__dirname, "public/assets/manifest.json"));
    assetExists = true;
  } catch (e) {
    /* empty */
  }
  if (!assetExists || command === "build") {
    await generateAssets(publicVariables);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builConfig: any = null;
  try {
    builConfig = JSON.parse(await fs.readFile(path.join(__dirname, "wrangler.json"), { encoding: "utf8" }));
  } catch (e) {
    /* empty */
  }
  await fs.writeFile(
    path.join(__dirname, "build_config.json"),
    JSON.stringify({
      run_worker_first: builConfig?.assets?.run_worker_first || null,
    })
  );

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
    // Note the vite projet is for Cloudflare pages project (JavaScript SPA),
    // which is fullly static and runned in build time so any changes in env must be re-build to take effect.
    // For functions (functions/), env is dynamic and can be changed at any time.
    define: Object.keys(publicVariables).reduce<Record<string, string>>((dv, key) => {
      dv[`import.meta.env.${key}`] = JSON.stringify(publicVariables[key]);
      return dv;
    }, {}),
  };
});
