# ImageGood 项目交接文档

> 文档版本：1.0  
> 代码基线：`package.json` 版本 `1.0.0-beta.1`  
> 最后核对日期：2026-08-03  
> 适用对象：产品、前端、后端、测试、运维及后续项目负责人

## 1. 文档目的

本文用于完整说明 ImageGood 当前代码的产品功能、技术架构、数据设计、外部依赖、关键业务链路、部署方式和已知边界。内容依据当前仓库真实代码整理，可直接复制到飞书云文档。

本文不包含任何真实密钥、数据库密码、支付私钥、证书内容或用户数据。生产配置以服务器 `.env.local` 和外部服务控制台为准，交接时应通过安全渠道单独传递。

## 2. 项目概览

### 2.1 产品定位

ImageGood 是面向普通用户、内容创作者和商家的 AI 图片创作与处理网站。用户可以上传图片或输入文字，完成 AI 修图、文生图、智能抠图、图片增强、去杂物、商品图和封面海报等任务。

项目不是单纯的前端展示站，当前代码包含以下完整业务链路：

- 手机号和邮箱账号体系；
- 联系方式验证及密码找回；
- 异步图片任务、结果存储和历史记录；
- 免费体验、水印结果、图片额度和支付；
- 微信支付 APIv3 与支付宝电脑网站支付；
- 腾讯云 COS 与本地图片存储；
- 管理员订单、任务和运营数据后台；
- 飞书运营日报、任务巡检和自动化冒烟测试。

### 2.2 当前正式域名

- 对外地址：`https://imagegood.net`
- 域名、邮件链接和支付返回地址由环境变量控制，不应在业务代码中新增硬编码域名。

### 2.3 当前核心规则

- 邮箱或手机号任一完成验证后，才可以生成图片和创建支付订单。
- 新注册账号赠送 1 张免费体验额度。
- 每个成功图片任务消耗 1 张额度；失败不消耗。
- 首次免费任务展示带 ImageGood 水印的结果，同时单独保存无水印原图。
- 用户购买任一有效图片额度方案后，可以查看和下载免费体验任务的无水印结果。
- 当前正式售卖 1、50、500、5000 张四种图片额度。
- 支付到账只相信服务端异步通知或仅开发环境可用的模拟支付接口，不相信浏览器跳转结果。

## 3. 总体技术架构

```text
浏览器 / 移动端浏览器
        |
        | HTTPS
        v
Nginx 反向代理
        |
        v
Next.js 14 App Router
  |- React 页面与客户端交互组件
  |- Route Handlers 业务 API
  |- 账号与会话服务
  |- 图片任务服务
  |- 支付与额度服务
  |- 运营统计与管理员接口
        |
        +--> MySQL JSON 记录层 / 本地 JSON 数据文件
        +--> 腾讯云 COS / public/generated 本地存储
        +--> OpenAI-compatible 图片接口 / Codex Python 服务 / mock Provider
        +--> 微信支付 APIv3 / 支付宝电脑网站支付
        +--> 阿里云短信 / SMTP 邮件 / 飞书机器人
```

浏览器只调用 Next.js 页面和 `/api/*` 接口。数据库、模型、COS、短信、邮件和支付密钥均由服务端读取，不进入客户端代码。

## 4. 技术选型与技术栈

| 层级 | 技术 | 当前用途 | 选型说明 |
| --- | --- | --- | --- |
| Web 框架 | Next.js 14.2 | App Router、页面渲染、Route Handlers、构建与生产运行 | 前后端同仓，适合快速形成完整产品链路 |
| UI | React 18.3 | 工具工作台、表单、任务状态、后台页面 | 与 Next.js 配套，交互组件按需使用 `use client` |
| 语言 | TypeScript 5.7 | 页面、API、服务、脚本和共享类型 | 开启 `strict`，别名 `@/*` 指向 `src/*` |
| 样式 | Tailwind CSS 3.4 | 响应式布局、设计 token、组件样式 | 当前视觉以中性色、清晰边框和少量品牌蓝为主 |
| 图标 | lucide-react | 导航、按钮、状态图标 | 避免维护散乱 SVG |
| 客户端状态 | Zustand 5 | 编辑器素材、提示词和部分工作台状态 | 工具页之间复用轻量状态，不承担服务端数据持久化 |
| 数据库驱动 | mysql2 | 生产 MySQL 连接池与事务 | 当前没有使用 Prisma，也没有 ORM schema |
| 本地数据 | Node.js 文件 API + JSON | 本地开发、mock 模式 | `DATABASE_URL=file:...` 时使用单文件数据库 |
| 图片 SDK | OpenAI Node SDK 6.38 | OpenAI-compatible 图片生成与编辑 | `OPENAI_BASE_URL` 可指向兼容接口；也可留空使用 SDK 默认地址 |
| 可选图片服务 | Python Codex 服务 | 长耗时图片任务和结果目录恢复 | 通过本机 HTTP 接口调用，代码位于 `server/` |
| 图片处理 | sharp | 格式转换、sRGB 标准化、预览图、水印、尺寸读取 | 服务端运行，未进入浏览器包 |
| HEIC 兼容 | heic-convert | iPhone HEIC/HEIF 解码 | 转换为标准 PNG 后再调用模型 |
| BMP 兼容 | bmp-js | BMP 解码兜底 | 转为 RGB 后交给 sharp 处理 |
| 对象存储 | cos-nodejs-sdk-v5 | 腾讯云 COS 上传、读取、签名地址 | 支持私有 Bucket 代理和公开/CDN 地址 |
| 短信 | 阿里云 Dysmsapi SDK | 手机号验证码 | AccessKey 仅服务端读取 |
| 邮件 | Node `net` / `tls` 自实现 SMTP 客户端 | 邮箱验证、密码重置 | 当前未使用 Nodemailer，支持隐式 TLS 和 STARTTLS |
| 支付 | Node `crypto` + HTTPS 请求 | 微信 APIv3、支付宝 RSA2 | 微信含 RSA 签名、平台证书验签和 AES-GCM 解密；支付宝含 RSA2 签名与通知验签 |
| 自动化 | ESLint、TypeScript、GitHub Actions | Lint、类型检查、构建和 mock 冒烟测试 | CI 不使用生产密钥 |
| 脚本运行 | tsx | 运营日报、基线、巡检、冒烟测试 | 用于直接执行 TypeScript 运维脚本 |

### 4.1 未使用的技术

- 当前没有 Prisma。
- 当前没有 Redis。
- 当前没有独立消息队列。
- 当前没有 OAuth、第三方验证码、自动退款或自动续费。
- 当前没有独立后端微服务框架；除可选 Python Codex 图片服务外，业务 API 均在 Next.js Route Handlers 中。

## 5. 项目目录说明

```text
ImageGood/
|- src/app/                     Next.js 页面与 API Route Handlers
|- src/components/              页面工作台、导航、支付和通用 UI 组件
|- src/config/                  套餐、图片上传等共享配置
|- src/lib/                     账号、数据库、客户端 API、服务端业务逻辑
|- src/lib/server/              只允许服务端使用的模型、存储、支付、短信等模块
|- src/types/                   图片、任务、用户、订单和运营数据类型
|- scripts/                     数据初始化、迁移、巡检、日报和测试脚本
|- server/                      可选 Python Codex 图片服务
|- public/                      静态资源及本地模式生成结果
|- docs/                        配置、部署、测试、图示和交接文档
|- .github/                     CI、Issue、PR 和依赖更新配置
|- .env.example                 环境变量模板，不包含真实密钥
|- package.json                 依赖、版本和命令
|- next.config.mjs              Next.js 配置
|- tailwind.config.ts           设计 token 与 Tailwind 配置
```

