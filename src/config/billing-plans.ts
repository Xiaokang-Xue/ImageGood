import type { CreditPackage } from "@/types/billing";

/** 当前可购买方案。服务端创建订单与前端展示共同使用这一份配置。 */
export const BILLING_PLANS: CreditPackage[] = [
  {
    id: "image_pack_1",
    kind: "credit_pack",
    name: "单张体验",
    priceCents: 3900,
    credits: 1,
    subtitle: "按需购买",
    description: "适合先完成一张图片处理",
    buttonLabel: "购买 1 张",
    badgeLabel: "轻量体验"
  },
  {
    id: "image_pack_10",
    kind: "credit_pack",
    name: "轻享 10 张",
    priceCents: 9900,
    credits: 10,
    subtitle: "日常轻量处理",
    description: "适合临时修图、抠图和少量创作",
    buttonLabel: "购买 10 张"
  },
  {
    id: "image_pack_100",
    kind: "credit_pack",
    name: "进阶 100 张",
    priceCents: 29900,
    credits: 100,
    subtitle: "持续创作推荐",
    description: "适合内容创作者与日常高频图片处理",
    buttonLabel: "购买 100 张",
    badgeLabel: "推荐",
    recommended: true
  },
  {
    id: "image_pack_600",
    kind: "credit_pack",
    name: "专业 600 张",
    priceCents: 59900,
    credits: 600,
    subtitle: "团队与高频使用",
    description: "适合商品图、内容生产和批量创作",
    buttonLabel: "购买 600 张",
    badgeLabel: "最划算"
  }
];

/**
 * 2026-08 定价调整前的套餐快照，仅用于历史订单、统计和回滚参考。
 * 不参与新订单创建，也不会出现在价格页。
 */
export const ARCHIVED_BILLING_PLANS: CreditPackage[] = [
  { id: "image_single_unlock", kind: "single_unlock", name: "单张体验（旧）", priceCents: 3900, credits: 0, subtitle: "解锁一张作品", requiresTaskTarget: true },
  { id: "single_unlock", kind: "single_unlock", name: "单次去水印", priceCents: 5900, credits: 0, subtitle: "解锁一张作品", requiresTaskTarget: true },
  { id: "unlimited_monthly", kind: "membership", name: "包月不限次", priceCents: 19900, credits: 0, subtitle: "30 天持续创作", validityDays: 30, unlimitedGenerations: true },
  { id: "unlimited_yearly", kind: "membership", name: "包年不限次", priceCents: 29900, credits: 0, subtitle: "全年创作", validityDays: 365, unlimitedGenerations: true },
  { id: "unlimited_lifetime", kind: "membership", name: "永久使用", priceCents: 59900, credits: 0, subtitle: "长期使用", membershipLifetime: true, unlimitedGenerations: true },
  { id: "first_purchase", kind: "credit_pack", name: "首购体验包", priceCents: 990, credits: 8, subtitle: "新用户专享" },
  { id: "starter", kind: "credit_pack", name: "入门包", priceCents: 1990, credits: 18, subtitle: "轻量使用" },
  { id: "standard", kind: "credit_pack", name: "标准包", priceCents: 4990, credits: 50, subtitle: "日常推荐" },
  { id: "pro", kind: "credit_pack", name: "创作者包", priceCents: 6990, credits: 90, subtitle: "推荐选择" },
  { id: "business", kind: "credit_pack", name: "专业包", priceCents: 14900, credits: 220, subtitle: "高频使用" },
  { id: "creator_monthly", kind: "membership", name: "创作月卡", priceCents: 3990, credits: 50, subtitle: "灵活开启", validityDays: 30, periodDays: 30, creditsPerPeriod: 50 },
  { id: "creator_half_year", kind: "membership", name: "半年会员", priceCents: 19900, credits: 50, subtitle: "稳定创作", validityDays: 180, periodDays: 30, creditsPerPeriod: 50 },
  { id: "creator_yearly", kind: "membership", name: "创作年卡", priceCents: 29900, credits: 50, subtitle: "年度推荐", validityDays: 365, periodDays: 30, creditsPerPeriod: 50 },
  { id: "creator_lifetime", kind: "membership", name: "永久会员", priceCents: 59800, credits: 50, subtitle: "长期创作", membershipLifetime: true, periodDays: 30, creditsPerPeriod: 50 }
];

export const ALL_BILLING_PLANS = [...BILLING_PLANS, ...ARCHIVED_BILLING_PLANS];

// 保留原导出名，避免现有调用方发生无关改动。
export const CREDIT_PACKAGES = BILLING_PLANS;

export function findCreditPackage(packageId: string) {
  return BILLING_PLANS.find((item) => item.id === packageId);
}
