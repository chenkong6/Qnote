# Qnote 网页端

React + Vite 网页界面，以及部署到 Cloudflare Pages 的 Functions API。

## 本地运行

```powershell
cd web
npm ci
npm run dev
```

如需本地环境变量，复制 `.env.example` 为 `.env.local` 后填写自己的值。不要将该文件提交到仓库。

## 检查与构建

```powershell
npm run lint
npm run build
```

构建结果位于 `dist/`，该目录是可再生成的产物，不纳入 Git。

## 部署

Cloudflare Pages 配置见 `wrangler.toml`。Functions 位于 `functions/api/`，数据库初始化结构见 `schema.sql`。
