# Fork 专用规则

这是本仓库的最高项目规则。与其他仓库文档冲突时，以本文件为准。

## Android 构建

- 日常 APK 只给用户的红米手机使用，默认只构建 `arm64-v8a`，不编译其他架构。
- 使用 `npm run build:apk`（`build:apk:arm64` 是同用途入口），产物为 `artifacts/paseo-dogfood-arm64.apk`，保留诊断功能，不自动启动或安装到设备。
- 用户说“编译”“打包”时，必须走上述优化构建入口；说“安装到真机”时，单台 USB 真机使用 `npm run install:apk`，它先走同一优化构建，再覆盖安装并保留数据。多台设备或无线连接时，走上述构建入口后用 `adb -s <设备序列号> install -r artifacts/paseo-dogfood-arm64.apk` 指定目标。
- 不得改走 `android:production`、`expo run:android` 或清理式 prebuild；只有用户明确要求开发版、通用包，或已确认原生配置无法增量同步时才例外，并说明原因。
- 只有用户明确要求通用 APK 时，才使用 `npm run build:apk:universal`。
- 完成全部修改后再构建；需要安装时，最后统一构建并安装一次。

## 定制功能文档

本项目的定制 Change log 是 [docs/fork-changes.md](docs/fork-changes.md)。以后新增、修改或移除自定义功能时，必须随代码同步更新这份文档，从用户视角说明当前行为、与上游的差异及适用平台。更新已有条目，删除失效内容，不只追加流水记录；代码与文档一起完成验证和提交。
