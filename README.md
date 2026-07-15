# ImageGood

ImageGood 是一款面向普通用户、内容创作者和小商家的在线 AI 图片创作平台，支持 AI 修图、文生图、智能抠图、商品图生成、封面海报生成、账号体系、生成记录、积分额度、微信支付和对象存储等核心能力。

## 项目简介

ImageGood 通过 Web 页面提供完整的 AI 图片创作与处理流程：用户可以上传图片并使用自然语言描述修改需求，也可以直接输入文字描述生成图片，或一键去除图片背景。生成完成后，服务端会保存结果并写入用户历史记录。

项目采用 Next.js 构建前端页面和业务 API。浏览器只访问 Next.js 接口，不直接接触图片生成服务、支付密钥、SMTP 配置、数据库连接或对象存储密钥。图片生成、支付回调、邮箱验证、积分扣减等关键流程都在服务端完成。

当前项目支持两种图片生成方式：

- `IMAGE_PROVIDER=openai`：调用 OpenAI 兼容的 Images API，可通过 `OPENAI_BASE_URL` 配置中转服务。
- `IMAGE_PROVIDER=codex`：调用独立的 Python Codex 图片服务，由服务端转发生成任务。

图片文件支持本地存储，也支持腾讯云 COS 对象存储，适合正式服务器长期运行。

## 核心功能

### 用户与账号

- 用户注册、登录、退出登录
- httpOnly Cookie 登录态保持
- 手机号验证码注册与登录
- 邮箱验证
- 忘记密码与邮件重置密码
- 修改密码
- 用户中心
- 最近登录时间与账号状态展示
- 手机号或邮箱任一验证后可使用生成图片和购买积分

### 图片生成

- 智能修图
- 文生图
- 智能抠图
- 抠图后透明 PNG、白底、黑底和自定义纯色背景下载
- 换背景
- 去杂物
- 图片增强 / 高清修复
- 风格调整
- 扩图
- 商品图生成
- 封面海报生成
- 生成结果展示、下载和继续修改
- 抠图结果优先输出透明背景 PNG

### 任务与历史记录

- 图片生成任务创建与状态管理
- 生成中、成功、失败状态展示
- 历史记录列表
- 生成结果详情页
- 单条或批量删除历史记录
- 用户只能访问自己的生成任务

### 积分与支付

- 新用户免费积分
- 每次生成消耗积分
- 积分不足时限制生成并引导购买
- 积分包页面
- 微信支付 Native 扫码支付
- 支付宝电脑网站支付
- 支付平台异步回调自动加积分
- 积分流水记录
- 管理员查看订单和异常补发积分

### 管理与统计

- 管理员订单查看
- 管理员异常补发积分
- 网站访问统计
- 注册量统计
- 生成量统计
- 付款尝试、购买点击和订单数据统计

### 服务端能力

- Next.js API Routes 承载业务接口
- MySQL 或本地 JSON 文件数据库
- SMTP 邮件发送
- 微信支付 APIv3 Native 支付
- OpenAI 兼容图片 API 调用
- Python Codex 图片服务调用
- 腾讯云 COS 对象存储
- 服务端统一鉴权和错误处理

## 技术栈

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Node.js
- MySQL / 本地 JSON 文件数据库
- Python 3
- OpenAI SDK
- Codex CLI / Python Codex 图片服务
- 腾讯云 COS Node.js SDK
- 微信支付 APIv3
- SMTP 邮件服务

## 项目结构