## 6. 前台页面与功能设计

### 6.1 首页 `/`

设计目标：让用户快速理解产品能力，并进入最常用工具。

当前实现：

- 首页使用 `force-static`，首屏不依赖登录接口才能展示。
- 主要入口为 AI 修图、文生图、智能抠图。
- 展示图片处理和图片生成能力，以及真实 Before/After 示例和价格入口。
- 根路径不会读取上次任务后自动跳走；继续创作必须由用户主动点击。
- 模板中心不再作为主导航和首页重点入口，`/templates` 仅保留兼容页面。

### 6.2 全局导航

桌面端分为：

- 首页；
- AI 图片处理：AI 修图、智能抠图、图片增强、去杂物；
- AI 图片生成：文生图、商品图、封面海报；
- 价格；
- 历史记录；
- 登录或用户菜单。

移动端使用右侧抽屉，工具按两组展示。菜单带遮罩、滚动锁定和安全区适配；用户菜单支持点击空白处或按 Esc 关闭。

登录用户的导航会显示当前可用图片额度；用户信息通过 `client-current-user.ts` 做 30 秒内存缓存并合并并发请求。登录、退出、购买和生成完成后通过事件主动刷新，减少页面切换时重复请求 `/api/auth/me`。

### 6.3 AI 修图 `/editor`

输入：一张原图、自然语言要求、编辑工具、质量、输出格式。  
任务类型：`edit`。  
服务端能力：图片编辑 `provider.editImage`。

设计要点：

- 默认使用 `custom`，按用户自由描述精确修图；不会默认强制选中换背景等快捷功能。
- 服务端提示词明确“用户要求优先”“未提及区域保持不变”，减少模型擅自改动。
- 用户明确写出横版、竖版、正方形或比例时优先遵守；否则根据上传原图宽高选择模型支持的最接近方向。
- 生成成功后展示单张大图，结果完整显示，用户主动点击“继续修改”后才把结果作为下一次输入。

### 6.4 文生图 `/text-to-image`

输入：文字描述、轻量风格选项、画面尺寸、质量和输出格式。  
任务类型：`text_to_image`。  
服务端能力：`provider.generateImage`。

可选风格为写实摄影、电商商品图、海报设计、精致插画和极简风。风格只用于补充提示词；若与用户描述冲突，以用户描述为准。页面不暴露复杂模型参数。

### 6.5 智能抠图 `/remove-background`

输入：一张原图、可选补充要求、质量。  
任务类型：`remove_background`。  
服务端能力：`provider.removeBackground`。

设计要点：

- 目标输出为透明 PNG。
- 重点约束主体形状、颜色、材质、文字、比例及毛发/半透明边缘不变。
- 结果区使用棋盘格展示透明区域，并支持透明、白底、黑底和自定义纯色背景预览/导出。
- 当前 OpenAI-compatible Provider 的抠图是通过图片编辑提示词实现，并不是独立的传统分割算法；透明度和边缘质量取决于实际模型能力，因此该能力在 README 中标为 Experimental。

### 6.6 图片增强 `/image-enhancer`

输入：一张原图和可选补充要求。  
任务类型：`image_enhance`。  
服务端能力：复用 `provider.editImage`。

固定提示词用于降低噪点、压缩痕迹并恢复自然细节，同时明确禁止重绘主体、增加物体、滤镜、阴影或水印。

### 6.7 去杂物 `/object-remover`

输入：一张原图和要移除对象的文字说明。  
任务类型：`object_remove`。  
服务端能力：复用 `provider.editImage`。

当前版本是文字指令式去物，没有画笔蒙版。服务端要求只处理指定对象，并延续周围纹理、透视、景深和光照。

### 6.8 商品图 `/product`

输入：商品原图、模板、场景、风格、卖点和比例。  
任务类型：`product`。  
服务端能力：复用 `provider.editImage`。

可选配置：

- 模板：白底主图、生活场景图、节日促销图、社交媒体种草图；
- 场景：厨房、卧室、办公桌、户外、礼盒；
- 风格：简约、高级、温暖、清新；
- 比例：1:1、3:4、4:3、16:9。

提示词重点保护商品外形、包装、颜色、比例、材质和已有文字标识，卖点只通过构图和场景体现，不自动生成宣传文字。

### 6.9 封面海报 `/poster`

输入：用途和用户画面描述。  
任务类型：`poster`。  
服务端能力：`provider.generateImage`。

用途包括小红书封面、公众号首图、社群活动海报、课程封面和学习打卡图。当前主要依靠模型生成完整视觉，不在前端手工叠加大量标题、副标题、配色和装饰元素。除非用户明确要求，服务端提示词要求不生成文字、Logo、二维码或水印。

### 6.10 统一生成中体验

所有图片工具复用 `GenerationLoadingPanel`：

- 使用与最终结果相近的大尺寸动态占位，避免结果出现时布局跳动；
- 按任务类型展示阶段文案；
- 展示已等待时间，明确通常约 2 至 4 分钟，复杂任务可能更久；
- 不伪造 0% 至 100% 进度；
- 超过一定时间后提供历史记录入口；
- 失败时展示具体错误和重试按钮；
- 轮询在成功、失败或组件卸载时停止。

### 6.11 历史记录 `/history`、`/history/[id]`

功能：

- 默认每页 12 条，按创建时间倒序；
- 支持任务类型、状态、今天/近 7 天/近 30 天、仅收藏筛选；
- 支持收藏、重命名、查看详情、继续编辑、下载；
- 支持单条删除、选择全部可删除记录、批量删除；
- 列表只返回首张结果和截断后的提示词，缩略图按需加载；
- 详情页再请求完整任务信息。

删除边界：

- 只有 `succeeded` 或 `failed` 状态可以删除；
- 与待支付解锁订单关联的任务不能删除；
- 当前删除只移除数据库中的任务记录，不会同步删除 COS 对象或本地图片文件。这是需要后续补充的存储生命周期能力。

### 6.12 价格与结算

- `/pricing`：展示当前可购买图片额度。
- `/checkout/[orderId]`：显示微信二维码或支付宝支付状态。
- `/checkout/alipay/return`：支付宝返回页，仅轮询订单，不直接发放权益。

当前正式套餐：

| 套餐 ID | 名称 | 金额 | 图片额度 | 备注 |
| --- | --- | ---: | ---: | --- |
| `image_pack_1_202608` | 单张体验 | ¥59 | 1 张 | 约 ¥59 / 张 |
| `image_pack_50` | 轻享 50 张 | ¥199 | 50 张 | 约 ¥4 / 张 |
| `image_pack_500` | 进阶 500 张 | ¥499 | 500 张 | 约 ¥1 / 张 |
| `image_pack_5000` | 专业 5000 张 | ¥599 | 5000 张 | 约 ¥0.12 / 张，最划算 |

唯一配置源为 `src/config/billing-plans.ts`。前端套餐 API、微信订单、支付宝订单和到账数量都读取该配置。旧积分包、旧会员和旧单次解锁方案保存在 `ARCHIVED_BILLING_PLANS` 中，只用于历史订单显示、统计和回滚参考，不参与新订单创建。

