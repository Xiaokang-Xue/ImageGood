# ImageGood 配置说明

本文件说明各环境变量的用途和启用条件。变量模板以项目根目录 [.env.example](../.env.example) 为准；真实密钥只保存在服务器 `.env.local`。

## 配置原则

- 客户端可见变量只有明确使用 `NEXT_PUBLIC_` 前缀的内容。
- API Key、数据库密码、短信、SMTP、COS 和支付密钥不得使用 `NEXT_PUBLIC_` 前缀。
- `.env.local`、私钥和证书已加入 `.gitignore`，不要强制提交。
- 修改域名后，要同步更新应用地址、支付回调和支付完成返回地址。

## 本地开发配置

以下配置不调用真实模型或支付平台，适合页面和业务流程调试：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=请替换为本地随机字符串
AUTH_COOKIE_SECURE=false

DATABASE_URL=file:./dev.db

IMAGE_API_MODE=mock
IMAGE_STORAGE_PROVIDER=local

PAYMENT_PROVIDER=alipay
PAYMENT_MODE=mock
```

初始化本地 JSON 数据文件：

```bash
npm run db:push
```

## 生产基础配置

```env
NEXT_PUBLIC_APP_URL=https://imagegood.net
AUTH_SECRET=请使用高强度随机字符串
AUTH_COOKIE_SECURE=true

DATABASE_URL=mysql://user:password@host:3306/image_good?connection_limit=5
MYSQL_CONNECTION_LIMIT=5

IMAGE_API_MODE=real
IMAGE_STORAGE_PROVIDER=cos

PAYMENT_MODE=real
PAYMENT_PROVIDER=alipay
```

## 基础变量

| 变量 | 用途 | 必填条件 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | 网站公开地址，用于邮件和支付返回链接 | 始终 |
| `AUTH_SECRET` | 会话签名密钥 | 始终 |
| `AUTH_COOKIE_SECURE` | 是否只通过 HTTPS 发送登录 Cookie | 生产环境设为 `true` |
| `DATABASE_URL` | `file:` 本地 JSON 或 `mysql://` MySQL 地址 | 始终 |
| `MYSQL_CONNECTION_LIMIT` | MySQL 连接池上限 | 使用 MySQL 时 |

## 图片 Provider

### OpenAI-compatible API

```env
IMAGE_API_MODE=real
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
OPENAI_API_KEY=
OPENAI_BASE_URL=https://你的兼容接口地址/v1
```

| 变量 | 用途 |
| --- | --- |
| `IMAGE_MODEL` | 请求使用的图片模型名称 |
| `OPENAI_API_KEY` | 服务端图片接口密钥 |
| `OPENAI_BASE_URL` | 兼容接口地址；留空时由 SDK 使用默认地址 |

模型名和接口能力必须以实际服务提供方为准。配置中转服务时，`OPENAI_BASE_URL` 应指向其 OpenAI-compatible `/v1` 地址。

### 图片输入格式

- 用户可上传 JPEG、PNG、WebP；HEIC、HEIF、AVIF、TIFF、GIF、BMP 也会被识别。
- 合规的标准 PNG 保留原始文件；其他格式会在创建生成任务前统一转换为单帧、8 位、sRGB PNG，避免不同图片 Provider 对 JPEG、WebP 和 HEIC 容器支持不一致。
- CMYK、灰度、调色板、16 位或多帧图片会在任务创建前转换；动画图片使用第一帧。
- 原始上传文件上限为 50MB。模型输入内部上限为 10MB，仅在转换结果仍超限时按文件体积等比缩小，不设置固定最长边。
- 无法解码、内容损坏或不属于上述光栅图片格式的文件会在任务创建前被拒绝，不会调用模型或扣除积分。

格式兼容回归检查：

```bash
npm run test:image-formats
```

服务器上可使用一张真实 iPhone HEIC 照片验证完整解码链路；该命令只做本地格式转换，不会调用模型或扣除积分：

```bash
npm run test:image-formats -- --heic-file=/path/to/photo.heic
```

### Python Codex 服务

