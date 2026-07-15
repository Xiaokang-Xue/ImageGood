# 参与贡献

感谢你参与 ImageGood。提交改动前，请先确认问题可以在当前 `main` 分支复现，并避免把功能修改、无关重构和格式化混在同一个 Pull Request 中。

## 开发环境

- Node.js 20 LTS
- npm 10 或与锁文件兼容的 npm 版本
- Git
- 真实集成按需准备 MySQL、图片 Provider、COS、短信、邮件或支付凭据

只进行页面和业务流程开发时，推荐使用 mock 模式，不需要外部服务。

## 分支与提交

- 从最新 `main` 创建短生命周期分支。
- 分支建议使用 `feature/`、`fix/`、`docs/`、`chore/` 前缀。
- 提交信息建议遵循 Conventional Commits，例如 `feat: add image tool entry`、`fix: stop task polling after failure`。
- 一个提交只解决一个清晰问题；不要提交构建产物、日志、用户文件或编辑器配置。

## 本地启动

```bash
git clone https://github.com/Xiaokang-Xue/ImageGood.git
cd ImageGood
npm install
cp .env.example .env.local
```

将 `.env.local` 配置为本地 JSON、mock 图片、local storage 和 mock 支付，具体值见 [README](README.md#快速开始)。

```bash
npm run db:push
npm run dev
```

## 提交前检查

```bash
npm run lint
npx tsc --noEmit
npm run build
```

冒烟测试需要一个已启动的网站进程：

```bash
npm run test:smoke
```

冒烟测试只发起只读 GET 请求，不生成图片、不创建订单、不发送短信或邮件。完整说明见 [docs/smoke-testing.md](docs/smoke-testing.md)。

## 新增图片工具

1. 在 `src/types/task.ts` 扩展任务类型，并确认旧任务仍能解析。
2. 在 `src/lib/server/image-task-service.ts` 复用现有的任务创建、执行、结果存储、失败处理和积分幂等逻辑。
3. 在 `src/app/api/images/` 新增 Route Handler，并复用登录、联系方式验证、文件校验和统一错误响应。
4. 在 `src/app/` 与 `src/components/` 增加最小页面和交互组件；不要把服务端 SDK 引入 Client Component。
5. 更新历史记录类型文案、运营统计兼容逻辑和冒烟测试入口。
6. 验证任务只在结果保存并提交成功后扣积分，任一失败分支均不扣积分。

优先参考现有 `image-enhancer` 或 `object-remover` 链路，不要在 Route Handler 中复制整套任务业务逻辑。

## 新增或替换图片 Provider

1. 实现 `src/lib/server/image-provider.ts` 中的 `ImageProviderService` 契约。
2. Provider 文件必须是服务端代码，API Key 不得使用 `NEXT_PUBLIC_` 前缀。
3. 在 `getImageProviderService()` 中增加显式选择逻辑，并保留 `IMAGE_API_MODE=mock`。
4. 将第三方错误转换为可理解的服务端错误；日志不得包含密钥、完整提示词、图片内容或个人信息。
5. 用 mock 或测试替身覆盖生成、编辑、空结果和异常分支；不要在 CI 中调用真实模型。
6. 同步更新 `.env.example` 和 `docs/configuration.md`，只写变量名与安全示例。

## Issue 与 Pull Request

- Bug 请提供最小复现步骤、预期结果、实际结果、运行模式和脱敏日志。
- 功能请求请描述用户问题、建议范围和不应改变的现有行为。
- PR 需说明改动范围、验证命令、风险和必要的回滚方式。
- 页面改动请附桌面端与移动端截图；涉及数据迁移时必须附兼容与回滚说明。
- 维护者可能要求拆分过大的 PR。

## 数据与密钥

禁止提交或粘贴：

- `.env.local`、API Key、Webhook、数据库密码和连接凭据。
- `.pem`、商户私钥、平台证书和短信 / 邮件密码。
- 真实用户图片、手机号、邮箱、订单、支付通知或数据库导出。
- 生产日志中的完整用户 ID、任务输入和内部路径。

发现漏洞时不要创建公开 Issue，请遵循 [SECURITY.md](SECURITY.md)。参与项目即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