```text
ImageGood/
├── docs/                         # 部署和运维相关文档
├── public/                       # 静态资源
├── scripts/                      # 数据库初始化、迁移等脚本
├── server/
│   ├── codex_image_api.py        # Python Codex 图片服务
│   └── check_codex_image_api.sh  # 图片服务检查脚本
├── src/
│   ├── app/                      # Next.js 页面与 API Routes
│   │   ├── api/                  # 认证、任务、订单、支付、图片生成等接口
│   │   ├── account/              # 用户中心
│   │   ├── admin/                # 管理后台
│   │   ├── checkout/             # 支付结算页
│   │   ├── editor/               # 智能修图工作台
│   │   ├── history/              # 生成历史记录
│   │   ├── image-enhancer/       # 图片增强
│   │   ├── login/                # 登录页
│   │   ├── object-remover/       # 去杂物
│   │   ├── remove-background/    # 智能抠图
│   │   ├── poster/               # 封面海报生成
│   │   ├── pricing/              # 积分包页面
│   │   ├── product/              # 商品图生成
│   │   ├── register/             # 注册页
│   │   ├── text-to-image/        # 文生图
│   │   └── page.tsx              # 首页
│   ├── components/               # 页面组件与通用 UI
│   ├── lib/                      # 认证、数据库、图片服务、支付、邮件等业务模块
│   └── types/                    # TypeScript 类型定义
├── .env.example                  # 环境变量示例
├── next.config.mjs               # Next.js 配置
├── package.json                  # 项目脚本与依赖
└── README.md
```

## 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/Xiaokang-Xue/ImageGood.git
cd ImageGood
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

至少需要配置：

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="please-change-this-secret"
AUTH_COOKIE_SECURE=false

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

如果启用手机号验证码，需要配置阿里云短信：

```env
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_SMS_REGION_ID=cn-hangzhou
ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_你的模板编号
SMS_CODE_EXPIRE_MINUTES=5
SMS_CODE_RESEND_SECONDS=60
```

如果使用 OpenAI 兼容图片接口：

```env
IMAGE_API_MODE=real
IMAGE_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.example.com/v1
IMAGE_MODEL=gpt-image-1
```

如果使用 Python Codex 图片服务：

```env
IMAGE_API_MODE=real
IMAGE_PROVIDER=codex
CODEX_IMAGE_API_BASE_URL=http://127.0.0.1:8000
CODEX_IMAGE_API_TIMEOUT_SECONDS=900
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs
```

本地调试支付建议使用：

```env
PAYMENT_PROVIDER=alipay
PAYMENT_MODE=mock
```

### 4. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 5. 启动图片生成服务

如果 `IMAGE_PROVIDER=openai`，不需要启动 Python Codex 图片服务。

如果 `IMAGE_PROVIDER=codex`，需要另开终端启动：

```bash
mkdir -p /data/codex_image_api_runs

HOST=127.0.0.1 \
PORT=8000 \
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs \
python3 server/codex_image_api.py
```

检查服务：

```bash
curl http://127.0.0.1:8000/health
```

Codex 图片服务建议只监听 `127.0.0.1`，不要直接暴露到公网。

### 6. 启动网站

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

## 服务器部署

以下流程适合 Linux 服务器。

### 1. 上传或拉取项目

```bash
cd /data
git clone https://github.com/Xiaokang-Xue/ImageGood.git Photoshop
cd Photoshop
npm install
cp .env.example .env.local
nano .env.local
```

如果使用压缩包上传，也可以解压到固定目录，例如：

```bash
cd /data/Photoshop
npm install
```

为了避免每次覆盖项目后丢失用户数据，正式环境建议将数据库和生成文件放到项目目录之外，例如：

```env
DATABASE_URL="mysql://user:password@host:3306/image_good?connection_limit=5"
CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs
```

### 2. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

如果需要从旧的本地 JSON 数据库迁移到 MySQL：

```bash
npm run db:migrate-json -- /data/photoshop_data/prod.db
```

### 3. 启动图片服务

如果使用 `IMAGE_PROVIDER=openai`，跳过这一步。

如果使用 `IMAGE_PROVIDER=codex`：

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

服务器安全组或防火墙需要开放网站端口。不要把 Codex 图片服务的 `8000` 端口直接开放到公网。

### 5. 生产构建与启动

```bash
npm run build
npm run start -- -H 0.0.0.0
```

正式环境建议使用 Nginx 反向代理到 Next.js 服务，并配置 HTTPS。

