# ImageGood

ImageGood 是一个面向用户的在线 AI 图片编辑与生成网站，支持智能修图、商品图生成、封面海报生成、用户登录、生成记录和额度管理等核心能力。

## 项目简介

ImageGood 是一个 AI P 图网站 MVP。用户可以上传图片，通过自然语言描述完成图片修改，例如换背景、画面增强、商品图生成和封面海报生成。

项目采用 Next.js 构建前端页面和业务 API，图片生成能力通过服务端接口转发到独立的 Python Codex 图片服务。浏览器不会直接访问图片生成服务，也不会接触敏感密钥。

当前项目支持通过 Codex 图片服务完成真实图片生成，同时保留开发环境下的本地调试模式，方便在没有完整图片服务时进行页面和流程验证。

## 核心功能

### 用户系统

- 用户注册、登录和退出登录
- httpOnly Cookie 登录态保持
- 用户中心
- 修改密码
- 本地算术验证码
- 本地开发模式下的忘记密码流程
- 用户生成历史记录

### 图片生成能力

- 智能修图
- 换背景
- 去杂物与局部修改能力预留
- 商品图生成
- 封面海报生成
- 生成结果展示与下载

### 任务与记录

- 图片生成任务记录
- 当前用户历史记录
- 生成中、成功、失败等状态展示
- 图片服务异常、超时、积分不足等错误提示

### 额度与付费基础

- 新用户注册赠送 1 次免费生成额度
- 每次图片生成消耗 1 个积分
- 积分余额展示
- 微信支付 Native 扫码支付
- 支付成功后自动增加积分
- 管理员订单查看与异常补发

### 服务端能力

- Next.js API Routes 承载业务接口
- Python Codex 图片服务承载实际出图任务
- 服务端调用图片生成接口
- 腾讯云 COS 对象存储，可用于保存用户上传图和生成结果图
- 环境变量集中配置
- 敏感密钥只在服务端读取，不暴露到前端

## 技术栈

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Node.js
- Node `crypto.scrypt` 密码哈希
- httpOnly Cookie Session
- 本地文件数据库或 MySQL 数据库，连接方式由 `DATABASE_URL` 控制
- Python 3
- Codex CLI / Codex 图片服务
- OpenAI SDK，可选用于 OpenAI Images API 模式
- 腾讯云 COS Node.js SDK，可选用于对象存储模式

## 项目结构

```text
ai-image-studio/
├── docs/                         # 部署和运维相关文档
├── public/                       # 静态资源与生成图片目录
├── scripts/                      # 本地数据库初始化脚本
├── server/
│   ├── codex_image_api.py        # Python Codex 图片服务
│   └── check_codex_image_api.sh  # 图片服务检查脚本
├── src/
│   ├── app/                      # Next.js 页面与 API Routes
│   │   ├── api/                  # 登录、任务、订单、图片生成等接口
│   │   ├── editor/               # 智能修图工作台
│   │   ├── product/              # 商品图生成
│   │   ├── poster/               # 封面海报生成
│   │   ├── account/              # 用户中心
│   │   ├── history/              # 生成历史记录
│   │   ├── pricing/              # 积分包页面
│   │   └── page.tsx              # 首页
│   ├── components/               # 页面组件与通用 UI
│   ├── lib/                      # 认证、数据库、图片服务、业务工具
│   └── types/                    # TypeScript 类型定义
├── .env.example                  # 环境变量示例
├── next.config.mjs               # Next.js 配置
├── package.json                  # 项目脚本与依赖
└── README.md
```

## 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/porfavorrr/ai-image-studio.git
cd ai-image-studio
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

`.env.local` 推荐配置：

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="please-change-this-secret"
AUTH_COOKIE_SECURE=false

NEXT_PUBLIC_APP_URL=http://localhost:3000

PAYMENT_PROVIDER=wechat
PAYMENT_MODE=mock
WECHAT_PAY_APPID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_MERCHANT_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_PLATFORM_CERT_SERIAL_NO=
WECHAT_PAY_PLATFORM_CERT_PATH=
WECHAT_PAY_NOTIFY_URL=