### 6.13 账户中心 `/account`

- 展示昵称、邮箱、脱敏手机号、验证状态、注册时间和最近登录时间；
- 展示当前图片额度、成功生成次数、最近生成时间；
- 展示最近 5 条额度流水；
- 支持绑定或更换手机号；
- 支持重发邮箱验证邮件；
- 支持修改密码和退出登录。

修改密码时前后端均校验旧密码、新密码至少 8 位、新旧密码不能相同。

## 7. 账号、认证与安全设计

### 7.1 邮箱注册和登录

- 邮箱注册要求昵称、邮箱、密码、确认密码和算术验证码。
- 邮箱格式在服务端校验，密码至少 8 位，邮箱不可重复。
- 注册成功自动建立会话，账号保留，即使验证邮件发送失败也不会回滚用户。
- 邮箱未验证时允许登录，但不能生成图片或购买额度。
- 邮箱登录按 IP 做进程内限流，并在成功后更新 `lastLoginAt`。

### 7.2 手机号注册和登录

- 仅支持中国大陆 11 位手机号，正则为 `^1[3-9]\d{9}$`。
- 手机号注册必须填写昵称、密码、确认密码和短信验证码。
- 登录支持“手机号 + 密码”或“手机号 + 短信验证码”二选一。
- 手机号不可绑定两个账号；系统不会自动合并邮箱账号和手机号账号。
- 已登录用户可通过 `bind_phone` 或 `change_phone` 场景绑定/更换手机号。

### 7.3 短信验证码

- 使用阿里云 SendSms。
- 6 位数字验证码，默认 5 分钟过期。
- 数据库只保存 `HMAC-SHA256(phone:scene:code)`，不保存明文。
- 同一手机号 60 秒内不可重发，1 小时最多 5 次；同一 IP 1 小时最多 20 次。
- 同一场景新验证码发出时，旧的未使用验证码会失效。
- 验证码只能使用一次；错误 5 次后失效。
- 短信发送失败会记录 `sendStatus=failed` 并向前端返回明确错误。

### 7.4 邮箱验证和密码重置

- 邮箱验证 token 和密码重置 token 均使用 32 字节随机值。
- 数据库只保存基于 `AUTH_SECRET` 的 HMAC 哈希。
- 默认 30 分钟过期，使用后写入 `usedAt`。
- 新 token 生成时会让旧的同类未使用 token 失效。
- 忘记密码无论邮箱是否存在都返回统一提示，避免账号枚举。
- 重置密码成功后删除该用户全部会话，要求重新登录。
- 开发环境缺少 SMTP 配置时可在服务端日志打印链接；生产环境配置缺失或发送失败会返回真实错误，不会假装发送成功。

### 7.5 密码存储

- 运行环境存在 `bcryptjs` 时使用 bcrypt，成本因子 12。
- 未安装 `bcryptjs` 时使用 Node.js `scrypt`，随机 16 字节盐和 64 字节派生值。
- 验证逻辑兼容历史 bcrypt 哈希和当前 scrypt 哈希。
- 当前 `package.json` 没有直接依赖 `bcryptjs`，因此标准安装默认使用 scrypt；不要在交接说明中误写为“始终使用 bcrypt”。

### 7.6 会话

- Cookie 名：`ai_image_session`。
- 有效期：30 天。
- Cookie 属性：`httpOnly`、`sameSite=lax`、`path=/`；生产环境由 `AUTH_COOKIE_SECURE=true` 开启 Secure。
- 浏览器持有随机 session token，数据库只保存 HMAC 哈希。
- 服务端每次通过 token hash 查找会话与用户，用户无法从 Cookie 直接还原数据库记录。

### 7.7 算术验证码与接口限流

- 邮箱注册和邮箱密码登录使用 1 至 20 的加减法验证码。
- 正确答案保存在签名的 httpOnly Cookie 中，有效期 5 分钟，验证成功或失败后立即失效。
- 邮箱注册：同 IP 每分钟最多 6 次。
- 邮箱登录：同 IP 每分钟最多 8 次。
- 手机号注册/登录也有进程内接口限流，短信发送另有数据库级限流。
- 通用接口限流存放在当前 Node 进程内，重启后清空，多实例之间不共享；高流量部署应迁移到 Redis 或网关级限流。

## 8. 图片任务核心链路

### 8.1 状态模型

任务状态：

```text
pending -> processing -> succeeded
pending -> processing -> failed
```

任务类型：

```text
edit
text_to_image
remove_background
image_enhance
object_remove
product
poster
```

### 8.2 创建和执行流程

1. 前端生成 UUID `requestId` 并提交工具参数。
2. Route Handler 校验登录和“手机号或邮箱至少一个已验证”。
3. 上传类任务在创建任务前完成图片解码和标准化。
4. 服务端在数据库写操作中校验可用额度和正在执行但未扣费的任务数。
5. `requestId` 同时作为 taskId；重复请求同一 ID 时返回原任务，不重复创建。
6. 写入 `pending` 任务后立即返回 `taskId`，不等待模型生成完成。
7. 当前 Next.js 进程以异步函数继续执行，把状态改为 `processing`。
8. 保存输入图片到 COS 或本地存储。
9. 调用当前图片 Provider。
10. 将模型结果保存到 COS 或本地存储。
11. 在同一数据库写操作中将任务更新为 `succeeded`、写入结果 URL、扣除 1 张额度并写流水。
12. 前端约每 2 秒轮询 `/api/tasks/[id]`，成功后展示结果，失败后展示原因。

### 8.3 幂等与额度保护

- taskId 冲突但用户或任务类型不一致时拒绝请求。
- `creditCharged` 和 `creditTransactions.taskId` 双重判断，防止成功任务重复扣费。
- 创建时会把 `pending`、`processing` 且未扣费的任务视为额度占用，防止网络重试并发透支。
- 只有结果存储成功且数据库成功提交后才扣额度。
- Provider、COS 或数据库任一环节失败，任务最终为 `failed`，不写 `consume` 流水。

### 8.4 网络重试与结果恢复

- 对 408、425、429、5xx 和常见网络/socket 错误自动重试 1 次，总计最多 2 次 Provider 调用。
- 若模型提示图片不兼容，会强制重新编码标准 PNG 后再重试一次。
- 任务异常结束前会先检查目标存储是否已有结果。
- Codex Provider 额外查询 Python job API 和任务工作目录中的 `result.png`/最近有效图片。
- 用户轮询一个长时间无结果的任务时，也会按节流规则触发恢复检查。
- 找到真实结果后会走同一 `completeTask` 流程，保存结果并幂等扣费。

### 8.5 重要实现边界

当前异步执行是 Next.js 进程内的 `void async`，不是独立消息队列：

- 进程重启可能中断正在运行的任务。
- Codex 任务可通过 job API 或磁盘结果恢复；OpenAI-compatible 调用在进程退出后无法继续获得原 HTTP 响应。
- 多实例部署需要确保数据库幂等，同时建议后续引入持久化队列和独立 worker。
- 当前任务模型没有 `queued_at`、`started_at`、`finished_at` 独立字段，耗时主要依据 `createdAt`/`updatedAt` 和结构化日志计算。

## 9. 图片输入、尺寸与提示词设计

### 9.1 输入格式兼容

