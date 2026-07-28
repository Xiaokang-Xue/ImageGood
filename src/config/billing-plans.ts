import type { CreditPackage } from "@/types/billing";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "first_purchase",
    kind: "credit_pack",
    name: "首购体验包",
    priceCents: 990,
    credits: 8,
    subtitle: "新用户专享",
    description: "适合先体验 ImageGood 基础功能",
    buttonLabel: "立即体验",
    badgeLabel: "新用户专享",
    oneTimePerUser: true,
    oneTimeNotice: "每个账号限购 1 次"
  },
  {
    id: "starter",
    kind: "credit_pack",
    name: "入门包",
    priceCents: 1990,
    credits: 18,
    subtitle: "轻量使用",
    description: "适合临时修图、抠图和生成图片",
    buttonLabel: "立即购买",
    badgeLabel: "轻量使用"
  },
  {
    id: "standard",
    kind: "credit_pack",
    name: "标准包",
    priceCents: 4990,
    credits: 50,
    subtitle: "日常推荐",
    description: "适合日常修图、商品图处理和封面生成",
    buttonLabel: "选择标准包",
    badgeLabel: "日常推荐"
  },
  {
    id: "pro",
    kind: "credit_pack",
    name: "创作者包",
    priceCents: 6990,
    credits: 90,
    subtitle: "推荐选择",
    description: "适合持续创作，积分更多更自由",
    buttonLabel: "推荐购买",
    badgeLabel: "推荐选择",
    recommended: true
  },
  {
    id: "business",
    kind: "credit_pack",
    name: "专业包",
    priceCents: 14900,
    credits: 220,
    subtitle: "高频使用首选",
    description: "适合高频生成、商品图和内容创作",
    buttonLabel: "开通专业包",
    badgeLabel: "最划算"
  },
  {
    id: "creator_monthly",
    kind: "membership",
    name: "创作月卡",
    priceCents: 3990,
    credits: 50,
    subtitle: "灵活开启",
    description: "适合短期集中创作，常用图片工具均可使用",
    buttonLabel: "开通月卡",
    badgeLabel: "轻量之选",
    validityMonths: 1,
    validityDays: 30,
    periodDays: 30,
    creditsPerPeriod: 50,
    validityLabel: "会员有效期 30 天",
    creditsLabel: "50 会员积分 / 30 天"
  },
  {
    id: "creator_half_year",
    kind: "membership",
    name: "半年会员",
    priceCents: 19900,
    credits: 50,
    subtitle: "稳定创作",
    description: "适合持续半年使用，保持稳定的创作节奏",
    buttonLabel: "开通半年会员",
    badgeLabel: "进阶之选",
    validityMonths: 6,
    validityDays: 180,
    periodDays: 30,
    creditsPerPeriod: 50,
    validityLabel: "会员有效期 180 天",
    creditsLabel: "每 30 天 50 会员积分"
  },
  {
    id: "creator_yearly",
    kind: "membership",
    name: "创作年卡",
    priceCents: 29900,
    credits: 50,
    subtitle: "年度推荐",
    description: "适合全年持续创作，长期使用更从容",
    buttonLabel: "开通创作年卡",
    badgeLabel: "年度推荐",
    recommended: true,
    validityMonths: 12,
    validityDays: 365,
    periodDays: 30,
    creditsPerPeriod: 50,
    validityLabel: "会员有效期 1 年",
    creditsLabel: "每 30 天 50 会员积分"
  },
  {
    id: "creator_lifetime",
    kind: "membership",
    name: "永久会员",
    priceCents: 59800,
    credits: 50,
    subtitle: "长期创作",
    description: "一次开通长期有效，适合高频、持续的图片创作",
    buttonLabel: "开通永久会员",
    badgeLabel: "长期权益",
    membershipLifetime: true,
    periodDays: 30,
    creditsPerPeriod: 50,
    validityLabel: "会员权益长期有效",
    creditsLabel: "每 30 天 50 会员积分"
  }
];

const PAYMENT_TEST_PACKAGE: CreditPackage = {
  id: "wechat_test",
  kind: "credit_pack",
  name: "支付测试包",
  priceCents: 1,
  credits: 1,
  subtitle: "仅用于支付链路测试，完成后可关闭"
};

export function findCreditPackage(packageId: string) {
  if (packageId === PAYMENT_TEST_PACKAGE.id && process.env.ENABLE_PAYMENT_TEST_PACKAGE === "true") {
    return PAYMENT_TEST_PACKAGE;
  }
  return CREDIT_PACKAGES.find((item) => item.id === packageId);
}