IMAGE_API_MODE=real
IMAGE_PROVIDER=codex
IMAGE_STORAGE_PROVIDER=local
CODEX_IMAGE_API_BASE_URL=http://127.0.0.1:8000
CODEX_IMAGE_API_TIMEOUT_SECONDS=900

OPENAI_API_KEY=
IMAGE_MODEL=gpt-image-1
```

使用 Codex 图片服务时，`OPENAI_API_KEY` 可以不填。部署时请务必把 `AUTH_SECRET` 改成足够长的随机字符串。

如果需要把用户上传图片和生成结果保存到腾讯云 COS，请将图片存储切换为 COS，并配置：

```env
IMAGE_STORAGE_PROVIDER=cos
TENCENT_COS_ENABLED=true
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_REGION=ap-beijing
TENCENT_COS_BUCKET=
TENCENT_COS_KEY_PREFIX=imageGood
TENCENT_COS_USE_PROXY=true
TENCENT_COS_PUBLIC_BASE_URL=
TENCENT_COS_CLEAN_LOCAL_TASK_DIR=false
```

`TENCENT_COS_USE_PROXY=true` 时，前端会通过 `/api/storage/images/...` 受控读取 COS 图片，适合私有桶。若配置了公开读 CDN 或桶域名，可以填写 `TENCENT_COS_PUBLIC_BASE_URL` 并按需关闭代理。

### 4. 初始化数据库

本地开发可以使用内置文件数据库；服务器正式运行可以使用 MySQL。项目会根据 `DATABASE_URL` 自动判断存储方式。

```bash
npm run db:generate
npm run db:push
```

如果 `DATABASE_URL` 使用 `file:`，会创建对应的本地数据库文件；如果使用 `mysql://`，会初始化 MySQL 表结构。

### 5. 启动 Codex 图片服务

另开一个终端运行：

```bash
mkdir -p /data/codex_image_api_runs

HOST=127.0.0.1 \
PORT=8000 \
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs \
python3 server/codex_image_api.py
```

检查服务是否启动：

```bash
curl http://127.0.0.1:8000/health
```

该服务建议只监听 `127.0.0.1`，不要直接暴露到公网。Next.js 网站会通过 `CODEX_IMAGE_API_BASE_URL` 在服务端调用它。

### 6. 启动 Next.js 网站

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

## 服务器部署

以下流程适合 Linux 服务器的基础部署。

### 1. 拉取项目并安装依赖

```bash
cd /opt
git clone https://github.com/porfavorrr/ai-image-studio.git
cd ai-image-studio
npm install
cp .env.example .env.local
nano .env.local
```

### 2. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 3. 启动图片服务

```bash
mkdir -p /data/codex_image_api_runs

HOST=127.0.0.1 \
PORT=8000 \
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs \
python3 server/codex_image_api.py
```

### 4. 开发方式外网访问

```bash
npm run dev -- -H 0.0.0.0
```

访问：

```text
http://服务器IP:3000
```

服务器安全组或防火墙需要开放 `3000` 端口。不要开放 Python 图片服务的 `8000` 端口。

### 5. 生产构建与启动

```bash
npm run build
npm run start -- -H 0.0.0.0
```

生产环境建议使用 Nginx 反向代理到 Next.js 服务，并配置 HTTPS。

### 6. 使用 PM2 守护进程

安装 PM2：

```bash
npm install -g pm2
```

启动 Next.js 网站：

```bash
pm2 start npm --name ai-image-studio -- run start -- -H 0.0.0.0
```

启动 Codex 图片服务：

```bash
pm2 start bash --name codex-image-api -- -c "HOST=127.0.0.1 PORT=8000 CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs python3 server/codex_image_api.py"
```

保存进程列表：

```bash
pm2 save
```