- 直接支持：JPEG、PNG、WebP。
- 自动转换：HEIC、HEIF、AVIF、TIFF、GIF、BMP。
- 原始文件上限：50MB。
- Provider 输入内部上限：10MB。
- 所有 Provider 输入最终为单帧、8 位、sRGB PNG。
- CMYK、灰度、调色板、16 位和多帧图片会在任务创建前标准化；动画取第一帧。
- 合规且不超限的标准 PNG 尽量保留；只有格式、色彩、位深、动画或体积不符合时才重新编码。
- 若转换后仍超过 10MB，按文件体积逐步等比缩小，不设置固定最长边，不主动放大图片。
- 无法解码的文件在模型调用前返回错误，因此不创建耗时模型任务、不扣额度。

### 9.2 输出尺寸策略

模型侧只使用当前接口支持的固定规格：

- `1024x1024`；
- `1024x1536`；
- `1536x1024`；
- `auto`。

选择优先级：

1. 用户提示词明确写出的比例或横竖方向；
2. 前端明确传入的横版/竖版尺寸；
3. 上传原图宽高方向；
4. 无输入图的文生图默认方形。

模型接口无法原样输出任意像素尺寸，系统只能选择最接近的横、竖、方规格。该限制来自 Provider 接口，不是前端 CSS 裁切。

### 9.3 提示词设计原则

- 先写任务类型，再写用户要求，并标明用户要求优先。
- 只补充必要的保持约束，不替用户重新创作意图。
- 编辑类强调“未提及内容保持不变”。
- 商品图强调商品结构和包装文字不变。
- 去杂物强调只处理目标区域并自然补全。
- 海报默认不生成文字，避免乱码和不可控排版。
- 尺寸指导作为最后一行附加，避免覆盖主要需求。

## 10. 图片 Provider 设计

### 10.1 Provider 抽象

统一接口位于 `src/lib/server/image-provider.ts`：

- `editImage`：AI 修图、图片增强、去杂物、商品图；
- `generateImage`：文生图、封面海报；
- `removeBackground`：智能抠图。

Provider 只返回结果 URL 或 data URL，任务服务负责存储、数据库和额度结算。

### 10.2 OpenAI-compatible Provider

- `IMAGE_PROVIDER=openai`。
- 使用 `openai` npm SDK。
- 模型读取 `IMAGE_MODEL`，代码默认值为 `gpt-image-1`；生产实际模型以 `.env.local` 为准。
- `OPENAI_BASE_URL` 或兼容的 `OPENAI_API_BASE_URL` 可指定中转站 `/v1` 地址；留空时 SDK 使用默认服务地址。
- 图片编辑前强制确认输入是标准 PNG。
- 结果优先读取 `b64_json`，也支持服务返回 URL。
- 智能抠图当前复用图片编辑接口并强制 PNG 输出。

### 10.3 Codex Provider

- `IMAGE_PROVIDER=codex`。
- Next.js 调用本机 Python 服务的 `/v1/jobs/reference`、`/v1/jobs/text` 和 `/v1/jobs/{id}`。
- Python 服务应只监听 `127.0.0.1`，不建议直接暴露公网。
- 支持长超时、结果宽限期和工作目录恢复。

### 10.4 Mock Provider

- `IMAGE_API_MODE=mock` 时启用。
- 不调用真实模型，用于本地页面、账号、任务、历史记录和 CI 冒烟测试。
- `IMAGE_PROVIDER=openai` 但缺少 `OPENAI_API_KEY` 时也会降级为 mock；生产环境应通过启动检查避免错误降级。

## 11. 图片存储设计

### 11.1 COS 模式

启用条件：`IMAGE_STORAGE_PROVIDER=cos` 或 `TENCENT_COS_ENABLED=true`。

对象 key 结构：

```text
{TENCENT_COS_KEY_PREFIX}/users/{userId}/tasks/{taskId}/input.png
{TENCENT_COS_KEY_PREFIX}/users/{userId}/tasks/{taskId}/result.png
```

实际扩展名依据图片 MIME 类型确定。

- 私有 Bucket 默认通过 `/api/storage/images/[...key]` 鉴权代理读取。
- 配置公开域名/CDN 后也可直接返回公开 URL。
- COS 读取有进程内 LRU 风格缓存：10 分钟、总计 64MB、单项最大 16MB。
- 列表预览通过 COS `imageMogr2` 生成 WebP 缩略图，减少大原图下载。

### 11.2 本地模式

- 上传和普通结果写入 `public/generated/{userId}/{taskId}/`。
- Codex 工作目录图片也可通过受限 `/api/task-images` 路由读取。
- 免费体验的无水印原图存放在 `CODEX_IMAGE_API_WORKDIR/private-results`，不会直接暴露为 public URL。

### 11.3 私有结果与水印

- 首次免费任务同时保存无水印私有结果和带水印公开预览。
- 私有引用格式为内部 `imagegood-private:` 前缀，不会直接返回给普通前端。
- `/api/tasks/[id]/download` 校验任务所有权、管理员身份、单任务解锁或用户是否存在已支付订单。
- 下载响应使用 `private, no-store`，并设置 `nosniff`。

### 11.4 本地临时目录清理

`TENCENT_COS_CLEAN_LOCAL_TASK_DIR=true` 时，只在结果成功上传且数据库成功后清理对应的：

```text
{CODEX_IMAGE_API_WORKDIR}/tasks/{taskId}
```

代码会校验路径，不会扫描或删除服务器其他目录。建议生产开启前先验证 COS 结果可访问，并保留数据库和 COS 备份。

## 12. 数据库与数据模型

### 12.1 双模式数据层

`src/lib/db.ts` 根据 `DATABASE_URL` 自动选择：

- `file:./dev.db`：本地 JSON 文件；
- `mysql://...` 或 `mysql2://...`：生产 MySQL。

当前不是传统的“一张业务表对应一个模型”。MySQL 使用集合式 JSON 记录：

```sql
imagegood_records(
  collection VARCHAR(64),
  id VARCHAR(191),
  record JSON,
  record_hash CHAR(64),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY(collection, id)
)
```

另有 `imagegood_meta` 元数据表。业务记录放在 `record` JSON 中，`record_hash` 用于乐观并发控制。

### 12.2 MySQL 写入机制

1. 读取当前快照和每条记录 hash；
2. 在内存中执行现有 `withDb` mutator；
3. 计算新增、更新和删除差异；
4. 在 InnoDB 事务中使用旧 hash 作为更新条件；
5. 检测到写冲突、死锁或锁等待超时后最多重试 3 次。

该机制避免了过去对全局 `db_lock FOR UPDATE` 的长时间独占，但仍属于兼容本地 JSON 设计的数据层。高并发或大数据量阶段应逐步迁移为规范化关系表和针对字段的索引。

### 12.3 业务集合

| collection | 主要内容 |
| --- | --- |
| `users` | 账号、验证状态、角色、永久额度及历史会员兼容字段 |
| `sessions` | 会话 token hash、用户、过期时间 |
| `emailVerificationTokens` | 邮箱验证 token hash、过期和使用时间 |
| `passwordResetTokens` | 密码重置 token hash、过期和使用时间 |
| `smsCodes` | 手机号、场景、验证码 hash、过期、发送状态和失败次数 |
| `creditTransactions` | 赠送、消耗、购买、退款和管理员调整流水 |
| `orders` | 套餐快照、金额、额度、支付渠道、订单号和状态 |
| `imageTasks` | 图片任务输入、提示词、状态、结果、免费水印和扣费标记 |
| `analyticsEvents` | 页面访问、购买点击和来源反馈事件 |
| `analyticsDailySummaries` | 按北京时间归档的访问类日汇总 |

