# 服务器部署说明：Next.js + Codex 图片 API

这套部署由两个进程组成：

```text
浏览器
  -> Nginx / 域名
  -> Next.js 应用，默认 3000 端口
  -> 本机 Codex 图片 API，默认 127.0.0.1:8000
  -> Codex CLI 生成图片
```

浏览器不会直接访问 `codex_image_api.py`，也不会接触 OpenAI Key 或 Codex 凭据。Python 图片 API 建议只监听 `127.0.0.1`。

## 1. 准备服务器

推荐环境：

- Ubuntu 22.04 或更新版本
- Node.js 20+
- Python 3.10+
- Nginx
- pm2 或 systemd
- 已安装并登录可用的 Codex CLI

确认 Codex CLI 可用：

```bash
which codex
codex --version
codex exec --help
```

如果你准备使用普通用户运行服务，请用同一个用户测试 Codex：

```bash
sudo -u appuser codex exec --help
```

## 2. 部署项目代码

示例目录：

```bash
sudo mkdir -p /opt/imagegood
sudo chown -R appuser:appuser /opt/imagegood
cd /opt/imagegood
git clone <your-repo-url> .
npm install
```

如果没有使用 Git，也可以把项目目录上传到 `/opt/imagegood`。

## 3. 配置 Next.js 环境变量

在项目根目录创建 `.env.local`：

```bash
IMAGE_API_MODE=real
IMAGE_PROVIDER=codex
CODEX_IMAGE_API_BASE_URL=http://127.0.0.1:8000
CODEX_IMAGE_API_TIMEOUT_SECONDS=900

# 只有使用 OpenAI provider 时才需要
OPENAI_API_KEY=
IMAGE_MODEL=gpt-image-1
```

含义：

- `IMAGE_API_MODE=real`：启用真实图片调用。
- `IMAGE_PROVIDER=codex`：调用 `server/codex_image_api.py`。
- `CODEX_IMAGE_API_BASE_URL`：Next.js 服务端访问 Python 图片 API 的地址。
- `CODEX_IMAGE_API_TIMEOUT_SECONDS`：Next.js 等待 Python 图片 API 返回的最长时间。

本地演示或没有 Codex 服务时，可以改成：

```bash
IMAGE_API_MODE=mock
```

## 4. 启动 Codex 图片 API

项目已经包含：

```text
server/codex_image_api.py
```

先手动测试：

```bash
mkdir -p /data/codex_image_api_runs
HOST=127.0.0.1 PORT=8000 CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs python3 server/codex_image_api.py
```

另开一个终端测试健康检查：

```bash
curl http://127.0.0.1:8000/health
```

应该返回：

```json
{"ok": true}
```

测试文生图接口：

```bash
curl -X POST http://127.0.0.1:8000/v1/images/text \
  -H "Content-Type: application/json" \
  -d '{"prompt":"生成一张干净的蓝白色海报背景，不要文字"}' \
  --output /tmp/codex-test.png
```

测试参考图编辑接口：

```bash
curl -X POST http://127.0.0.1:8000/v1/images/reference \
  -F "prompt=把背景换成干净明亮的商业摄影背景，主体保持不变" \
  -F "image=@/path/to/test.png" \
  --output /tmp/codex-edit-test.png
```

## 5. 用 systemd 托管 Python 图片 API

创建服务文件：

```bash
sudo nano /etc/systemd/system/codex-image-api.service
```

填入：

```ini
[Unit]
Description=Codex Image API
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/imagegood
Environment=HOST=127.0.0.1
Environment=PORT=8000
Environment=CODEX_IMAGE_API_WORKDIR=/data/codex_image_api_runs
Environment=CODEX_BIN=codex
Environment=CODEX_TIMEOUT_SECONDS=900
Environment=MAX_UPLOAD_BYTES=20971520
ExecStart=/usr/bin/python3 /opt/imagegood/server/codex_image_api.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now codex-image-api
sudo systemctl status codex-image-api
```