## 环境变量说明

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `DATABASE_URL` | 数据库地址，支持 `file:` 或 `mysql://` | `file:./dev.db` |
| `AUTH_SECRET` | 登录会话、验证码和重置密码 token 的签名密钥 | `please-change-this-secret` |
| `AUTH_COOKIE_SECURE` | Cookie 是否只允许 HTTPS 发送 | `false` |
| `NEXT_PUBLIC_APP_URL` | 网站访问地址，用于生成回调和本地调试链接 | `http://localhost:3000` |
| `PAYMENT_PROVIDER` | 支付服务提供方 | `wechat` |
| `PAYMENT_MODE` | 支付模式，`mock` 用于本地调试，`real` 调用微信支付 | `mock` / `real` |
| `WECHAT_PAY_APPID` | 微信支付绑定的 APPID | `wx...` |
| `WECHAT_PAY_MCH_ID` | 微信支付商户号 | `1900000000` |
| `WECHAT_PAY_API_V3_KEY` | 微信支付 APIv3 密钥，只能放在服务端环境变量 | `32 位密钥` |
| `WECHAT_PAY_MERCHANT_SERIAL_NO` | 商户 API 证书序列号 | `证书序列号` |
| `WECHAT_PAY_PRIVATE_KEY_PATH` | 商户 API 私钥文件路径 | `/etc/ai-image-studio/certs/apiclient_key.pem` |
| `WECHAT_PAY_PLATFORM_CERT_SERIAL_NO` | 微信支付平台证书序列号，用于匹配回调头 `Wechatpay-Serial` | `平台证书序列号` |
| `WECHAT_PAY_PLATFORM_CERT_PATH` | 微信支付平台证书 PEM 文件路径，用于回调验签 | `/etc/ai-image-studio/certs/wechatpay_platform_cert.pem` |
| `WECHAT_PAY_NOTIFY_URL` | 微信支付异步通知地址，正式环境必须公网 HTTPS 可访问 | `https://example.com/api/payment/wechat/notify` |
| `IMAGE_API_MODE` | 图片生成模式 | `real` / `mock` |
| `IMAGE_PROVIDER` | 图片生成服务提供方 | `codex` |
| `IMAGE_STORAGE_PROVIDER` | 图片文件存储方式，`local` 为本地，`cos` 为腾讯云 COS | `local` / `cos` |
| `CODEX_IMAGE_API_BASE_URL` | Codex 图片服务地址 | `http://127.0.0.1:8000` |
| `CODEX_IMAGE_API_TIMEOUT_SECONDS` | 图片生成请求超时时间 | `900` |
| `TENCENT_COS_ENABLED` | 是否启用腾讯云 COS 存储 | `true` / `false` |
| `TENCENT_COS_SECRET_ID` | 腾讯云 SecretId，只能放在服务端环境变量 | `AKID...` |
| `TENCENT_COS_SECRET_KEY` | 腾讯云 SecretKey，只能放在服务端环境变量 | `***` |
| `TENCENT_COS_REGION` | COS Bucket 所在地域 | `ap-beijing` |
| `TENCENT_COS_BUCKET` | COS Bucket 名称 | `example-1234567890` |
| `TENCENT_COS_KEY_PREFIX` | COS 对象 key 前缀 | `imageGood` |
| `TENCENT_COS_USE_PROXY` | 是否通过 Next.js 受控代理读取 COS 图片 | `true` |
| `TENCENT_COS_PUBLIC_BASE_URL` | 公开读桶或 CDN 域名，可选 | `https://cdn.example.com` |
| `TENCENT_COS_CLEAN_LOCAL_TASK_DIR` | COS 上传并写库成功后清理当前 Codex 任务目录 | `false` |
| `OPENAI_API_KEY` | OpenAI API Key，可选 | `sk-xxx` |
| `IMAGE_MODEL` | OpenAI 图片模型名称，可选 | `gpt-image-1` |

## 图片生成服务说明

ImageGood 由两层服务组成：

```text
浏览器
  ↓
Next.js 网站 / API
  ↓
Codex 图片服务 127.0.0.1:8000
  ↓
生成图片并返回结果
```

Next.js 网站负责前端页面、用户系统、积分订单、任务记录和业务 API。Python Codex 图片服务负责调用本机 Codex CLI 完成实际出图。

前端只调用 Next.js API，不直接访问 Python 图片服务。这样可以避免把内部服务地址、密钥或执行环境暴露给浏览器。

