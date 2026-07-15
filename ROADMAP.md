# Roadmap

本路线图用于表达优先方向，不承诺固定范围或发布日期。实际进度以 Pull Request、[CHANGELOG.md](CHANGELOG.md) 和 [GitHub Releases](https://github.com/Xiaokang-Xue/ImageGood/releases) 为准。

## Now

- 稳定 AI 修图、文生图、抠图及其他图片工具的任务状态与错误语义。
- 完善 mock 模式、CI、冒烟测试、质量基线和任务巡检。
- 保持账号、积分、支付回调、COS 与本地模式的文档一致性。
- 改进移动端上传、等待、结果查看和历史记录体验。

## Next

- 增加图片 Provider 的契约测试和错误场景测试替身。
- 增加支付回调重复通知、金额不一致和积分幂等的自动化回归测试。
- 建立 JPG、PNG、WebP、HEIC 与大图的上传兼容测试矩阵。
- 完善任务、订单和运营查询的分页与性能基线。

## Later

- 评估独立任务队列与工作进程，降低长任务对 Web 进程的影响。
- 评估对象存储缩略图与图片生命周期策略。
- 评估团队空间、批量任务和更细粒度的运营权限。
- 扩展可替换 Provider 与存储适配器的开发文档。
