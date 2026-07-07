import type { CreditPackage } from "@/types/billing";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "first_purchase",
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
    name: "标准包",
    priceCents: 3990,
    credits: 45,
    subtitle: "日常推荐",
    description: "适合日常修图、商品图处理和封面生成",
    buttonLabel: "选择标准包",
    badgeLabel: "日常推荐"
  },
  {
    id: "pro",
    name: "创作者包",
    priceCents: 7990,
    credits: 100,
    subtitle: "推荐选择",
    description: "适合持续创作，积分更多更自由",
    buttonLabel: "推荐购买",
    badgeLabel: "推荐选择",
    recommended: true
  },
  {
    id: "business",
    name: "专业包",
    priceCents: 14900,
    credits: 220,
    subtitle: "高频使用首选",
    description: "适合高频生成、商品图和内容创作",
    buttonLabel: "开通专业包",
    badgeLabel: "最划算"
  }
];

const PAYMENT_TEST_PACKAGE: CreditPackage = {
  id: "wechat_test",
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
