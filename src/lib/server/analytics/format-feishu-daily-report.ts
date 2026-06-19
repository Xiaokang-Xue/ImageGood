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

export function formatFeishuDailyReport(report: DailyAnalyticsReport) {
  const period = periodLabel(report.range);

  return [
    `ImageGood 运营日报｜${report.date}`,
    `统计口径：${period} + 截至当前累计`,
    "",
    `一、${period}`,
    "",
    "用户",
    `新注册用户：${formatNumber(report.users.newUsers)}`,
    `访问过网站的登录用户：${formatNumber(report.users.activeUsers)}`,
    `访问设备/浏览器数：${formatNumber(report.users.activeVisitors)}`,
    "",
    "图片生成",
    `生成任务：${formatNumber(report.images.tasks)}`,
    `成功：${formatNumber(report.images.succeeded)}`,
    `成功率：${formatPercent(report.images.successRate)}`,
    `消耗积分：${formatNumber(report.images.creditsConsumed)}`,
    "",
    "支付转化",
    `支付成功订单：${formatNumber(report.payments.paidOrders)}`,
    `支付金额：${formatCny(report.payments.revenueCents)}`,
    `新增积分：${formatNumber(report.payments.purchasedCredits)}`,
    `微信支付：${formatNumber(report.payments.wechatPaidOrders)} 单`,
    `支付宝支付：${formatNumber(report.payments.alipayPaidOrders)} 单`,
    `购买点击：${formatNumber(report.payments.purchaseClicks)}`,
    "",
    "访问行为",
    `页面访问：${formatNumber(report.traffic.pageViews)}`,
    `积分页访问：${formatNumber(report.traffic.pricingPageViews)}`,
    `生成页访问：${formatNumber(report.traffic.generationPageViews)}`,
    "",
    "内容",
    `历史记录新增：${formatNumber(report.content.newHistoryRecords)}`,
    "",
    "二、累计数据",
    "",
    "用户",
    `累计已注册用户：${formatNumber(report.cumulative.users.totalUsers)}`,
    `已验证联系方式用户：${formatNumber(report.cumulative.users.verifiedUsers)}`,
    "",
    "图片生成",
    `累计任务：${formatNumber(report.cumulative.images.totalTasks)}`,
    `累计成功：${formatNumber(report.cumulative.images.succeeded)}`,
    `累计成功率：${formatPercent(report.cumulative.images.successRate)}`,
    `累计消耗积分：${formatNumber(report.cumulative.images.creditsConsumed)}`,
    "",
    "支付",
    `累计支付成功订单：${formatNumber(report.cumulative.payments.paidOrders)}`,
    `累计支付金额：${formatCny(report.cumulative.payments.revenueCents)}`,
    `累计购买积分：${formatNumber(report.cumulative.payments.purchasedCredits)}`,
    `累计微信支付：${formatNumber(report.cumulative.payments.wechatPaidOrders)} 单`,
    `累计支付宝支付：${formatNumber(report.cumulative.payments.alipayPaidOrders)} 单`,
    `累计购买点击：${formatNumber(report.cumulative.payments.purchaseClicks)}`,
    "",
    "访问",
    `累计页面访问：${formatNumber(report.cumulative.traffic.pageViews)}`,
    `累计积分页访问：${formatNumber(report.cumulative.traffic.pricingPageViews)}`,
    `累计生成页访问：${formatNumber(report.cumulative.traffic.generationPageViews)}`,
    "",
    "内容",
    `累计历史记录：${formatNumber(report.cumulative.content.historyRecords)}`
  ].join("\n");
}