查看日志：

```bash
journalctl -u codex-image-api -f
```

## 6. 启动 Next.js 应用

生产环境推荐：

```bash
npm run build
npm run start
```

如果你只是先验证服务器链路，也可以临时用：

```bash
npm run dev
```

用 pm2 托管生产服务：

```bash
npm install -g pm2
pm2 start npm --name imagegood -- run start
pm2 save
pm2 startup
```

Next.js 默认监听 `3000` 端口。

## 7. Nginx 反向代理

创建配置：

```bash
sudo nano /etc/nginx/sites-available/imagegood
```

示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 950s;
        proxy_send_timeout 950s;
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/imagegood /etc/nginx/sites-enabled/imagegood
sudo nginx -t
sudo systemctl reload nginx
```

如果使用 HTTPS，可以再用 certbot 配置证书。

## 8. 常见问题

### 页面仍然返回 mock 图片

检查 `.env.local`：

```bash
IMAGE_API_MODE=real
IMAGE_PROVIDER=codex
```

修改环境变量后，需要重启 Next.js。

### 页面提示模型调用失败

先查 Python API：

```bash
curl http://127.0.0.1:8000/health
journalctl -u codex-image-api -f
```

再确认 Next.js 能访问 Python API：

```bash
curl http://127.0.0.1:8000/health
```

### 上传后长时间等待

Codex 生成图片可能耗时较久，需要同时调大：

- `.env.local` 中的 `CODEX_IMAGE_API_TIMEOUT_SECONDS`
- Python 服务中的 `CODEX_TIMEOUT_SECONDS`
- Nginx 的 `proxy_read_timeout`

如果 Python API 返回 504，例如：

```text
Codex timed out after 900s. Job dir: /data/codex_image_api_runs/...
```

说明 Next.js 和 Python API 的连接是通的，真正卡住的是 Python 里启动的 `codex exec` 子进程。按下面顺序排查：

```bash
cd /data/codex_image_api_runs/<date>/<job-id>
cat command.txt
cat prompt.txt
cat stdout.txt 2>/dev/null
cat stderr.txt 2>/dev/null
```

然后直接复现那条命令：

```bash
cd /data/codex_image_api_runs/<date>/<job-id>
bash -lc "$(cat command.txt) < prompt.txt"
```

常见原因：

- Codex CLI 没有在当前运行用户下登录，子进程在等待认证。
- Codex CLI 所在环境不能联网，模型请求一直失败或重试。
- 当前 Codex CLI 不具备真实图片生成能力，只会执行文本/代码任务。
- 生成图片本身耗时超过 900 秒。

如果只是生成慢，可以把几个超时一起调大：

```bash
# Next.js .env.local
CODEX_IMAGE_API_TIMEOUT_SECONDS=1800

# Python API 启动环境
CODEX_TIMEOUT_SECONDS=1800

# Nginx
proxy_read_timeout 1850s;
proxy_send_timeout 1850s;
```

调试成功任务时想保留输出目录，可以给 Python API 加：

```bash
CODEX_IMAGE_API_KEEP_JOBS=1
```

如果你的图片生成不是由 `codex exec` 默认命令完成，而是由其他本地脚本或命令完成，可以配置 `CODEX_IMAGE_COMMAND` 覆盖默认命令。可用变量：

```text
$prompt_file
$output_path
$workdir
$reference_path
$reference_paths
$codex_bin
```

示例：

```bash
CODEX_IMAGE_COMMAND='python3 /opt/image-worker/generate.py --prompt-file $prompt_file --output $output_path --references $reference_paths'
```

### 图片过大

前端 Next API 当前限制单图 10MB。Python API 默认请求体最大 20MB。Nginx 示例中是 25MB。

### 不要公开 Python API

`codex_image_api.py` 建议只监听：

```bash
HOST=127.0.0.1
```

公网只暴露 Next.js 应用即可。