### 6. 使用 PM2 守护进程

```bash
npm install -g pm2
```

启动网站：

```bash
pm2 start npm --name imagegood -- run start -- -H 0.0.0.0
```

如果使用 Codex 图片服务：

```bash
pm2 start bash --name imagegood-codex-api -- -c "HOST=127.0.0.1 PORT=8000 CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs python3 server/codex_image_api.py"
```

保存进程列表：

```bash
pm2 save
```

## 环境变量说明

### 基础配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `DATABASE_URL` | 数据库地址，支持 `file:` 或 `mysql://` | `file:./dev.db` |
| `MYSQL_CONNECTION_LIMIT` | MySQL 连接数限制 | `5` |
| `AUTH_SECRET` | 登录会话、验证码、邮箱验证和重置密码 token 的签名密钥 | `please-change-this-secret` |
| `AUTH_COOKIE_SECURE` | Cookie 是否只允许 HTTPS 发送 | `true` |
| `NEXT_PUBLIC_APP_URL` | 网站公网访问地址 | `https://imagegood.example.com` |

### 邮件配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `EMAIL_PROVIDER` | 邮件服务提供方式 | `smtp` |
| `SMTP_HOST` | SMTP 服务器地址 | `smtp.example.com` |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_SECURE` | 是否使用 SSL/TLS | `true` |
| `SMTP_USER` | SMTP 登录账号 | `noreply@example.com` |
| `SMTP_PASS` | SMTP 授权码或密码 | `***` |
| `SMTP_FROM` | 邮件发件人 | `ImageGood <noreply@example.com>` |
| `EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES` | 邮箱验证链接有效期 | `30` |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | 密码重置链接有效期 | `30` |

### 短信配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 阿里云 AccessKey ID，仅服务端使用 | `LTAI***` |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret，仅服务端使用 | `***` |
| `ALIYUN_SMS_REGION_ID` | 阿里云短信区域 | `cn-hangzhou` |
| `ALIYUN_SMS_SIGN_NAME` | 阿里云短信签名名称 | `ImageGood` |
| `ALIYUN_SMS_TEMPLATE_CODE` | 阿里云短信模板 Code | `SMS_123456789` |
| `SMS_CODE_EXPIRE_MINUTES` | 短信验证码有效期 | `5` |
| `SMS_CODE_RESEND_SECONDS` | 同一手机号重发间隔 | `60` |

### 图片生成配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `IMAGE_API_MODE` | 图片生成模式 | `real` |
| `IMAGE_PROVIDER` | 图片生成服务提供方 | `openai` / `codex` |
| `OPENAI_API_KEY` | OpenAI 兼容接口密钥 | `sk-xxx` |
| `OPENAI_BASE_URL` | OpenAI 兼容接口地址，可留空使用官方地址 | `https://api.example.com/v1` |
| `IMAGE_MODEL` | 图片模型名称 | `gpt-image-1` |
| `CODEX_IMAGE_API_BASE_URL` | Codex 图片服务地址 | `http://127.0.0.1:8000` |
| `CODEX_IMAGE_API_TIMEOUT_SECONDS` | Codex 图片服务请求超时时间 | `900` |
| `CODEX_IMAGE_API_WORKDIR` | Codex 图片服务工作目录 | `/data/codex_image_api_runs` |
| `CODEX_RESULT_GRACE_SECONDS` | 任务超时后继续查找结果文件的宽限时间 | `900` |
| `CODEX_MODEL` | Codex CLI 使用的模型，可选 | `gpt-5.1` |