### 12.4 关键字段

用户：

- `email`、`phone` 均可为空；
- `emailVerified`、`phoneVerified` 决定完整功能权限；
- `credits` 是当前正式的永久图片额度；
- `role` 为 `user` 或 `admin`；
- `membership*` 为历史会员方案兼容字段，当前新套餐不使用。

图片任务：

- `id`、`userId`、`type`、`tool`；
- `prompt`、`provider`；
- `status`；
- `inputImageUrl`、`resultImageUrl`、`resultImages`；
- 私有 `originalResultImages`；
- `isFreeTrial`、`hasWatermark`、`unlockedAt`；
- `creditCharged`；
- `title`、`isFavorite`、`errorMessage`；
- `createdAt`、`updatedAt`。

订单：

- 套餐 ID、类型、名称、金额分、额度数量均作为订单快照保存，因此调整新套餐不会改变历史订单；
- `outTradeNo` 为本地商户订单号；
- `transactionId` 为支付平台交易号；
- 状态为 `pending`、`paid`、`cancelled`、`expired`、`failed`；
- 支付渠道为 `wechat`、`alipay` 或历史 `manual`。

### 12.5 数据初始化与迁移

```bash
npm run db:push
```

- 本地模式：创建空 JSON 文件。
- MySQL 模式：创建 `imagegood_records`、`imagegood_meta` 和必要字段。

从本地 JSON 迁移到 MySQL：

```bash
npm run db:migrate-json -- /absolute/path/to/prod.db
```

迁移前必须备份目标 MySQL 和源 JSON；迁移后执行：

```bash
npm run db:audit-records
```

## 13. 额度、免费体验和流水

### 13.1 新用户额度

- 邮箱注册和手机号注册都赠送 1 张。
- 同时写入一条 `type=grant`、`amount=1` 的额度流水。

### 13.2 任务消耗

- 当前所有任务成功消耗 1 张。
- 无限次历史权益用户不扣永久额度；该逻辑用于兼容旧订单。
- 流水类型为 `consume`，绑定 `taskId`，reason 记录 AI 修图、商品图、文生图等任务名称。

### 13.3 购买到账

- 支付订单金额用整数分保存和校验。
- 支付成功后增加 `user.credits`，并写 `purchase` 流水。
- 管理员异常补发写 `admin_adjust` 流水。
- 旧会员、旧单次解锁逻辑仍可正确处理历史订单，但当前价格页不会创建这些订单。

## 14. 支付设计

### 14.1 创建支付订单

主接口：`POST /api/payment/create`。

1. 校验登录和已验证联系方式；
2. 从活动套餐配置中读取金额和额度，前端不能传价格；
3. 创建 30 分钟过期的本地 `pending` 订单；
4. 生成唯一 `AIIMG_时间戳_随机串` 商户订单号；
5. 根据 provider 调用微信或支付宝；
6. 保存微信 `codeUrl` 或支付宝 `paymentUrl`；
7. 返回订单 ID，前端进入结算页。

`POST /api/orders` 是兼容入口，也会调用同一创建服务；新代码优先使用 `/api/payment/create`。

### 14.2 微信支付 APIv3

- 支付方式：Native 扫码。
- 服务端使用商户 API 私钥生成 `WECHATPAY2-SHA256-RSA2048` Authorization。
- `/api/payment/wechat/notify` 使用原始 body 和微信请求头验签。
- 当前使用微信支付平台证书方式验签，并根据回调 serial 选择配置证书。
- 使用 APIv3 Key 对 resource 做 AES-256-GCM 解密。
- 校验商户号、订单号、金额和 `SUCCESS` 状态。

### 14.3 支付宝电脑网站支付

- 接口：`alipay.trade.page.pay`。
- 服务端使用应用私钥生成 RSA2 签名，返回跳转 URL。
- `/api/payment/alipay/notify` 读取表单参数并使用支付宝公钥验签。
- 校验 app_id、out_trade_no、整数分金额以及 `TRADE_SUCCESS`/`TRADE_FINISHED`。
- `/checkout/alipay/return` 只是用户返回页，不是到账依据。
- 当前代码采用普通公钥模式；证书模式环境变量只是预留，未接入当前主流程。

### 14.4 统一到账和幂等

微信和支付宝最终都调用 `markOrderPaid`：

- 订单已 paid 时只校验本次通知并返回，不重复发放；
- 校验失败把订单标记为 failed 并保存错误；
- 校验成功后在同一数据库写操作中更新订单、增加额度、写流水；
- 保存支付平台交易号和支付时间；
- 重复回调不会重复增加额度。

### 14.5 Mock 支付

- `PAYMENT_MODE=mock` 时不调用真实平台。
- `/api/payment/mock/mark-paid` 仅在 mock 模式可用，登录用户只能操作自己的订单，管理员可操作任意订单。
- 真实环境必须设置 `PAYMENT_MODE=real`。

### 14.6 管理员异常补发

- `/admin/orders` 可按支付渠道、状态分页查看订单。
- 正常订单依赖支付平台异步通知自动到账。
- “异常补发权益”只用于回调丢失或人工核实后的补单，并有二次确认。
- 已支付订单按钮禁用，公共幂等逻辑也会防止重复发放。

## 15. 运营后台与数据统计

### 15.1 权限

- 用户 `role=admin` 才能访问 `/admin/*` 页面和 API。
- 前端隐藏不是安全边界；所有管理员 Route Handler 都再次校验会话和角色。

### 15.2 运营数据 `/admin/analytics`

当前统计包括：

- 累计和今日访问量、独立访客；
- 注册用户、已验证用户、近 7 天登录访问用户；
- 图片任务、成功率、类型分布和额度消耗；
- 支付订单、支付人数、收入、复购人数和复购率；
- 单个注册用户价值；
- 微信/支付宝、套餐销售和来源渠道；
- 北京时间趋势和转化漏斗。

当前漏斗重点：

- 访问首页 -> 进入工具；
- 查看价格页 -> 创建订单；
- 创建订单 -> 支付成功；
- 首次付费 -> 再次购买。

统计身份优先使用 `userId`，未登录阶段使用 `visitorId`，并通过后续事件把同一 visitor 映射到登录用户。由于浏览器清理存储、跨设备和广告拦截，访问类指标不是严格的财务审计数据；订单和收入以数据库订单为准。

### 15.3 访问事件

客户端只上报：

- `page_view`；
- `purchase_click`；
- `acquisition_channel`。

事件要求 visitorId 和 sessionId，不记录 API 路径。metadata 最多 12 个简单字段并做长度限制。原始事件最多保留 20,000 条，同时把访问类数据按北京时间写入 `analyticsDailySummaries`，避免累计访问量随旧事件裁剪而下降。

支付来源反馈当前是选填，不会阻止用户继续生成。强制校验类仍作为兼容代码存在，但当前图片接口没有调用。

### 15.4 管理员任务 `/admin/tasks`

- 支持按邮箱、手机号、用户 ID、任务 ID搜索；
- 支持类型和状态筛选；
- 每页 10 条；
- 展示输入图、结果图、提示词、状态和是否扣费；
- 页面为只读，不提供删除用户任务或修改用户图片功能。

