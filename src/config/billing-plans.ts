import type { CreditPackage } from "@/types/billing";

const STANDARD_CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "体验包",
    priceCents: 690,
    credits: 10,
    subtitle: "适合轻量体验"
  },
  {
    id: "standard",
    name: "标准包",
    priceCents: 1990,
    credits: 40,
    subtitle: "适合日常修图"
  },
  {
    id: "pro",
    name: "高级包",
    priceCents: 4990,
    credits: 120,
    subtitle: "适合内容创作者"
  },
  {
    id: "business",
    name: "专业包",
    priceCents: 9900,
    credits: 300,
    subtitle: "适合高频使用"
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
