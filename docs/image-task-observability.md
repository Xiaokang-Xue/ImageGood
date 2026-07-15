# 图片生成任务可观测性

图片生成任务在服务端输出单行 JSON 日志。每条日志都包含完整 `taskId`，可以把任务创建、模型调用、结果存储、数据库更新、积分扣减和最终状态串联起来。

## 关键事件

- `task.created`：任务已写入数据库，状态为 `pending`。
- `task.processing`：后台执行已开始，状态为 `processing`。
- `stage.started`：某个执行阶段开始。
- `stage.succeeded`：某个执行阶段成功，并记录阶段耗时。
- `stage.failed`：某个执行阶段失败，并记录经过脱敏的错误摘要。
- `task.succeeded`：结果已保存、任务已成功入库，并完成幂等积分扣减。
- `task.failed`：任务最终失败，不扣积分。
- `recovery.*`：Codex 任务异常后检查已有结果文件的恢复过程。

阶段 `stage` 包括：

- `input_storage`：保存用户上传图片。
- `provider`：调用图片模型或图片服务。
- `result_storage`：将结果保存到 COS 或本地存储。
- `database`：更新成功状态并扣除积分。
- `cleanup`：清理允许删除的临时目录。
- `recovery`：检查异常任务是否已有可恢复结果。

日志不会记录提示词、图片 URL、本地文件路径、手机号、邮箱或密钥；用户 ID 仅保留脱敏片段。

## 按任务排查

如果网站进程由 PM2 管理，可先查看日志：

```bash
pm2 logs ai-image-studio --lines 300
```

在保存到文件的日志中按 `taskId` 查询：

```bash
grep '"taskId":"任务ID"' /path/to/application.log
```

正常任务应依次看到 `task.created`、`task.processing`、各阶段成功和 `task.succeeded`。如果出现 `stage.failed`，其 `stage` 和 `operation` 可以直接定位失败发生在模型调用、COS 保存还是数据库更新。

## 只读任务巡检

检查最近 24 小时任务：

```bash
npm run ops:task-audit
```

自定义统计范围和卡住任务阈值：

```bash
npm run ops:task-audit -- --hours=72 --stale-minutes=45
```

巡检命令只读取数据库，不会修改任务、积分或图片。输出包括成功率、平均耗时、主要失败原因，以及长期停留在 `pending` 或 `processing` 的任务 ID。

巡检会读取当前 `.env.local` 中的 `DATABASE_URL`。应在能够访问生产数据库的应用服务器上执行；如果本地电脑不在数据库白名单内，连接超时不代表脚本逻辑异常。