## 图片对象存储

ImageGood 支持将图片文件保存到腾讯云 COS，适合服务器磁盘空间有限的部署场景。

启用后，系统只会上传当前业务任务产生的文件：

- 用户上传原图：`imageGood/users/{userId}/tasks/{taskId}/input.{ext}`
- AI 生成结果：`imageGood/users/{userId}/tasks/{taskId}/result.{ext}`

系统不会扫描或批量上传服务器目录，也不会把 `/data/codex_image_api_runs` 下的其他任务文件放入 COS。

推荐配置：

```env
IMAGE_STORAGE_PROVIDER=cos
TENCENT_COS_ENABLED=true
TENCENT_COS_SECRET_ID=你的 SecretId
TENCENT_COS_SECRET_KEY=你的 SecretKey
TENCENT_COS_REGION=ap-beijing
TENCENT_COS_BUCKET=你的 Bucket
TENCENT_COS_KEY_PREFIX=imageGood
TENCENT_COS_USE_PROXY=true
```

如果 COS 桶为私有读，保持 `TENCENT_COS_USE_PROXY=true`。前端图片地址会保存为 `/api/storage/images/...`，服务端会校验登录用户是否拥有对应任务，再从 COS 读取图片返回浏览器。

如果你已经配置了公开读桶或 CDN 域名，可以设置：

```env
TENCENT_COS_PUBLIC_BASE_URL=https://你的图片域名
TENCENT_COS_USE_PROXY=false
```

为了进一步减少本地磁盘占用，可以在确认 COS 上传与历史记录展示稳定后开启：

```env
TENCENT_COS_CLEAN_LOCAL_TASK_DIR=true
```

该开关只会删除当前任务目录 `/data/codex_image_api_runs/tasks/{taskId}`，不会删除 `CODEX_IMAGE_API_WORKDIR` 根目录，也不会处理其他服务器目录。

## 使用流程

1. 注册账号。
2. 登录网站。
3. 进入智能修图、商品图生成或封面海报生成页面。
4. 上传图片或填写生成内容。
5. 输入图片处理需求。
6. 点击生成图片。
7. 下载生成结果。
8. 在历史记录中查看之前的生成内容。

## 额度与微信支付

当前项目内置积分额度体系：

- 新用户注册后获得 1 个免费积分。
- 每次图片生成消耗 1 个积分。
- 生成失败不会扣除积分。
- 积分不足时，系统会引导用户进入 `/pricing` 购买积分。

内置积分包：

| 套餐 | 价格 | 积分 | 折算单价 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 体验包 | ¥6.9 | 10 次 | ¥0.69/次 | 适合轻量体验 |
| 标准包 | ¥19.9 | 40 次 | ¥0.50/次 | 适合日常修图 |
| 高级包 | ¥49.9 | 120 次 | ¥0.42/次 | 适合内容创作者 |
| 专业包 | ¥99 | 300 次 | ¥0.33/次 | 适合高频使用 |

当前正式购买流程使用微信支付 Native 扫码支付：

1. 用户在 `/pricing` 选择积分包。
2. Next.js 服务端创建本地订单，并调用微信支付 Native 下单接口。
3. 微信支付返回 `code_url`，前端在 `/checkout/[orderId]` 展示二维码。
4. 用户使用微信扫码支付。
5. 微信支付通过 `/api/payment/wechat/notify` 发送异步回调。
6. 服务端验签、解密回调数据、校验商户订单号和金额。
7. 订单更新为 `paid`，用户积分自动到账，并写入积分流水。

本地调试可以使用：

```env
PAYMENT_PROVIDER=wechat
PAYMENT_MODE=mock
```

`PAYMENT_MODE=mock` 时，系统不会请求微信支付真实接口，checkout 页面会展示调试二维码和“模拟支付成功”按钮。该按钮只在 mock 模式显示，real 模式不会出现。

正式环境需要：

- 微信支付 APPID
- 商户号
- APIv3 密钥
- 商户 API 证书序列号
- 商户 API 私钥文件 `apiclient_key.pem`
- 微信支付平台证书 PEM 文件
- 公网 HTTPS 域名
- 可被微信服务器访问的 `WECHAT_PAY_NOTIFY_URL`

