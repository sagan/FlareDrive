# FlareDrive

[English](./README.md) | **简体中文**

本项目修改自 [longern/FlareDrive](https://github.com/longern/FlareDrive)，增加了大量新功能和特性。

FlareDrive 是一个基于 Cloudflare Workers 和 R2 存储构建的私有化部署文件存储和共享服务。它旨在提供一个安全、高效且易于使用的平台，用于管理您的文件，并支持多种访问方式，包括 WebDAV 和私有共享链接。

## 特性

- **基于 Cloudflare R2 存储**: 利用 Cloudflare R2 的全球分布式存储能力，提供高可用性和低延迟的文件访问。
- **Cloudflare Workers 驱动**: 后端逻辑运行在 Cloudflare Workers 上，实现无服务器、高性能的请求处理。
- **WebDAV 支持**: 通过 WebDAV 协议，您可以将 FlareDrive 挂载为本地文件系统，方便地进行文件管理。
- **安全认证**: 支持基本认证和基于签名的私有链接，确保文件访问的安全性。
- **文件共享**: 生成可配置的共享链接，支持设置过期时间、访问权限和引用(Referer)限制。（需要 Cloudflare KV）
- **缩略图生成**: 自动为图片、视频和 PDF 文件生成缩略图，提供更好的浏览体验。
- **D1 数据库集成 (可选)**: 可选集成 Cloudflare D1 数据库，用于存储文件元数据，加速文件列表读取，并且提供全局文件搜索功能。
- **可配置公开文件夹**: 支持配置公开文件夹前缀，允许匿名访问特定文件或目录。
- **在线文件查看和编辑**: 支持在线查看文本(text)、图像(image)、PDF 等格式文件；文本和图像文件同时支持在线编辑。
- **图片灯箱**: 支持以灯箱(lightbox)方式查看文件夹里所有图片。
- **创建和管理 url**: 支持创建和管理 "url" (网址链接) 文件。

## 技术栈

- **前端**: React, Material UI, TypeScript
- **后端**: Cloudflare Workers (TypeScript)
- **存储**: Cloudflare R2
- **数据库 (可选)**: Cloudflare D1
- **图像处理**: Cloudflare Images
- **认证**: HTTP Basic Auth, HMAC-SHA256 签名
- **WebDAV 协议**: [r2-webdav](https://github.com/abersheeran/r2-webdav)

## 部署

部署 FlareDrive 需要一个 Cloudflare 账户，并已经启用了 R2 存储桶功能(需要在 CF 账户里添加付费方式)。

参考 [README.md](./README.md) (English) 里的步骤。

## 使用

部署完成后，您可以通过以下方式访问 FlareDrive：

- **Web 界面**: 访问您的 Worker URL，通过 Web 界面上传、下载和管理文件。
- **WebDAV 客户端**: 使用任何支持 WebDAV 的客户端（例如 Cyberduck, Windows 文件资源管理器, macOS Finder）连接到您的 Worker URL，并使用配置的用户名和密码。
- **共享链接**: 通过 Web 界面生成私有共享链接，与他人分享文件。

本程序提供的 WebDAV 接口与 owncloud 兼容（支持 md5 hash）。使用 [rclone](https://github.com/rclone/rclone) 挂载的示例配置：

```
[flaredrive]
type = webdav
url = https://flaredrive.example.com/dav/ # replace with your domain
vendor = owncloud
user = root # WEBDAV_USERNAME
pass = obscured_password # rclone obscure <WEBDAV_PASSWORD>
encoding = None
```
