# FlareDrive

It's a fork of [longern/FlareDrive](https://github.com/longern/FlareDrive), with a lot of new features added and other tweaks applied.

Cloudflare R2 storage manager with Workers or Pages. Free 10 GB storage.
Free serverless backend with a limit of 100,000 invocation requests per day.
[More about pricing](https://developers.cloudflare.com/r2/platform/pricing/)

- [FlareDrive](#flaredrive)
- [Features](#features)
- [Installation](#installation)
  - [Deployment to CloudFlare Workers (recommended)](#deployment-to-cloudflare-workers-recommended)
  - [Deployment to CloudFlare Pages](#deployment-to-cloudflare-pages)
- [WebDAV endpoint](#webdav-endpoint)
- [Development](#development)
  - [Run this project locally as Workers](#run-this-project-locally-as-workers)
  - [Run this project locally as Pages](#run-this-project-locally-as-pages)
- [Acknowledgments](#acknowledgments)

# Features

- Upload large files
- Upload file directly from URL ("Cloud download")
- Create folders
- Search files
- Image/video/PDF thumbnails
- WebDAV endpoint, compatible with rclone [webdav](https://rclone.org/webdav/) backend's `owncloud` vendor, support md5 hashes.
- Drag and drop upload
- Share & Publish files or folders temporarily or permanently. ("Publish" feature requires Cloudflare Workers KV)
- Images lightbox
- Online text / image files editor
- Online PDF files previewer

# Installation

Before starting, you should make sure that

- you have created a [Cloudflare](https://dash.cloudflare.com/) account
- your payment method is added
- R2 service is activated and at least one bucket is created

This project can be de deployed to [CloudFlare Workers](https://developers.cloudflare.com/workers/) or [CloudFlare Pages](https://developers.cloudflare.com/pages/).The Workers is the new and recommanded way, but it requires you to manually input the CloudFlare resource (R2 / KV) ids in the variables at this time. The Pages way is slightly simpler to configure as you can set the CloudFlare resource bindings directly in the dashboard.

## Deployment to CloudFlare Workers (recommended)

Fork this project and connect your fork with Cloudflare Workers. CloudFlare dashboard Settings:

- Build configuration:
  - Build command: `npm run build:all`
  - Deploy command: `npm run deploy`
  - Version command: `npm run cfversion`
  - Root directory: `/`
- Variables and Secrets: Set the following variables.
  - `WEBDAV_USERNAME`: username.
  - `WEBDAV_PASSWORD` password.
  - (optional) `WORKER_URL` & `WORKER_TOKEN` : The server side thumbnail generation feature requires to (manually) deploy `thumbnail_worker/forwarder.js` file to CloudFlare Worker (set the `TOKEN` variable), set them to worker url & token.
- Build - Variables and secrets. (Any changes require re-build to take effect)
  - `R2_BUCKET_NAME` : The [CloudFlare R2](https://developers.cloudflare.com/r2/) bucket name.
  - (optional) `KV_ID` : The [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) instance id.
  - (optional) `SITENAME` : Site name. Default is `FlareDrive`.
  - (optional) `FAVICON_URL` : Custom site favicon (icon) image url. It's recommended to use an .png image of 512x512 size.
  - (optional) `PUBLIC_PREFIX`, `PUBLIC_DIR_PREFIX`, `PUBLIC_RWDIR_PREFIX`. Values of each variable are comma-separated "public" path prefixes. Pathes of these prefixes are allowed to be accessed (readonly / readonly with dir listing / writable) anonymously.

## Deployment to CloudFlare Pages

Fork this project and connect your fork with Cloudflare Pages. Select `Vite` framework preset. CloudFlare dashboard Settings:

- Build command: `npm run build`
- Build output: `dist`
- Build system version: Version 3.
- Variables and Secrets: See above (the Workers version) for meanings.
  - `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`
  - (optional) `SITENAME`, `FAVICON_URL`, `WORKER_URL`, `WORKER_TOKEN`, `PUBLIC_PREFIX`, `PUBLIC_DIR_PREFIX`, `PUBLIC_RWDIR_PREFIX`.
- Bindings:
  - Bind R2 bucket to `BUCKET` name.
  - (optional) Bind Workers KV to `KV` name.

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
2. Copy `.env.sample` to `.env.local` and modify it to set environment variables. (Note: `.env.local` is used by Vite. CloudFlare Wrangler only recognizes `.dev.vars` file, running `npm run build` will automatically copy the former to the latter)
3. Copy `wrangler.sample.toml` (Running as Workers) or `wrangler.example-pages.toml` (Running as Pages) to `wrangler.toml`.

## Run this project locally as Workers

1. Run `npm run build:worker` to build worker dist file. Each time you modify the source files of `functions/*` or `lib/*`, you must re-run this build command. No watcher is available at this time.
2. Run `npm run cfdev` in terminal to start the wrangler Workers backend at `http://127.0.0.1:8788`.
3. Run `npm start` in another terminal to start [Vite](https://github.com/vitejs/vite) dev server at `http://localhost:5173/`. It will proxy API requests and forward them to wrangler backend automatically.

Open `http://localhost:5173/` in browser and it's done.

## Run this project locally as Pages

1. Run `npm run cfpagesdev` in terminal to start the wrangler Pages "functions" backend at `http://127.0.0.1:8788`. Wrangler should watch source file changes and restart itself automatically.
2. Run `npm start` in another terminal to start [Vite](https://github.com/vitejs/vite) dev server at `http://localhost:5173/`.

Same as above, open `http://localhost:5173/` in browser and it's done.

# Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
