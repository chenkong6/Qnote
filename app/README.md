# Qnote Flutter 客户端

Qnote 的 Android 移动客户端，使用 Flutter 编写。

## 准备

```powershell
cd app
flutter pub get
```

部署前在 `lib/constants.dart` 配置后端地址。这里不应填写密码、JWT 或任何服务端密钥。

## 检查

```powershell
dart format lib test
flutter analyze
```

## Android Release APK

```powershell
flutter build apk --release --target-platform android-arm64 --split-per-abi --obfuscate --split-debug-info=build\symbols
```

输出文件通常为：

```text
build\app\outputs\flutter-apk\app-arm64-v8a-release.apk
```

每次发布前，请递增 `pubspec.yaml` 内 `version` 的 build number；若启用了应用内更新，也请同步更新 `lib/constants.dart` 中的版本和 build 常量。
