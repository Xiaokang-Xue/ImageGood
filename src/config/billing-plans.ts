import type { CreditPackage } from "@/types/billing";

const STANDARD_CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "体验包",
    priceCents: 990,
    credits: 10,
    subtitle: "轻量尝鲜",
    description: "低门槛体验 ImageGood 的 AI 修图能力",
    buttonLabel: "立即体验",
    unitPriceLabel: "¥0.99 / 次"
  },
  {
    id: "standard",
    name: "标准包",
    priceCents: 2990,
    credits: 40,
    subtitle: "日常修图",
    description: "适合日常图片处理",
    buttonLabel: "立即购买",
    unitPriceLabel: "¥0.75 / 次"
  },
  {
    id: "pro",
    name: "高级包",
    priceCents: 6990,
    credits: 120,
    subtitle: "创作者推荐",
    description: "持续创作更划算",
    buttonLabel: "推荐购买",
    recommended: true,
    unitPriceLabel: "¥0.58 / 次"
  },
  {
    id: "business",
    name: "专业包",
    priceCents: 14900,
    credits: 300,
    subtitle: "高频使用",
    description: "适合长期高频使用",
    buttonLabel: "开通专业包",
    unitPriceLabel: "¥0.50 / 次"
  }
];

const PAYMENT_TEST_PACKAGE: CreditPackage = {
  id: "wechat_test",
  name: "支付测试包",
  priceCents: 1,
  credits: 1,
  subtitle: "仅用于支付链路测试，完成后可关闭"
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  ...STANDARD_CREDIT_PACKAGES,
  ...(process.env.ENABLE_PAYMENT_TEST_PACKAGE === "true" ? [PAYMENT_TEST_PACKAGE] : [])
];

export function getCreditPackageUnitPrice(packageItem: CreditPackage) {
  return packageItem.priceCents / 100 / packageItem.credits;
}

export function findCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find((item) => item.id === packageId);
}