### 图片存储配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `IMAGE_STORAGE_PROVIDER` | 图片存储方式 | `local` / `cos` |
| `TENCENT_COS_ENABLED` | 是否启用腾讯云 COS | `true` |
| `TENCENT_COS_SECRET_ID` | 腾讯云 SecretId | `AKID...` |
| `TENCENT_COS_SECRET_KEY` | 腾讯云 SecretKey | `***` |
| `TENCENT_COS_REGION` | COS Bucket 地域 | `ap-beijing` |
| `TENCENT_COS_BUCKET` | COS Bucket 名称 | `example-1234567890` |
| `TENCENT_COS_KEY_PREFIX` | COS 对象 key 前缀 | `imageGood` |
| `TENCENT_COS_USE_PROXY` | 是否通过 Next.js 受控代理读取 COS 图片 | `true` |
| `TENCENT_COS_PUBLIC_BASE_URL` | 公开读桶或 CDN 域名，可选 | `https://cdn.example.com` |
| `TENCENT_COS_CLEAN_LOCAL_TASK_DIR` | 上传 COS 并写库成功后清理当前 Codex 任务目录 | `false` |

### 支付配置

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | 支付提供方，当前用于默认配置 | `alipay` |
| `PAYMENT_MODE` | 支付模式，`mock` 用于本地调试，`real` 用于真实支付 | `mock` / `real` |
| `ENABLE_PAYMENT_TEST_PACKAGE` | 是否启用隐藏的支付链路测试包 | `false` |
| `WECHAT_PAY_APPID` | 微信支付绑定的 APPID | `wx...` |
| `WECHAT_PAY_MCH_ID` | 微信支付商户号 | `1900000000` |
| `WECHAT_PAY_API_V3_KEY` | 微信支付 APIv3 密钥 | `***` |
| `WECHAT_PAY_MERCHANT_SERIAL_NO` | 商户 API 证书序列号 | `证书序列号` |
| `WECHAT_PAY_PRIVATE_KEY_PATH` | 商户 API 私钥路径 | `/data/Photoshop/apiclient_key.pem` |
| `WECHAT_PAY_PLATFORM_CERT_SERIAL_NO` | 微信支付平台证书序列号 | `平台证书序列号` |
| `WECHAT_PAY_PLATFORM_CERT_PATH` | 微信支付平台证书路径 | `/data/Photoshop/wechatpay_platform_cert.pem` |
| `WECHAT_PAY_NOTIFY_URL` | 微信支付异步回调地址 | `https://example.com/api/payment/wechat/notify` |
| `ALIPAY_ENABLED` | 是否启用支付宝支付 | `true` |
| `ALIPAY_APP_ID` | 支付宝开放平台应用 AppID | `2021...` |
| `ALIPAY_APP_PRIVATE_KEY` | 支付宝应用私钥，只能放在服务端 | `***` |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥，用于异步通知验签 | `***` |
| `ALIPAY_GATEWAY` | 支付宝开放平台网关 | `https://openapi.alipay.com/gateway.do` |
| `ALIPAY_SIGN_TYPE` | 签名类型 | `RSA2` |
| `ALIPAY_NOTIFY_URL` | 支付宝异步通知地址 | `https://example.com/api/payment/alipay/notify` |
| `ALIPAY_RETURN_URL` | 支付宝页面返回地址 | `https://example.com/checkout/alipay/return` |

## 图片生成链路

### OpenAI 兼容接口模式

```text
浏览器
  ↓
Next.js API
  ↓
OpenAI 兼容 Images API
  ↓
保存结果图片
  ↓
返回任务状态和结果地址
```

该模式适合直接调用 OpenAI Images API 或兼容 OpenAI 协议的中转服务。配置 `IMAGE_PROVIDER=openai` 后，不需要启动 Python Codex 图片服务。

当前图片能力通过统一 provider 封装：

- `editImage`：上传图片后按提示进行 AI 修图和商品图生成。
- `generateImage`：根据文字描述生成图片，用于文生图和海报背景生成。
- `removeBackground`：上传图片后进行智能抠图，结果优先保存为 PNG。

图片增强和去杂物复用 `editImage` 能力，通过固定任务 prompt 生成结果，并继续使用同一套任务状态、COS 保存、历史记录和积分扣减流程。

### Codex 图片服务模式

