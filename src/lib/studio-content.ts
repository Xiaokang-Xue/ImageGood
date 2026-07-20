import { imageAssets } from "@/lib/image-assets";
import type { EditTool, PosterStyle, ProductStyle, ProductTemplate } from "@/types/image";
import type { TemplateItem } from "@/types/template";

export const toolPrompts: Record<EditTool, string> = {
  background: "替换为与主体自然协调的干净背景，主体保持不变",
  remove: "移除画面中的明显干扰元素，并自然补全背景",
  enhance: "提升清晰度和细节，保持原图内容与色彩自然",
  style: "统一色调、光影和质感，主体内容保持不变",
  expand: "自然扩展画面边缘，原图内容和主体保持不变",
  custom: ""
};

export const toolLabels: Record<EditTool, string> = {
  background: "换背景",
  remove: "去杂物",
  enhance: "增强清晰度",
  style: "改风格",
  expand: "扩图",
  custom: "自定义修图"
};

export const productTemplateLabels: Record<ProductTemplate, string> = {
  "white-bg": "白底主图",
  lifestyle: "生活场景图",
  festival: "节日促销图",
  social: "种草封面"
};

export const productStyleLabels: Record<ProductStyle, string> = {
  minimal: "简约",
  premium: "高级",
  warm: "温暖",
  fresh: "清新"
};

export const posterStyleLabels: Record<PosterStyle, string> = {
  clean: "清爽",
  premium: "高级",
  cute: "可爱",
  tech: "科技",
  handdrawn: "手绘"
};

export const taskCards = [
  {
    id: "edit",
    group: "processing",
    title: "AI 修图",
    description: "上传图片，说出想法，完成细节修饰、画面调整和视觉优化。",
    route: "/editor"
  },
  {
    id: "remove-background",
    group: "processing",
    title: "智能抠图",
    description: "一键去除图片背景，获得透明 PNG，也可下载白底或纯色背景。",
    route: "/remove-background"
  },
  {
    id: "image-enhancer",
    group: "processing",
    title: "图片增强",
    description: "提升低清图片的清晰度、细节质感和自然光影。",
    route: "/image-enhancer"
  },
  {
    id: "object-remover",
    group: "processing",
    title: "去杂物",
    description: "用文字说明要移除的对象，清理路人、杂物和多余元素。",
    route: "/object-remover"
  },
  {
    id: "text-to-image",
    group: "generation",
    title: "文生图",
    description: "输入一句描述，生成头像、海报和创意场景图。",
    route: "/text-to-image"
  },
  {
    id: "product",
    group: "generation",
    title: "商品图",
    description: "围绕商品主体生成适合电商与社交媒体的场景图。",
    route: "/product"
  },
  {
    id: "poster",
    group: "generation",
    title: "封面海报",
    description: "生成干净的视觉背景，并保留可编辑标题与副标题。",
    route: "/poster"
  }
] as const;

export const templates: TemplateItem[] = [
  {
    id: "template-white-product",
    name: "白底商品图",
    category: "商品图",
    description: "适合电商主图，主体突出，光影干净。",
    thumbnail: imageAssets.product1,
    usageCount: 28400,
    route: "/product?template=white-bg"
  },
  {
    id: "template-xhs-cover",
    name: "小红书封面",
    category: "封面海报",
    description: "醒目的标题层级和清爽配色，适合内容种草。",
    thumbnail: imageAssets.poster1,
    usageCount: 35600,
    route: "/poster?usage=xiaohongshu&style=clean&ratio=3:4"
  },
  {
    id: "template-portrait",
    name: "职业头像",
    category: "头像",
    description: "自然修饰五官与光线，保留真实质感。",
    thumbnail: imageAssets.portraitBusiness,
    usageCount: 17320,
    route: "/editor?tool=enhance"
  },
  {
    id: "template-checkin",
    name: "学习打卡图",
    category: "封面海报",
    description: "适合社群打卡和每日内容分享。",
    thumbnail: imageAssets.posterStudy,
    usageCount: 12680,
    route: "/poster?usage=checkin&style=clean&ratio=3:4"
  },
  {
    id: "template-lifestyle-product",
    name: "商品场景图",
    category: "商品图",
    description: "把单品放进真实生活场景，提升购买想象。",
    thumbnail: imageAssets.product2,
    usageCount: 24110,
    route: "/product?template=lifestyle"
  },
  {
    id: "template-campaign",
    name: "活动海报",
    category: "运营活动",
    description: "活动信息清晰，适合社群、门店和私域传播。",
    thumbnail: imageAssets.poster4,
    usageCount: 19750,
    route: "/poster?usage=community&style=premium&ratio=3:4"
  },
  {
    id: "template-remove",
    name: "智能去物",
    category: "修图",
    description: "清理画面杂物，保留自然背景纹理。",
    thumbnail: imageAssets.edit3,
    usageCount: 21940,
    route: "/editor?tool=remove"
  },
  {
    id: "template-festival",
    name: "节日礼盒图",
    category: "商品图",
    description: "快速生成节日氛围主视觉和促销图。",
    thumbnail: imageAssets.product3,
    usageCount: 16200,
    route: "/product?template=festival"
  }
];

export const industryTemplates = ["美妆个护", "食品饮料", "3C 数码", "家居日用", "服饰鞋包", "母婴玩具"];
