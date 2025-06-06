# FlareDrive

It's a fork of [longern/FlareDrive](https://github.com/longern/FlareDrive), with a lot of new features added and other tweaks applied.

Cloudflare R2 storage manager with Pages and Workers. Free 10 GB storage.
Free serverless backend with a limit of 100,000 invocation requests per day.
[More about pricing](https://developers.cloudflare.com/r2/platform/pricing/)

- [FlareDrive](#flaredrive)
- [Features](#features)
- [Usage](#usage)
  - [Installation](#installation)
  - [WebDAV endpoint](#webdav-endpoint)
- [Development](#development)
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

# Usage

## Installation

Before starting, you should make sure that

- you have created a [Cloudflare](https://dash.cloudflare.com/) account
- your payment method is added
- R2 service is activated and at least one bucket is created

Steps:

1. Fork this project and connect your fork with Cloudflare Pages. Use `Vite` framework preset.
   - Build command: `npm run build`
   - Build output: `dist`
   - Set `WEBDAV_USERNAME` and `WEBDAV_PASSWORD` variables. The later should be set as a secret.
2. After initial deployment, bind your R2 bucket to `BUCKET` name.
3. Retry deployment in `Deployments` page to apply the changes
4. (Optional) Add a custom domain

If you want to deploy this project using [Wrangler](https://developers.cloudflare.com/workers/wrangler/), create a `wrangler.toml` config file from `wrangler.sample.toml` and modify it.

Optional config

- Variables & Secrets:
  - `SITENAME` : Site name. Default is `FlareDrive`.
  - `FAVICON_URL` : Custom site favicon (icon) image url. It's recommended to use an .png image of 512x512 size.
  - `WORKER_URL` & `WORKER_TOKEN` : The server side thumbnail generation feature requires to (manually) deploy `thumbnail_worker/forwarder.js` file to CloudFlare Worker (set the `TOKEN` variable), set them to worker url & token.
- Bindings:
  - `KV` : Bind to CloudFlare KV namespace. Required by "publish" feature.

You need to retry deployment for any config changes to take effect.

## WebDAV endpoint

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
2. Copy `.env.sample` to `.env.local` and modify it to set environment variables.
3. Copy `wrangler.sample.toml` to `wrangler.toml`.

Run this project locally:

1. Run `npm run cfdev` in terminal to start the wrangler CLI backend at http://127.0.0.1:8788.
2. Run `npm start` in another terminal to start [Vite](https://github.com/vitejs/vite) dev server at `http://localhost:5173/`. It will proxy API requests and forward them to wrangler backend automatically.

Open `http://localhost:5173/` in browser and it's done.

# Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
