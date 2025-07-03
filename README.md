# FlareDrive

**English** | [简体中文](./README.zh-Hans.md)

It's a fork of [longern/FlareDrive](https://github.com/longern/FlareDrive), with a lot of new features added and other tweaks applied.

Cloudflare R2 storage manager with Workers or Pages. Free 10 GB storage.
Free serverless backend with a limit of 100,000 invocation requests per day.
[More about pricing](https://developers.cloudflare.com/r2/platform/pricing/)

- [FlareDrive](#flaredrive)
- [Features](#features)
- [Installation](#installation)
  - [Deployment to Cloudflare Workers (recommended)](#deployment-to-cloudflare-workers-recommended)
  - [Deployment to Cloudflare Pages](#deployment-to-cloudflare-pages)
- [WebDAV endpoint](#webdav-endpoint)
- [Development](#development)
  - [Run this project locally as Workers](#run-this-project-locally-as-workers)
  - [Run this project locally as Pages](#run-this-project-locally-as-pages)
- [Acknowledgments](#acknowledgments)

# Features

- Upload large files
- Upload file directly from URL ("Cloud download")
- Create folders
- Search files (requires Cloudflare D1 database)
- Image/video/PDF thumbnails
- WebDAV endpoint, compatible with rclone [webdav](https://rclone.org/webdav/) backend's `owncloud` vendor, support md5 hashes
- Drag and drop upload
- Share & Publish files or folders temporarily or permanently. ("Publish" feature requires Cloudflare Workers KV)
- Images lightbox
- Online text / image files editor
- Online PDF files previewer
- Create and manage "url" (internet shortcut) files

# Installation

Before starting, you should make sure that

- You have created a [Cloudflare](https://dash.cloudflare.com/) account
- R2 service is activated (requires payment method added to CF account) and at least one bucket is created
- (optional but recommended) KV & D1 instances are created.

This project can be de deployed to [Cloudflare Workers](https://developers.cloudflare.com/workers/) or [Cloudflare Pages](https://developers.cloudflare.com/pages/).The Workers is the new and recommanded way, but it requires you to manually input the Cloudflare resource (R2 / KV / D1) ids in the variables at this time. The Pages way is slightly simpler to configure as you can set the Cloudflare resource bindings directly in the dashboard.

## Deployment to Cloudflare Workers (recommended)

Fork this project and connect your fork with Cloudflare Workers. Cloudflare dashboard Settings:

- Build configuration:
  - Build command: `npm run build:all`
  - Deploy command: `npm run deploy`
  - Version command: `npm run cfversion`
  - Root directory: `/`
- Variables and Secrets: Set the following variables. (Any change take effect immediately)
  - `WEBDAV_USERNAME`: username.
  - `WEBDAV_PASSWORD` password.
  - (optional) `PUBLIC_PREFIX`, `PUBLIC_DIR_PREFIX`, `PUBLIC_RWDIR_PREFIX`. Values of each variable are comma-separated "public" path prefixes. Pathes of these prefixes are allowed to be accessed (readonly / readonly with dir listing / writable) anonymously. If `KV` is binded, these prefixes can be configured through Web UI instead.
  - (optional) `CF_ACCOUNT_ID` & `CF_ANALYTICS_TOKEN`. For access Clareflare Resources (Workers / R2 / KV / D1) usage statistics data.
    - `CF_ACCOUNT_ID`: Cloudflare Account ID. The uuid part of Cloudflare dashboard url, e.g. `https://dash.cloudflare.com/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6` => `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6` .
    - `CF_ANALYTICS_TOKEN`: Cloudflare API token of Analytics. Create one [here](https://dash.cloudflare.com/profile/api-tokens). Use `Read analytics and logs` template.
- Build - Variables and secrets. (Any change require re-build to take effect)
  - `R2_BUCKET_NAME` : The [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket name.
  - (optional) `KV_ID` : The [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) instance id.
  - (optional) `DATABASE_ID` : The [Cloudflare D1](https://developers.cloudflare.com/d1/) database id.
    - Though `KV_ID` and `DATABASE_ID` are optional, we highly recommand to set them, otherwise some features of this project won't work.
  - (optional) `SITENAME` : Site name. Default is `FlareDrive`.
  - (optional) `SHORT_SITENAME` : Short site name. Default is the same value as `SITENAME` variable.
  - (optional) `FAVICON_URL` : Custom site favicon (icon) image url. It's recommended to use an .png image of 512x512 size.
  - (optionL) `JS_URL` & `CSS_URL`: Custom JavaScript & CSS file url. If set, they will be injected in the `<head>` element of Web UI.

## Deployment to Cloudflare Pages

Fork this project and connect your fork with Cloudflare Pages. Select `Vite` framework preset. Cloudflare dashboard Settings:

- Build command: `npm run build:all-pages`
- Build output: `dist`
- Build system version: Version 3.
- Variables and Secrets: See above (the Workers version) for meanings.
  - `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`
  - (optional) `SITENAME`, `SHORT_SITENAME`, `FAVICON_URL`, `JS_URL`, `CSS_URL`, `PUBLIC_PREFIX`, `PUBLIC_DIR_PREFIX`, `PUBLIC_RWDIR_PREFIX`.
  - (optional) `CF_ACCOUNT_ID` & `CF_ANALYTICS_TOKEN`.
  - (optional) `WORKER_URL` & `WORKER_TOKEN` : The server side thumbnail generation feature uses [Cloudflare Images Resizing](https://developers.cloudflare.com/images/transform-images/bindings/), which is only supported in Workers but not Pages. To use this feature in Pages deployment, you need to (manually) deploy `workers/forwarder.js` file to Cloudflare Worker (set the `TOKEN` variable), then set these variables to worker url & token.
- Bindings:
  - Bind R2 bucket to `BUCKET` name.
  - (optional) Bind Workers KV to `KV` name.
  - (optional) Bind D1 Database to `DB` name.
  - (optional) Use wrangler CLI to deploy `workers/reindexer-do.ts` to CF as [Durable Object](https://developers.cloudflare.com/durable-objects/) (bind `BUCKET` and `DB` to the deployed DO too), than bind the DO to `REINDEXER_DO` name. It's only required in Pages mode as CF pages don't support Durable Objects directly.

You need to retry deployment for any config changes to take effect.

# WebDAV endpoint

You can use any client (such as [Cx File Explorer](https://play.google.com/store/apps/details?id=com.cxinventor.file.explorer), [BD File Manager](https://play.google.com/store/apps/details?id=com.liuzho.file.explorer))
that supports the WebDAV protocol to access your files.
Fill the endpoint URL as `https://<your-domain.com>/dav` and use the username and password you set.

However, the standard WebDAV protocol does not support large file (≥128MB) uploads due to the limitation of Cloudflare Workers.
You must upload large files through the web interface which supports chunked uploads.

The WebDAV endpoint is compatible with rclone [webdav](https://rclone.org/webdav/) backend's `owncloud` vendor, support md5 hashes. Example rclone config:

```
[flaredrive]
type = webdav
url = https://flaredrive.example.com/dav/ # replace with your domain
vendor = owncloud
user = root # WEBDAV_USERNAME
pass = obscured_password # rclone obscure <WEBDAV_PASSWORD>
encoding = None
```

# Development

Prepare development environment:

1. Run `npm i`.
2. Copy `.env.sample` to `.env.local` and modify it to set environment variables. (Note: `.env.local` is used by Vite. Cloudflare Wrangler only recognizes `.dev.vars` file, running `npm run build` will automatically copy the former to the latter)
3. Copy `wrangler.sample.toml` (Running as Workers) or `wrangler.example-pages.toml` (Running as Pages) to `wrangler.toml`.
4. Run `wrangler d1 migrations apply flaredrive --local` to apply local D1 database [migrations](https://developers.cloudflare.com/d1/reference/migrations/), which are defined inside `migrations/` folder.
5. Run `npm run codegen` to generate `graphql/generated/*.ts` files from `graphql/*.graphql` source files.

## Run this project locally as Workers

1. Run `npm run build:worker` to build worker dist file. Each time you modify the source files of `functions/*` or `lib/*`, you must re-run this build command. No watcher is available at this time.
2. Run `npm run cfdev` in terminal to start the wrangler Workers backend at `http://127.0.0.1:8787`.
3. Run `npm start` in another terminal to start [Vite](https://github.com/vitejs/vite) dev server at `http://localhost:5173/`. It will proxy API requests and forward them to wrangler backend automatically.

Open `http://localhost:5173/` in browser and it's done.

## Run this project locally as Pages

1. Run `npm run cfpagesdev` in terminal to start the wrangler Pages "functions" backend at `http://127.0.0.1:8787`. Wrangler should watch source file changes and restart itself automatically.
2. Run `npm start` in another terminal to start [Vite](https://github.com/vitejs/vite) dev server at `http://localhost:5173/`.

Same as above, open `http://localhost:5173/` in browser and it's done.

# Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