### 15.5 飞书日报

```bash
npm run ops:daily-report
```

读取 MySQL/本地数据层，不抓取管理员页面 HTML。内容包括昨日或今日用户、图片、支付、套餐销售、访问以及累计数据。统计时间按北京时间。

机器人 Webhook 可选签名；日志不会打印完整 Webhook。服务器定时任务由系统 crontab 负责，代码更新本身不会自动创建或恢复 crontab。

北京时间每日 08:00 示例：

```cron
0 8 * * * /bin/bash -lc 'cd /data/Photoshop && npm run ops:daily-report >> /data/Photoshop/logs/feishu-daily-report.log 2>&1'
```

### 15.6 设置管理员

项目没有公开的管理员注册入口。管理员身份来自用户记录的 `role=admin`，应由已有管理员或数据库维护人员在核实账号后设置。

MySQL 示例（执行前先查询确认唯一账号，并备份对应记录）：

```sql
SELECT id, JSON_UNQUOTE(JSON_EXTRACT(record, '$.email')) AS email,
       JSON_UNQUOTE(JSON_EXTRACT(record, '$.phone')) AS phone,
       JSON_UNQUOTE(JSON_EXTRACT(record, '$.role')) AS role
FROM imagegood_records
WHERE collection = 'users'
  AND (
    LOWER(JSON_UNQUOTE(JSON_EXTRACT(record, '$.email'))) = LOWER('admin@example.com')
    OR JSON_UNQUOTE(JSON_EXTRACT(record, '$.phone')) = '13800138000'
  );
```

确认用户 ID 后更新，并将 `record_hash` 设为 NULL，让应用下一次写入时重新建立正确版本 hash：

```sql
UPDATE imagegood_records
SET record = JSON_SET(record, '$.role', 'admin'),
    record_hash = NULL
WHERE collection = 'users'
  AND id = '已确认的用户ID';
```

用户重新登录后即可看到管理员入口。不要通过前端 localStorage、修改 Cookie 或只隐藏/显示菜单来授予权限。

## 16. 图片展示与前端性能

### 16.1 SmartImage

统一图片组件提供：

- 骨架屏和淡入；
- 固定尺寸/比例，减少布局抖动；
- 非首屏懒加载；
- COS/任务图片预览宽度参数；
- 预览失败后自动退回原图；
- 350ms、900ms、1800ms 三次自动重试；
- 最终失败显示无破图图标的友好占位和手动重新加载。

### 16.2 预览图

- COS 模式优先使用服务端签名的 `imageMogr2` WebP 缩略图。
- 本地/代理模式使用 sharp 生成最长边限制内的 WebP 预览。
- 下载时仍使用原图，不用列表缩略图。

### 16.3 工作台状态

- 上传预览使用 object URL，不把大图 base64 写入 localStorage。
- 页面卸载时清理轮询和 object URL。
- 移动端工具页采用上下单任务流程和底部主操作按钮。
- 服务端 SDK 只从 `src/lib/server` 或 Route Handler 引用，避免进入客户端 bundle。

## 17. API 清单

### 17.1 账号

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/captcha` | 生成算术验证码 |
| POST | `/api/auth/register` | 邮箱注册 |
| POST | `/api/auth/login` | 邮箱密码登录 |
| POST | `/api/auth/register-phone` | 手机号验证码注册，密码必填 |
| POST | `/api/auth/login-phone` | 手机号密码或验证码登录 |
| POST | `/api/auth/sms/send-code` | 发送短信验证码 |
| POST | `/api/auth/phone` | 绑定或更换手机号 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 当前用户和可用额度 |
| POST | `/api/auth/change-password` | 修改密码 |
| POST | `/api/auth/verify-email` | 验证邮箱 token |
| POST | `/api/auth/resend-verification-email` | 重发验证邮件 |
| POST | `/api/auth/forgot-password` | 申请密码重置 |
| POST | `/api/auth/reset-password` | 使用 token 重置密码 |

### 17.2 图片和任务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/images/edit` | AI 修图 |
| POST | `/api/images/text-to-image` | 文生图 |
| POST | `/api/images/remove-background` | 智能抠图 |
| POST | `/api/images/enhance` | 图片增强 |
| POST | `/api/images/object-remove` | 去杂物 |
| POST | `/api/images/product` | 商品图 |
| POST | `/api/images/poster` | 封面海报 |
| GET | `/api/images/debug` | 图片 Provider 调试信息，注意只在受控环境使用 |
| GET | `/api/tasks` | 分页查询当前用户任务 |
| DELETE | `/api/tasks` | 批量删除当前用户已结束任务 |
| GET | `/api/tasks/[id]` | 查询并轮询任务详情 |
| PATCH | `/api/tasks/[id]` | 修改标题或收藏状态 |
| DELETE | `/api/tasks/[id]` | 删除单条任务记录 |
| GET | `/api/tasks/[id]/download` | 鉴权下载免费体验无水印结果 |
| GET | `/api/storage/images/[...key]` | 鉴权读取 COS 图片及缩略图 |
| GET | `/api/task-images/[taskId]/[filename]` | 读取受限本地任务图片 |

### 17.3 额度和支付

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/billing/packages` | 当前活动套餐，缓存 5 分钟 |
| GET | `/api/credits/transactions` | 当前用户最近 50 条额度流水 |
| POST | `/api/payment/create` | 主支付创建入口 |
| GET | `/api/payment/orders/[id]` | 查询自己的订单状态；管理员可查全部 |
| GET | `/api/payment/orders/by-out-trade-no/[outTradeNo]` | 支付宝返回页按商户订单号查询 |
| POST | `/api/payment/wechat/notify` | 微信异步通知，免登录但必须验签 |
| POST | `/api/payment/alipay/notify` | 支付宝异步通知，免登录但必须验签 |
| POST | `/api/payment/mock/mark-paid` | 仅 mock 模式模拟支付成功 |
| POST | `/api/orders` | 兼容订单创建入口 |
| GET/PATCH | `/api/orders/[id]` | 查询订单或更新备注 |

### 17.4 运营和管理员

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/analytics/track` | 页面、购买点击和来源事件 |
| GET | `/api/admin/analytics` | 管理员运营看板数据 |
| POST | `/api/admin/analytics/send-feishu-report` | 管理员手动发送飞书日报 |
| GET | `/api/admin/orders` | 管理员分页订单列表 |
| POST | `/api/admin/orders/[id]/confirm` | 异常补发权益 |
| GET | `/api/admin/tasks` | 管理员只读任务查询 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/templates` | 历史模板兼容接口，非当前主入口 |

## 18. 环境变量分组

完整模板以 `.env.example` 为准。交接时不要复制真实值到飞书。

### 18.1 应用和认证

- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`
- `AUTH_COOKIE_SECURE`

### 18.2 数据库

- `DATABASE_URL`
- `MYSQL_CONNECTION_LIMIT`

### 18.3 图片 Provider

