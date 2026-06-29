export type TemplateCategory = "修图" | "商品图" | "封面海报" | "头像" | "运营活动";

export interface TemplateItem {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  thumbnail: string;
  usageCount: number;
  route:
    | "/editor"
    | "/product"
    | "/poster"
    | `/editor?${string}`
    | `/product?${string}`
    | `/poster?${string}`;
}