```text
浏览器
  ↓
Next.js API
  ↓
Python Codex 图片服务 127.0.0.1:8000
  ↓
Codex CLI 生成图片
  ↓
保存结果图片
```

该模式需要单独启动 `server/codex_image_api.py`。Python 服务只建议监听 `127.0.0.1`，由 Next.js 服务端调用，不应直接暴露公网。

## 对象存储说明

ImageGood 支持将用户上传图和 AI 生成结果保存到腾讯云 COS，减少服务器本地硬盘占用。

启用 COS：

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

系统只上传当前任务产生的业务文件：

- 用户上传原图：`imageGood/users/{userId}/tasks/{taskId}/input.{ext}`
- AI 生成结果：`imageGood/users/{userId}/tasks/{taskId}/result.{ext}`

如果 `TENCENT_COS_USE_PROXY=true`，前端会通过 `/api/storage/images/...` 读取图片，服务端会校验当前用户是否拥有对应任务，再从 COS 返回图片。

如果使用公开读桶或 CDN，可配置：

```env
TENCENT_COS_PUBLIC_BASE_URL=https://你的图片域名
TENCENT_COS_USE_PROXY=false
```

确认 COS 上传稳定后，可以开启：

```env
TENCENT_COS_CLEAN_LOCAL_TASK_DIR=true
```

该开关只清理当前任务目录 `/data/codex_image_api_runs/tasks/{taskId}`，不会删除工作目录根目录，也不会扫描服务器其他目录。

## 账号与邮箱流程

ImageGood 当前以手机号验证码作为主要注册和登录方式，邮箱作为辅助账号能力保留。

手机号流程：

1. 用户输入手机号并获取短信验证码。
2. 系统调用阿里云短信服务发送 6 位验证码。
3. 数据库只保存验证码 hash，不保存明文验证码。
4. 验证码默认 5 分钟有效，校验成功后立即失效。
5. 同一手机号 60 秒内只能发送一次，1 小时内最多发送 5 次；同一 IP 1 小时内最多发送 20 次。
6. 手机号注册成功后自动完成手机号验证并登录。

邮箱流程：

邮箱注册、邮箱登录、邮箱验证、忘记密码和邮件重置密码仍然保留。老用户仍可使用邮箱登录。用户只要完成手机号验证或邮箱验证其中之一，即可使用图片生成和购买积分功能。

邮箱验证流程：

1. 注册成功后生成邮箱验证 token。
2. 数据库只保存 token hash，不保存明文 token。
3. 系统发送验证邮件。
4. 用户点击 `/verify-email?token=...` 链接完成验证。
5. 用户中心会展示邮箱验证状态，并支持重新发送验证邮件。

忘记密码流程：

1. 用户在 `/forgot-password` 输入邮箱。
2. 接口统一返回提示，不泄露邮箱是否注册。
3. 如果邮箱存在，系统发送密码重置邮件。
4. 用户通过 `/reset-password?token=...` 设置新密码。
5. 重置成功后旧 session 失效，需要重新登录。

生产环境必须配置 SMTP。开发环境未配置 SMTP 时，服务端日志会输出验证链接或重置链接，方便本地调试。

## 积分与支付流程

ImageGood 使用积分控制图片生成次数。

- 新用户获得免费积分。
- 每次成功生成图片消耗 1 积分。
- 生成失败不扣积分。
- 积分不足时，用户需要购买积分包。

内置积分包：

| 套餐 | 价格 | 积分 | 适用场景 |
| --- | ---: | ---: | --- |
| 入门包 | ¥19.9 | 15 | 首次体验 AI 修图、抠图和文生图 |
| 标准包 | ¥49.9 | 45 | 日常修图、商品图处理和封面生成 |
| 创作者包 | ¥99 | 100 | 持续进行图片创作与处理 |
| 专业包 | ¥199 | 220 | 高频生成、商品图和内容创作 |

ImageGood 支持微信支付和支付宝支付：

- 微信支付：Native 扫码支付，前端展示二维码。
- 支付宝支付：电脑网站支付，前端跳转支付宝收银台。