商户私钥和微信支付平台证书只应放在服务器文件系统中，通过环境变量配置路径，不要放入 Git 仓库。微信支付 APIv3 密钥也只能放在服务端环境变量中，不能暴露给浏览器。

支付回调链路：

```text
微信支付服务器
  ↓
POST /api/payment/wechat/notify
  ↓
验签 + AES-256-GCM 解密 resource
  ↓
校验金额、商户订单号和交易状态
  ↓
订单标记为已支付并自动增加积分
```

`/admin/orders` 用于管理员查看订单状态，并保留异常补发积分能力。正常订单不需要管理员确认，支付成功后由微信支付回调自动处理。

设置管理员：

- 当前项目没有写死管理员账号。
- 文件数据库模式下，在本地数据库文件中找到目标用户，将该用户的 `role` 从 `"user"` 改为 `"admin"`。
- MySQL 模式下，在 `imagegood_records` 表中找到 `collection = 'users'` 的目标用户记录，更新该 JSON 记录里的 `role` 为 `"admin"`。
- 重启服务后，该用户即可访问 `/admin/orders`。

## 开发状态

当前项目处于 MVP 阶段，已完成基础用户流程、图片生成链路、任务记录、额度系统和主要页面。它已经具备继续迭代为正式 AI 图片工具产品的基础结构。

部分能力仍适合在正式上线前继续增强，例如后台管理、局部涂抹编辑和更完整的生成质量控制。

## 后续规划

- 增加订单退款、关闭订单和主动查单能力
- 增强微信支付异常告警和后台对账
- 增加局部涂抹编辑能力
- 增加批量商品图生成
- 增强对象存储清理策略和 CDN 加速配置
- 增加完整后台管理系统
- 增强图片生成质量控制和失败重试机制
- 增加团队空间或商家工作台

## 注意事项

- 不要提交 `.env.local`。
- 不要把 `AUTH_SECRET`、API Key 或其他敏感信息上传到 GitHub。
- 不要提交微信支付私钥、平台证书、APIv3 密钥或任何 `.pem` 文件。
- 腾讯云 COS 的 SecretId 和 SecretKey 只能放在服务器 `.env.local` 中，不要提交到 GitHub。
- `server/codex_image_api.py` 建议只监听 `127.0.0.1`。
- 部署到公网时，只需要开放 Next.js 网站端口或 Nginx 的 `80/443` 端口。
- 不要把 `8000` 端口直接暴露到公网。
- 微信支付正式模式需要公网 HTTPS 域名，`WECHAT_PAY_NOTIFY_URL` 必须能被微信支付服务器访问。
- 本地存储模式下，Codex 生成结果默认保留在 `CODEX_IMAGE_API_WORKDIR/tasks`，网站通过 `/api/task-images/...` 受控读取；COS 模式下，上传图和结果图会保存到 COS。
- 生产环境建议使用 Nginx、HTTPS 和 PM2 等进程管理工具。

## 账号系统与邮件配置

当前账号系统支持本地 JSON 文件数据库和 MySQL 数据库两种存储方式。`DATABASE_URL` 使用 `file:` 开头时会保存到本地文件；使用 `mysql://` 或 `mysql2://` 开头时会连接 MySQL。用户数据、会话、邮箱验证 token、密码重置 token、图片任务、订单、积分流水和访问统计都会通过统一数据层保存。

密码哈希通过 `src/lib/password.ts` 统一封装。运行环境安装 `bcryptjs` 时会优先使用 bcrypt；未安装时会兼容项目已有的 `crypto.scrypt` 哈希，以保证旧账号和本地开发环境不因缺少依赖而无法登录。

### 邮件相关环境变量

