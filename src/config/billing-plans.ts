import type { CreditPackage } from "@/types/billing";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "入门包",
    priceCents: 1990,
    credits: 15,
    subtitle: "轻量体验",
    description: "适合首次体验 AI 修图、抠图和文生图",
    buttonLabel: "立即体验"
  },
  {
    id: "standard",
    name: "标准包",
    priceCents: 4990,
    credits: 45,
    subtitle: "日常使用",
    description: "适合日常修图、商品图处理和封面生成",
    buttonLabel: "立即购买"
  },
  {
    id: "pro",
    name: "创作者包",
    priceCents: 9900,
    credits: 100,
    subtitle: "推荐选择",
    description: "适合持续创作，图片处理更自由",
    buttonLabel: "推荐购买",
    recommended: true
  },
  {
    id: "business",
    name: "专业包",
    priceCents: 19900,
    credits: 220,
    subtitle: "高频使用",
    description: "适合高频生成、商品图和内容创作",
    buttonLabel: "开通专业包"
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
