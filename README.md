# Qnote

Qnote 是一个私密碎片记录工具，源码按交付目标拆分维护：

| 目录 | 内容 | 说明 |
| --- | --- | --- |
| [`web/`](web/README.md) | React 网页端和 Cloudflare Pages Functions | 浏览器界面、认证、记录、热力图与文件接口。 |
| [`app/`](app/README.md) | Flutter Android 客户端 | 登录、记录、时间线、热力图、云盘、随机回顾与检查更新。 |

## 开始使用

网页端请进入 [`web/`](web/README.md)，Android 客户端请进入 [`app/`](app/README.md)。两个端都通过同一后端地址通信，客户端地址配置位于 `app/lib/constants.dart`。

## 仓库约定

- 不提交 `.env`、令牌、个人数据库、依赖目录或构建产物。
- 网页端使用 Node.js 与 npm；移动端使用 Flutter。
- 发布 APK 前递增 `app/pubspec.yaml` 的 build number，并同步更新客户端内置版本常量。

## 许可证

见 [LICENSE](LICENSE)。
存储apk