微信支付正式流程：

1. 用户在 `/pricing` 选择积分包。
2. 服务端创建本地订单。
3. 服务端调用微信支付 Native 下单接口。
4. 前端在 `/checkout/[orderId]` 展示支付二维码。
5. 微信支付成功后调用 `/api/payment/wechat/notify`。
6. 服务端验签、解密、校验金额和订单号。
7. 订单变为已支付。
8. 用户积分自动增加。
9. 写入积分流水。

支付成功以微信支付回调为准，不依赖前端跳转判断。

支付宝支付正式流程：

1. 用户在 `/pricing` 选择积分包并选择支付宝支付。
2. 服务端创建本地订单。
3. 服务端调用支付宝 `alipay.trade.page.pay` 生成带签名的支付链接。
4. 浏览器跳转支付宝收银台。
5. 用户完成支付后，支付宝会跳转到 `ALIPAY_RETURN_URL`。
6. return 页面只展示“支付结果确认中”并轮询订单状态，不直接加积分。
7. 支付宝通过 `ALIPAY_NOTIFY_URL` 向 `/api/payment/alipay/notify` 发送异步通知。
8. 服务端验签、校验 `app_id`、商户订单号、金额和交易状态。
9. 订单更新为已支付，用户积分自动到账，并写入积分流水。

支付宝到账以异步通知验签成功为准，`return_url` 只用于页面跳转，不作为支付成功依据。

## 管理后台

管理员用户可以访问：

- `/admin/orders`：查看订单状态，处理异常补发积分。
- `/admin/analytics`：查看访问量、注册量、生成量、付款尝试、购买点击等运营数据。

设置管理员：

- 文件数据库模式：在数据库文件中找到目标用户，将 `role` 改为 `"admin"`。
- MySQL 模式：在 `imagegood_records` 表中找到 `collection = 'users'` 的目标用户记录，将 JSON 中的 `role` 改为 `"admin"`。

修改后重新登录即可生效。

## MySQL / 阿里云 RDS

本地开发可使用文件数据库：

```env
DATABASE_URL="file:./dev.db"
```

服务器建议使用 MySQL：

```env
DATABASE_URL="mysql://user:password@host:3306/image_good?connection_limit=5"
MYSQL_CONNECTION_LIMIT=5
```

注意事项：

- 不要把真实数据库密码提交到 GitHub。
- 如果密码包含 `@`、`#`、`:`、`/` 等特殊字符，需要 URL 编码。
- RDS 需要把网站服务器公网 IP 加入白名单。
- 数据库需要提前创建，并给账号读写权限。
- 项目会创建 `imagegood_records` 和 `imagegood_meta` 表，用于保存账号、会话、任务、订单、积分流水和统计数据。

初始化表结构：

```bash
npm run db:push
```

迁移旧 JSON 数据库到 MySQL：

```bash
npm run db:migrate-json -- /data/photoshop_data/prod.db
```

## 安全说明

- 不要提交 `.env.local`。
- 不要提交 API Key、SMTP 密码、数据库密码、COS 密钥、微信支付 APIv3 密钥。
- 不要提交微信支付私钥、平台证书或任何 `.pem` 文件。
- `AUTH_SECRET` 必须在生产环境使用高强度随机字符串。
- Codex 图片服务只建议监听 `127.0.0.1`。
- 对公网只开放 Next.js 网站或 Nginx 的 `80/443` 端口。
- 真实支付模式需要公网 HTTPS 回调地址。
- 图片生成、支付验签、邮箱发送、对象存储访问都应在服务端完成。

## 常用命令

```bash
# 安装依赖
npm install

# 初始化数据库结构
npm run db:push

# 本地开发
npm run dev

# 服务器开发方式监听公网
npm run dev -- -H 0.0.0.0

# 生产构建
npm run build

# 生产启动
npm run start -- -H 0.0.0.0
```

## 自动化检查与任务排障