```env
IMAGE_API_MODE=real
IMAGE_PROVIDER=codex
CODEX_IMAGE_API_BASE_URL=http://127.0.0.1:8000
CODEX_IMAGE_API_TIMEOUT_SECONDS=900
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs
CODEX_RESULT_GRACE_SECONDS=900
CODEX_MODEL=
```

Codex 服务只建议监听 `127.0.0.1`。启动和检查方式见 [Codex 服务部署](deploy-codex-server.md)。

## 腾讯云 COS

```env
IMAGE_STORAGE_PROVIDER=cos
TENCENT_COS_ENABLED=true
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_REGION=ap-beijing
TENCENT_COS_BUCKET=
TENCENT_COS_KEY_PREFIX=imageGood
TENCENT_COS_PUBLIC_BASE_URL=
TENCENT_COS_USE_PROXY=true
TENCENT_COS_CLEAN_LOCAL_TASK_DIR=false
```

| 变量 | 用途 |
| --- | --- |
| `TENCENT_COS_PUBLIC_BASE_URL` | 可选的公开 Bucket 或 CDN 地址 |
| `TENCENT_COS_USE_PROXY` | 通过网站受保护接口读取私有 COS 图片 |
| `TENCENT_COS_CLEAN_LOCAL_TASK_DIR` | 上传成功后清理对应任务临时目录 |

清理开关只针对 `/data/codex_image_api_runs/tasks/{taskId}`，不会扫描项目外的其他目录。

## 邮件与短信

SMTP 用于邮箱验证和密码找回：

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ImageGood <noreply@example.com>"
EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES=30
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

阿里云短信用于手机号验证码：

```env
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
ALIYUN_SMS_REGION_ID=cn-hangzhou
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
SMS_CODE_EXPIRE_MINUTES=5
SMS_CODE_RESEND_SECONDS=60
```

短信签名和模板必须先在阿里云控制台审核通过。

## 支付

### 通用配置

```env
PAYMENT_PROVIDER=alipay
PAYMENT_MODE=real
ENABLE_PAYMENT_TEST_PACKAGE=false
```

`PAYMENT_MODE=mock` 只用于本地调试；真实环境必须使用 `real`。

### 微信支付 APIv3

```env
WECHAT_PAY_APPID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_MERCHANT_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_PLATFORM_CERT_SERIAL_NO=
WECHAT_PAY_PLATFORM_CERT_PATH=
WECHAT_PAY_NOTIFY_URL=https://你的域名/api/payment/wechat/notify
```

私钥和平台证书应存放在服务器受权限保护的目录，通过绝对路径引用。

### 支付宝电脑网站支付

```env
ALIPAY_ENABLED=true
ALIPAY_APP_ID=
ALIPAY_APP_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_SIGN_TYPE=RSA2
ALIPAY_NOTIFY_URL=https://你的域名/api/payment/alipay/notify
ALIPAY_RETURN_URL=https://你的域名/checkout/alipay/return
```

当前支付代码使用普通公钥模式。证书模式路径变量保留在 `.env.example`，当前流程可留空。

支付回调必须公网可访问并使用 HTTPS。`return_url` 仅负责页面跳转，积分到账以异步通知验签、订单号和金额校验结果为准。

## 飞书运营日报

```env
FEISHU_BOT_WEBHOOK=
FEISHU_BOT_SECRET=
FEISHU_DAILY_REPORT_RANGE=yesterday
```

手动验证：

```bash
npm run ops:daily-report
```

每天北京时间 08:00 推送昨日数据：

```bash
mkdir -p /data/Photoshop/logs
crontab -e
```

```cron
0 8 * * * /bin/bash -lc 'cd /data/Photoshop && npm run ops:daily-report >> /data/Photoshop/logs/feishu-daily-report.log 2>&1'
```

如果手动发送成功但定时任务未执行，请检查 `crontab -l`、服务器时区、`npm` 的绝对路径和日志文件。

## 上线检查

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:smoke -- --base-url=https://你的域名
```

确认事项：

- `.env.local` 未进入 Git。
- 数据库、COS、SMTP 和短信均可从服务器访问。
- 微信与支付宝回调地址可以从公网访问。
- 生产 Cookie 使用 HTTPS。
- 图片 Provider 与模型名称和实际服务能力一致。
- 修改依赖后已执行 `npm ci` 并重启服务。