- `IMAGE_API_MODE`
- `IMAGE_PROVIDER`
- `IMAGE_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `CODEX_IMAGE_API_BASE_URL`
- `CODEX_IMAGE_API_TIMEOUT_SECONDS`
- `CODEX_IMAGE_API_WORKDIR`
- `CODEX_RESULT_GRACE_SECONDS`
- `CODEX_MODEL`

### 18.4 图片存储

- `IMAGE_STORAGE_PROVIDER`
- `TENCENT_COS_ENABLED`
- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_REGION`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_KEY_PREFIX`
- `TENCENT_COS_PUBLIC_BASE_URL`
- `TENCENT_COS_USE_PROXY`
- `TENCENT_COS_CLEAN_LOCAL_TASK_DIR`

### 18.5 短信和邮件

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_REGION_ID`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`
- `SMS_CODE_EXPIRE_MINUTES`
- `SMS_CODE_RESEND_SECONDS`
- `EMAIL_PROVIDER`
- `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`
- `SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`
- `EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES`
- `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`

### 18.6 支付

- `PAYMENT_PROVIDER`
- `PAYMENT_MODE`
- 微信：APPID、商户号、APIv3 Key、商户序列号、私钥路径、平台证书序列号/路径、notify URL。
- 支付宝：APP ID、应用私钥、支付宝公钥、网关、签名类型、notify URL、return URL。

### 18.7 飞书

- `FEISHU_BOT_WEBHOOK`
- `FEISHU_BOT_SECRET`
- `FEISHU_DAILY_REPORT_RANGE`

## 19. 本地启动与生产部署

### 19.1 本地 mock 模式

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

最小配置：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-string
AUTH_COOKIE_SECURE=false
DATABASE_URL=file:./dev.db
IMAGE_API_MODE=mock
IMAGE_STORAGE_PROVIDER=local
PAYMENT_MODE=mock
```

### 19.2 生产运行

```bash
npm install
npm run db:push
npm run build
npm run start:prod
```

服务器生产环境不要长期使用 `npm run dev`。建议使用 PM2 或 systemd 管理 Next.js 进程，并由 Nginx 负责 HTTPS 和反向代理。

PM2 示例：

```bash
pm2 delete imagegood
pm2 start npm --name imagegood -- run start:prod
pm2 save
```

如果使用 Codex Provider，另行启动 Python 图片服务；使用 OpenAI-compatible Provider 时不需要启动该 Python 服务。

### 19.3 压缩包更新注意事项

不要把以下持久化内容放进每次覆盖的项目压缩包：

- 生产 `.env.local`；
- MySQL 数据；
- 支付私钥和平台证书；
- Codex 工作目录；
- Nginx 证书；
- 日志和导出的用户分析文件。

依赖或 `package-lock.json` 变化后必须重新 `npm install`。任何服务端代码变化都需要重新 `npm run build` 并重启生产进程。

### 19.4 备份建议

- MySQL：至少每日自动备份，变更套餐、迁移数据或批量修复前增加一次手工快照；恢复演练比“存在备份文件”更重要。
- COS：确认 Bucket 生命周期不会误删仍被数据库引用的图片；如启用版本控制，需要同步评估存储成本。
- 配置：备份环境变量的变量名和用途，真实值放密码管理工具，不放 Git、飞书正文或普通压缩包。
- 支付证书：保留可恢复副本、文件权限和到期提醒；轮换后同步更新服务器路径并重启进程。
- 本地模式：`dev.db`/生产 JSON 文件必须放在项目覆盖目录之外，避免上传压缩包时重置用户和订单。

## 20. 自动化、测试与运维命令

| 命令 | 用途 | 是否写数据/调用外部服务 |
| --- | --- | --- |
| `npm run lint` | Next.js ESLint | 否 |
| `npx tsc --noEmit` | TypeScript 类型检查 | 否 |
| `npm run build` | 生产构建 | 生成 `.next` |
| `npm run test:smoke` | 核心页面/API 冒烟测试 | 不生成图片、不创建支付订单 |
| `npm run test:image-formats` | 图片格式标准化回归 | 本地转换，不调用模型 |
| `npm run ops:quality-baseline` | 页面质量基线 | 读取页面，生成报告 |
| `npm run ops:task-audit` | 最近任务成功率、耗时、失败和卡住任务 | 只读数据库 |
| `npm run ops:daily-report` | 生成并发送飞书运营日报 | 读数据库、调用飞书 |
| `npm run ops:export-image-pairs` | 导出用户输入/结果对照用于分析 | 读取数据库和图片存储，注意数据合规 |
| `npm run db:audit-records` | 检查数据库记录完整性 | 只读 |
| `npm run db:migrate-json -- <path>` | JSON 迁移 MySQL | 写目标数据库，执行前备份 |

GitHub CI 使用 Node.js 20，在 mock、本地 JSON、本地存储和 mock 支付模式下执行：

1. `npm ci`；
2. `npm run db:push`；
3. `npm run lint`；
4. `npx tsc --noEmit`；
5. `npm run build`；
6. 启动生产服务并执行 `npm run test:smoke`。

## 21. 日志与故障排查

### 21.1 图片任务日志

每条图片任务日志都是单行 JSON，以 `[image-task]` 开头，包含：

- taskId；
- 脱敏 userId；
- taskType、provider、status；
- stage 和 operation；
- 阶段耗时和总耗时；
- 输入/输出图片数量；
- 存储类型；
- 是否扣费和扣费数量；
- 已脱敏错误摘要。

正常顺序：

```text
task.created
task.processing
stage.started / stage.succeeded (input_storage)
stage.started / stage.succeeded (provider)
stage.started / stage.succeeded (result_storage)
stage.started / stage.succeeded (database)
task.succeeded
```

按 taskId 查询：

```bash
grep '"taskId":"任务ID"' /path/to/application.log
```

### 21.2 常见问题定位

图片失败：

1. 查看任务 `errorMessage`；
2. 按 taskId 查结构化日志；
3. 判断失败阶段是输入转换、Provider、COS 还是数据库；
4. 检查 Provider 模型名和真实接口能力；
5. 检查服务器到模型接口的网络；
6. 检查 COS 配置和 Bucket 权限。

图片生成成功但前端不显示：

1. 直接访问任务详情 API；
2. 检查 `resultImages` 是否为可访问 URL；
3. 检查 `/api/storage/images` 返回状态；
4. 检查 COS key 是否属于该用户和任务；
5. 检查 Nginx 是否把 Cookie、Host 和 HTTPS 协议头正确转发。

支付不到账：

1. 查询本地订单 status、outTradeNo 和 amountCents；
2. 查看支付平台回调是否到达；
3. 检查 notify URL 公网 HTTPS；
4. 检查微信平台证书 serial 或支付宝公钥；
5. 检查金额和商户/APP ID 校验日志；
6. 仅在确认真实支付后使用管理员异常补发。

登录慢或数据库锁：

1. 检查 MySQL 网络、连接数和慢查询；
2. 检查是否仍运行旧版本全局 `db_lock FOR UPDATE` 代码；
3. 当前版本应使用 `record_hash` 乐观并发和最多 3 次重试；
4. 执行 `npm run db:audit-records` 检查异常记录。

### 21.3 健康检查

```text
GET /api/health
```

返回 `status=ok` 只表示 Next.js API 进程可响应，不代表 MySQL、COS、模型和支付平台全部可用。完整上线检查需要分别验证外部依赖。

## 22. 安全与合规