部署前后可以运行核心页面冒烟测试。该测试不会生成图片、扣积分或创建支付订单：

```bash
npm run test:smoke -- --base-url=https://imagegood.net
```

在应用服务器上检查最近 24 小时图片任务的成功率、耗时、主要失败原因和长期未更新任务：

```bash
npm run ops:task-audit
```

图片任务会输出以 `taskId` 关联的结构化日志，覆盖任务创建、模型调用、COS 保存、数据库更新、积分扣减和最终状态。详细使用方式见：

- [核心功能自动化冒烟测试](docs/smoke-testing.md)
- [图片生成任务可观测性](docs/image-task-observability.md)
- [质量基线](docs/quality-baseline.md)

## 飞书运营日报

项目支持将每日运营数据自动推送到飞书群，适合用于每天固定时间查看网站运行情况。该能力不会爬取后台页面，而是通过服务端统计逻辑直接读取数据库记录。

### 环境变量

在服务器 `.env.local` 中配置：

```env
FEISHU_BOT_WEBHOOK=你的飞书自定义机器人 Webhook
FEISHU_BOT_SECRET=
FEISHU_DAILY_REPORT_RANGE=yesterday
```

说明：

- `FEISHU_BOT_WEBHOOK` 为飞书自定义机器人 Webhook，请不要提交到 GitHub。
- `FEISHU_BOT_SECRET` 为可选项。如果飞书机器人开启了签名校验，需要填写该密钥。
- `FEISHU_DAILY_REPORT_RANGE` 支持 `yesterday` 或 `today`，生产环境建议使用 `yesterday`。
- 日报内容按“今日/昨日数据”和“累计数据”分区展示，用户指标使用“新注册用户、访问过网站的登录用户、访问设备/浏览器数、累计已注册用户”等直白口径。

### 手动发送

```bash
npm run ops:daily-report
```

发送今日数据：

```bash
npm run ops:daily-report -- --today
```

发送指定日期数据：

```bash
npm run ops:daily-report -- --date=2026-06-17
```

如果 Webhook 未配置或飞书接口返回失败，脚本会输出明确错误并以非 0 状态退出，便于服务器监控和 crontab 记录。

### 定时发送

每天早上 8:00 推送昨日数据：

```bash
mkdir -p /data/Photoshop/logs
crontab -e
```

加入：

```cron
0 8 * * * /bin/bash -lc 'cd /data/Photoshop && npm run ops:daily-report >> /data/Photoshop/logs/feishu-daily-report.log 2>&1'
```

注意：

- 请先在服务器手动执行 `npm run ops:daily-report`，确认飞书群可以收到消息。
- 定时任务依赖服务器项目目录中的 `.env.local`。
- 日志中不会输出完整 Webhook 地址。

如果手动发送成功，但定时发送没有生效，请按顺序检查：

```bash
crontab -l
```

确认能看到上面的 `0 8 * * * ...` 任务。

```bash
date
```

确认服务器时区和当前时间是否符合预期。若服务器不是中国时区，可以设置：

```bash
timedatectl set-timezone Asia/Shanghai
```

查看定时任务日志：

```bash
tail -n 100 /data/Photoshop/logs/feishu-daily-report.log
```

如果日志文件没有生成，通常说明 crontab 没有执行或项目路径不对；如果日志里提示找不到 `npm`，请先查看 `npm` 的绝对路径：

```bash
which npm
```

然后把定时任务里的 `npm` 替换成该绝对路径，例如：

```cron
0 8 * * * /bin/bash -lc 'cd /data/Photoshop && /usr/bin/npm run ops:daily-report >> /data/Photoshop/logs/feishu-daily-report.log 2>&1'
```

### 管理员手动触发

管理员账号也可以通过接口手动触发一次日报推送：

```text
POST /api/admin/analytics/send-feishu-report
```

该接口只允许 `role = "admin"` 的用户调用，普通用户无法访问。

## License

Copyright (c) 2026 ImageGood. All rights reserved.