```env
NEXT_PUBLIC_APP_URL=https://imagegood.huoideas.com

EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ImageGood <noreply@huoideas.com>"

EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES=30
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

说明：

- `NEXT_PUBLIC_APP_URL` 用于拼接邮箱验证链接和密码重置链接。
- `SMTP_PASS` 只能放在服务端环境变量中，不要暴露到前端，也不要提交到 GitHub。
- `SMTP_FROM` 是邮件发件人，建议使用 `名称 <邮箱>` 格式。
- 生产环境必须配置完整 SMTP，否则注册后的验证邮件和密码找回邮件无法正常发送。
- 开发环境如果未配置 SMTP，系统会在服务端日志中打印验证链接或重置链接，方便本地调试。

### 注册与邮箱验证

1. 用户在 `/register` 输入昵称、邮箱、密码、确认密码和算术验证码。
2. 后端校验邮箱格式、密码长度、两次密码一致性和邮箱唯一性。
3. 注册成功后创建用户，`emailVerified` 默认为 `false`。
4. 系统生成邮箱验证 token，数据库只保存 `tokenHash`，不会保存明文 token。
5. 用户点击邮件中的 `/verify-email?token=...` 链接后，系统会标记邮箱为已验证。
6. 未验证邮箱的用户可以登录，但不能生成图片或购买积分。
7. 用户可以在 `/account` 重新发送验证邮件。

### 忘记密码

1. 用户在 `/forgot-password` 输入邮箱。
2. 接口始终返回统一提示：“如果该邮箱已注册，我们会发送密码重置邮件。”
3. 如果邮箱存在，系统会生成 30 分钟有效的密码重置 token。
4. 数据库只保存 `tokenHash`，不会保存明文 token。
5. 用户点击邮件中的 `/reset-password?token=...` 链接后，可以设置新密码。
6. 密码重置成功后，该用户旧 session 会被清除，需要重新登录。

### 功能限制

以下能力要求用户已登录且邮箱已验证：

- `/api/images/edit`
- `/api/images/product`
- `/api/images/poster`
- `/api/payment/create`
- `/api/orders`

如果邮箱未验证，接口会返回：

```json
{
  "status": "failed",
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "请先完成邮箱验证后再使用该功能"
  }
}
```

## MySQL / 阿里云 RDS 配置

项目默认仍可使用本地文件数据库，适合本地开发：

```env
DATABASE_URL="file:./dev.db"
```

服务器正式运行建议使用 MySQL。阿里云 RDS 配置完成后，将服务器 `.env.local` 中的 `DATABASE_URL` 改为：

```env
DATABASE_URL="mysql://imagegood:your-password@rm-2ze743c70lk0ea1s22o.mysql.rds.aliyuncs.com:3306/image_good?connection_limit=5"
MYSQL_CONNECTION_LIMIT=5
```

注意：

- 不要把真实数据库密码提交到 GitHub。
- 如果密码包含 `@`、`#`、`:`、`/` 等特殊字符，需要做 URL 编码。
- 阿里云 RDS 需要把网站服务器公网 IP 加入白名单。
- 数据库 `image_good` 需要提前创建，账号 `imagegood` 需要有读写权限。
- 当前数据层会在 MySQL 中创建 `imagegood_records` 和 `imagegood_meta` 两张表，用于保存账号、会话、订单、积分流水、图片任务和访问统计。

初始化 MySQL 表结构：

```bash
npm install
npm run db:push
```

如果是全新服务器、没有旧账号数据，执行到这里即可启动网站。

如果要把旧 JSON 数据库导入 MySQL，先确认旧文件还在，例如：

```text
/data/photoshop_data/prod.db
```

然后执行：

```bash
npm run db:migrate-json -- /data/photoshop_data/prod.db
```

迁移完成后再启动 Next.js 网站：

```bash
npm run dev -- -H 0.0.0.0
```

生产模式：

```bash
npm run build
npm run start -- -H 0.0.0.0
```

可以在服务器上先测试 MySQL 连通性：

```bash
mysql -h rm-2ze743c70lk0ea1s22o.mysql.rds.aliyuncs.com -P 3306 -u imagegood -p image_good
```

如果连接失败，优先检查 RDS 白名单、账号权限、数据库名、服务器网络和 3306 端口访问。

## License

This project is for internal research and product prototyping. License information can be added later.
