import type { DailyAnalyticsReport } from "./daily-analytics";

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCny(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function periodLabel(range: DailyAnalyticsReport["range"]) {
  return range === "today" ? "今日数据" : "昨日数据";
}

function formatPackageSales(report: DailyAnalyticsReport) {
  const paidPackages = report.payments.packagePurchases.filter((item) => item.buyers > 0);
  const lines: string[] = [];
  const memberships = paidPackages.filter((item) => item.packageKind === "membership");
  const singleUnlocks = paidPackages.filter((item) => item.packageKind === "single_unlock");
  const creditPacks = paidPackages.filter((item) => item.packageKind === "credit_pack");

  if (memberships.length > 0) {
    lines.push(
      `历史不限次方案｜${memberships
        .map((item) => `${item.packageName} ${formatNumber(item.buyers)}人/${formatCny(item.revenueCents)}`)
        .join(" · ")}`
    );
  }
  if (singleUnlocks.length > 0) {
    lines.push(
      `单次解锁｜${singleUnlocks
        .map((item) => `${item.packageName} ${formatNumber(item.buyers)}人/${formatCny(item.revenueCents)}`)
        .join(" · ")}`
    );
  }
  if (creditPacks.length > 0) {
    lines.push(
      `图片额度｜${creditPacks
        .map((item) => `${item.packageName} ${formatNumber(item.buyers)}人/${formatCny(item.revenueCents)}`)
        .join(" · ")}`
    );
  }

  return lines.length > 0 ? ["套餐销售", ...lines] : [];
}

export function formatFeishuDailyReport(report: DailyAnalyticsReport) {
  const period = periodLabel(report.range);
  const packageSales = formatPackageSales(report);

  return [
    `ImageGood 运营日报｜${report.date}`,
    `统计口径｜${period} + 截至发送时累计`,
    "",
    `【${period}】`,
    `用户｜新注册 ${formatNumber(report.users.newUsers)} · 登录访问 ${formatNumber(report.users.activeUsers)}`,
    `图片｜任务 ${formatNumber(report.images.tasks)} · 成功 ${formatNumber(report.images.succeeded)}（${formatPercent(report.images.successRate)}）· 消耗 ${formatNumber(report.images.creditsConsumed)} 积分`,
    `支付｜成功 ${formatNumber(report.payments.paidOrders)} 单 · 用户 ${formatNumber(report.payments.payingUsers)} 人 · 复购 ${formatNumber(report.payments.repeatPurchaseUsers)} 人（${formatPercent(report.payments.repeatPurchaseRate)}）`,
    `金额｜${formatCny(report.payments.revenueCents)} · 微信 ${formatNumber(report.payments.wechatPaidOrders)} 单 · 支付宝 ${formatNumber(report.payments.alipayPaidOrders)} 单 · 购买点击 ${formatNumber(report.payments.purchaseClicks)}`,
    ...packageSales,
    `访问｜页面 ${formatNumber(report.traffic.pageViews)} · 积分页 ${formatNumber(report.traffic.pricingPageViews)} · 生成页 ${formatNumber(report.traffic.generationPageViews)}`,
    "",
    "【累计数据】",
    `用户｜注册 ${formatNumber(report.cumulative.users.totalUsers)} · 已验证 ${formatNumber(report.cumulative.users.verifiedUsers)}`,
    `图片｜任务 ${formatNumber(report.cumulative.images.totalTasks)} · 成功 ${formatNumber(report.cumulative.images.succeeded)}（${formatPercent(report.cumulative.images.successRate)}）· 消耗 ${formatNumber(report.cumulative.images.creditsConsumed)} 积分`,
    `支付｜订单 ${formatNumber(report.cumulative.payments.paidOrders)} · 用户 ${formatNumber(report.cumulative.payments.payingUsers)} · 复购 ${formatNumber(report.cumulative.payments.repeatPurchaseUsers)}（${formatPercent(report.cumulative.payments.repeatPurchaseRate)}）`,
    `金额｜${formatCny(report.cumulative.payments.revenueCents)} · 微信 ${formatNumber(report.cumulative.payments.wechatPaidOrders)} 单 · 支付宝 ${formatNumber(report.cumulative.payments.alipayPaidOrders)} 单`,
    `访问｜页面 ${formatNumber(report.cumulative.traffic.pageViews)} · 积分页 ${formatNumber(report.cumulative.traffic.pricingPageViews)} · 生成页 ${formatNumber(report.cumulative.traffic.generationPageViews)}`
  ].join("\n");
}