- `.env.local`、`.env`、`*.pem`、`certs/`、`secrets/` 已在 `.gitignore` 中。
- 私钥和证书应放在服务器受限目录，并用绝对路径配置；不要长期放项目根目录。
- 前端不得新增 `NEXT_PUBLIC_` 前缀的密钥变量。
- 支付 notify 免登录但必须验签、验订单号、验商户/APP ID、验金额和状态。
- 用户只能读取自己的任务和订单；管理员 API 服务端校验 `role=admin`。
- 管理员任务页涉及用户上传图片，只能授权给业务必要人员，并应记录使用目的。
- 导出用户输入/结果进行分析前，应确认隐私授权、最小化下载范围并设置保留期限。
- 产品前台包含轻量合规提醒，禁止将图片能力用于违法、侵权或其他不当目的。
- 如果任何密钥曾进入聊天、公开仓库或截图，应立即在对应平台轮换；仅删除文件不能消除泄露风险。

## 23. 已知限制与技术债

1. 图片后台任务运行在 Next.js 进程内，不是持久化队列，进程重启恢复能力有限。
2. MySQL 使用集合式 JSON 兼容层，不是规范化关系模型；数据增大后全量快照和 JSON 查询会成为性能瓶颈。
3. 通用登录限流在单进程内存中，多实例不共享。
4. 历史记录删除不会同步清理 COS/本地文件，长期运行需要对象生命周期和延迟删除任务。
5. OpenAI-compatible 智能抠图是提示词式图片编辑，透明边缘质量受模型能力影响。
6. Provider 配置缺失时部分情况会降级 mock；生产应增加严格启动配置检查和告警。
7. SMTP 是自实现轻量客户端，不包含邮件队列、退信跟踪和投递监控。
8. 运营访问数据依赖浏览器 visitorId，不能替代专业埋点平台或财务数据。
9. 旧会员、旧单次解锁和旧套餐兼容字段仍在类型和服务中，增加维护复杂度，但不能直接删除，否则会影响历史订单。
10. 当前没有自动退款流程。任何退款需在支付平台人工处理，并同步制定额度回收和流水规则。
11. `/templates` 和 `/api/templates` 是历史兼容入口，不属于当前前台重点功能。
12. 当前 `SECURITY.md` 的专用安全联系邮箱仍是占位符，上线开源前需替换为真实私密渠道。
13. `/api/images/debug` 当前未做登录或管理员鉴权。它不返回 API Key，但会返回 Provider 模式和 Codex 服务地址；生产环境建议改为管理员专用或关闭。

## 24. 后续建议优先级

### P0：稳定性

- 引入持久化任务队列和独立 worker；
- 为 pending/processing 任务增加租约、心跳、自动重试和死任务恢复；
- 增加外部服务健康检查和生产配置启动校验；
- 建立 MySQL、COS 和支付配置的定期备份/恢复演练。

### P1：数据和成本

- 把用户、任务、订单、流水逐步迁移为规范化 MySQL 表；
- 为常用字段建立真实索引；
- 增加模型、质量、usage 和估算成本字段；
- 建立 COS 生命周期、孤立对象清理和历史记录软删除。

### P2：运营和体验

- 增加真实任务阶段或 worker 心跳，而不是仅靠前端时间文案；
- 对模型错误按类型形成自动告警；
- 完善图片内容安全与申诉流程；
- 对访问埋点增加同意管理、留存策略和数据字典。

## 25. 交接清单

### 25.1 代码与权限

- [ ] GitHub 仓库管理员和分支保护权限已移交。
- [ ] 生产服务器、PM2/systemd、Nginx 和日志权限已移交。
- [ ] 当前部署 commit/tag 已记录。
- [ ] `.env.local` 通过安全渠道移交，没有粘贴到飞书正文。

### 25.2 外部服务

- [ ] MySQL 地址、账号、白名单和备份策略已移交。
- [ ] COS Bucket、Region、密钥权限和生命周期策略已移交。
- [ ] 图片 Provider 账号、模型名、Base URL、配额和账单负责人已移交。
- [ ] 微信商户号、APPID、APIv3 Key、商户私钥、平台证书和回调地址已移交。
- [ ] 支付宝 APPID、应用私钥、支付宝公钥和回调地址已移交。
- [ ] 阿里云短信 AccessKey、签名、模板和余量告警已移交。
- [ ] SMTP 账号、专用密码和发件人已移交。
- [ ] 飞书机器人 Webhook、签名密钥和群管理员已移交。

### 25.3 数据验证

- [ ] 能注册邮箱账号并完成邮箱验证。
- [ ] 能注册手机号账号并使用密码/验证码登录。
- [ ] 能创建图片任务、轮询、展示和下载结果。
- [ ] 成功任务扣 1 张，失败任务不扣。
- [ ] 免费体验结果有水印，付费后可下载无水印结果。
- [ ] 微信和支付宝测试订单可正确回调、幂等到账。
- [ ] 普通用户不能访问管理员页面和 API。
- [ ] 飞书日报可手动发送，crontab 和日志路径正确。

### 25.4 上线前命令

```bash
npm install
npm run db:push
npm run lint
npx tsc --noEmit
npm run build
npm run test:smoke -- --base-url=https://你的正式域名
```

## 26. 关键代码索引

| 领域 | 文件 |
| --- | --- |
| 数据层 | `src/lib/db.ts` |
| 账号业务 | `src/lib/auth.ts` |
| 密码 | `src/lib/password.ts` |
| 会话 | `src/lib/session.ts` |
| 验证码 | `src/lib/captcha.ts`、`src/lib/rate-limit.ts` |
| 短信 | `src/lib/server/sms/aliyun-sms-service.ts` |
| 邮件 | `src/lib/server/email-service.ts` |
| 图片任务 | `src/lib/server/image-task-service.ts` |
| 图片 Provider | `src/lib/server/image-provider.ts` |
| OpenAI-compatible | `src/lib/server/openai-image-service.ts` |
| Codex | `src/lib/server/codex-image-provider.ts`、`server/codex_image_api.py` |
| 输入兼容 | `src/lib/server/image-input-normalizer.ts` |
| 尺寸策略 | `src/lib/server/image-size-policy.ts` |
| 提示词 | `src/lib/server/image-prompt-builder.ts` |
| 图片存储 | `src/lib/server/image-storage.ts`、`src/lib/server/cos-storage.ts` |
| 图片预览 | `src/lib/server/image-preview.ts`、`src/components/ui/SmartImage.tsx` |
| 任务日志 | `src/lib/server/image-task-observability.ts` |
| 套餐配置 | `src/config/billing-plans.ts` |
| 支付服务 | `src/lib/server/payment/payment-service.ts` |
| 微信支付 | `src/lib/server/payment/wechat-pay-provider.ts`、`wechat-crypto.ts` |
| 支付宝 | `src/lib/server/payment/alipay-provider.ts` |
| 历史记录 | `src/app/history/page.tsx`、`src/app/api/tasks/*` |
| 运营看板 | `src/app/admin/analytics/page.tsx`、`src/app/api/admin/analytics/route.ts` |
| 飞书日报 | `src/lib/server/analytics/*`、`src/lib/server/feishu/feishu-bot.ts` |
| 全局导航 | `src/components/layout/SiteHeader.tsx` |
| 生成中 UI | `src/components/ui/GenerationLoadingPanel.tsx` |
| 环境配置 | `.env.example`、`docs/configuration.md` |

---

交接完成后，建议接手人在生产同配置的隔离环境中完整走一遍“注册 -> 验证 -> 免费生成 -> 水印结果 -> 购买 -> 支付回调 -> 无水印下载 -> 历史记录 -> 后台查询 -> 飞书日报”闭环，再正式接管线上发布权限。
