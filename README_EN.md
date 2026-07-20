<div align="center">

# ImageGood

**An AI image creation and editing platform for creators, merchants, and everyday users**

[![CI](https://github.com/Xiaokang-Xue/ImageGood/actions/workflows/ci.yml/badge.svg)](https://github.com/Xiaokang-Xue/ImageGood/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Xiaokang-Xue/ImageGood?include_prereleases&label=release)](https://github.com/Xiaokang-Xue/ImageGood/releases)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.35-000000?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-525252)](LICENSE)

[Live site](https://imagegood.net) · [中文](README.md) · [Configuration](docs/configuration.md) · [Contributing](CONTRIBUTING.md)

</div>

<div align="center">
  <img src="docs/assets/screenshots/home.png" alt="ImageGood home page" width="980" />
</div>

## Overview

ImageGood provides AI image editing, text-to-image generation, background removal, image enhancement, object removal, product photography, and poster generation. Image jobs run asynchronously: the client polls a `taskId`, results are persisted before credits are charged, and failed jobs do not consume credits.

The repository also includes authentication, credits and orders, WeChat Pay and Alipay adapters, Tencent Cloud COS and local storage, generation history, an operations dashboard, and task diagnostics. Real image, messaging, and payment integrations require the relevant external credentials; the project can run locally in mock mode without them.

## Why ImageGood

| Area | Design goal |
| --- | --- |
| End-to-end product flow | Accounts, image jobs, credits, payments, object storage, history, and operations are integrated in one application. |
| Reliable job semantics | Asynchronous polling, charge-after-save behavior, no charge on failure, and idempotent payment fulfillment. |
| Replaceable infrastructure | OpenAI-compatible, Codex, and mock image providers; MySQL or local JSON; COS or local file storage. |
| Operations and observability | Smoke tests, page quality baselines, structured job logs, latency and success-rate audits. |

## Capabilities

`Stable` means the repository contains a maintained route and business flow. `Optional` features can be disabled. `Experimental` output still depends on the selected provider. `Requires external credentials` means production use needs third-party credentials or merchant approval.

| Module | Capabilities | Status |
| --- | --- | --- |
| Image creation | AI editing, text-to-image, enhancement, object removal, product images, posters | Stable · Requires external credentials |
| Background removal | Transparent PNG and solid-color background output | Experimental · Requires external credentials |
| Identity | Phone code/password login, email verification and reset, httpOnly cookie sessions | Stable; SMS and email are Optional · Requires external credentials |
| Credits and payment | Credit packages and ledger, WeChat Pay APIv3, Alipay page pay | Optional · Requires external credentials |
| History | Paginated task list, details, download, individual and bulk deletion | Stable |
| Administration | Order management, analytics, funnel reporting, acquisition feedback | Stable |
| Storage | Local files, Tencent Cloud COS, protected image proxy | Stable; COS is Optional · Requires external credentials |
| Observability | Smoke tests, quality baseline, structured logs, task audit, Feishu report | Stable; Feishu is Optional · Requires external credentials |

## Product Preview

The live deployment is available at [imagegood.net](https://imagegood.net). Actual generation quality depends on the configured provider, model capabilities, prompt, and source material.

## Image Job Flow

![ImageGood image job flow](docs/assets/diagrams/image-task-flow.png)

Provider, storage, or database failures move the task to `failed` without charging credits.

## System Architecture

![ImageGood system architecture](docs/assets/diagrams/system-architecture.png)

The browser only calls Next.js pages and Route Handlers; provider, database, storage, messaging, and payment secrets remain server-side.

## Quick Start

Node.js 20 LTS is recommended. The following mode does not call real image or payment services.

```bash
git clone https://github.com/Xiaokang-Xue/ImageGood.git
cd ImageGood
npm install
cp .env.example .env.local
```

Set the minimum mock configuration in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-string
AUTH_COOKIE_SECURE=false
DATABASE_URL=file:./dev.db
IMAGE_API_MODE=mock
IMAGE_STORAGE_PROVIDER=local
PAYMENT_MODE=mock
```

```bash
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [docs/configuration.md](docs/configuration.md) and [.env.example](.env.example) for real providers, MySQL, COS, SMS, email, and payment configuration.

## Runtime Modes

| Mode | Image generation | Data and image storage | Payment | External credentials |
| --- | --- | --- | --- | --- |
| Local evaluation | Mock provider | Local JSON + local files | Mock | None; external messaging integrations remain unavailable |
| Full production | OpenAI-compatible API or Codex | MySQL + Tencent Cloud COS | WeChat Pay / Alipay | Credentials for the selected provider, database, COS, payment, SMS, and email services |

Production deployments should also use public HTTPS, a strong `AUTH_SECRET`, secure cookies, valid payment callback URLs, and process supervision.

## Automated Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

With the local server running, execute the non-destructive smoke suite:

```bash
npm run test:smoke
```

Additional operational commands are documented in [smoke testing](docs/smoke-testing.md), [quality baseline](docs/quality-baseline.md), and [task observability](docs/image-task-observability.md).

## Project Layout

```text
ImageGood/
├── src/app/                 # App Router pages and Route Handlers
├── src/components/          # Page, studio, and shared UI components
├── src/lib/                 # Identity, data, job, storage, payment, and operations services
├── src/types/               # Shared TypeScript types
├── scripts/                 # Database, smoke, baseline, and audit scripts
├── server/                  # Optional Python Codex image service
├── docs/                    # Configuration, operations, diagrams, and screenshots
├── public/                  # Static assets
└── .github/                 # CI, dependency updates, Issue and PR templates
```

## Documentation

- [Configuration](docs/configuration.md)
- [Smoke testing](docs/smoke-testing.md)
- [Image job observability](docs/image-task-observability.md)
- [Quality baseline](docs/quality-baseline.md)
- [Codex service deployment](docs/deploy-codex-server.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security policy](SECURITY.md)

## Roadmap and Releases

See [ROADMAP.md](ROADMAP.md) for current priorities. It does not promise fixed delivery dates. Published versions are listed in [GitHub Releases](https://github.com/Xiaokang-Xue/ImageGood/releases), with repository changes tracked in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request. Never include secrets, certificates, user images, personal data, order data, or production database contents in an Issue or pull request.

## Security

Do not disclose unresolved vulnerabilities in public Issues. See [SECURITY.md](SECURITY.md) for private-reporting guidance and credential-rotation requirements.

## License

Copyright (c) 2026 ImageGood. All rights reserved. See [LICENSE](LICENSE).
