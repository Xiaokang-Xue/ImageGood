# 用户图片任务成对导出

该工具用于从服务器端只读导出用户上传原图与对应生成结果，适合内部产品分析。它不会更新数据库、删除历史记录或修改 COS 文件。

## 输出结构

```text
image-pairs/
├── manifest.csv
├── summary.json
└── users/
    └── user-匿名编号/
        └── 北京时间_任务类型_任务ID/
            ├── input.jpg
            ├── result-01.png
            └── metadata.json
```

默认不输出邮箱、手机号和昵称。`metadata.json` 包含任务类型、提示词和时间，仍应视为内部敏感数据。

## 推荐用法

先小范围验证最近 20 条：

```bash
cd /data/Photoshop
npm run ops:export-image-pairs -- --output=/data/imagegood_analysis/image-pairs --limit=20
```

确认目录和文件正常后，导出最近 500 条：

```bash
npm run ops:export-image-pairs -- --output=/data/imagegood_analysis/image-pairs --limit=500
```

按北京时间日期范围导出：

```bash
npm run ops:export-image-pairs -- --output=/data/imagegood_analysis/image-pairs --since=2026-07-01 --until=2026-07-31 --limit=all
```

参数：

- `--output`：导出目录，建议放在项目目录之外。
- `--limit`：默认 `200`，可填写正整数或 `all`。
- `--since` / `--until`：日期边界，`YYYY-MM-DD` 按北京时间解释。
- `--concurrency`：并发下载数，默认 `3`，最高 `8`。

脚本只选择状态为 `succeeded`、同时具有原图和结果引用的任务。文生图等没有上传原图的任务不会进入配对导出。重复运行时，已经存在的非空图片会被跳过，缺失或读取失败项会记录在 `manifest.csv` 和 `summary.json` 中。

## 数据使用要求

- 导出目录仅授予确有分析需要的人员访问。
- 不要上传到公开网盘、GitHub 或个人设备同步目录。
- 分析完成后按公司数据保留制度及时删除。
- 对外展示案例前，应取得用户授权并移除可识别个人身份的信息。
