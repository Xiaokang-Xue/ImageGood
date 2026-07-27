import type { PosterUsage } from "@/types/image";

export interface InputSuggestion {
  label: string;
  value: string;
  description?: string;
}

export function appendPromptFragment(current: string, fragment: string) {
  const base = current.trim().replace(/[，。；、\s]+$/u, "");
  const next = fragment.trim();
  if (!next || base.includes(next)) return current;
  return base ? `${base}，${next}` : next;
}

export const editPromptSuggestions: InputSuggestion[] = [
  { label: "保持主体不变", value: "保持主体外观、比例和细节不变" },
  { label: "自然光影", value: "光影自然，与原图环境协调" },
  { label: "保留文字", value: "保留原有文字、标识和包装信息" },
  { label: "不添加元素", value: "不要添加无关物体或装饰" },
  { label: "画面更干净", value: "清理视觉干扰，保持画面自然" }
];

export const textToImageExamples: InputSuggestion[] = [
  {
    label: "商品摄影",
    value: "一只白色运动鞋置于浅灰摄影棚，柔和侧光，主体居中，材质细节清晰",
    description: "适合电商主图与产品展示"
  },
  {
    label: "人物头像",
    value: "城市夜景中的年轻人半身头像，写实摄影，柔和霓虹光，表情自然",
    description: "适合头像与内容配图"
  },
  {
    label: "活动海报",
    value: "夏季课程活动海报背景，清爽蓝白配色，简洁图形，顶部预留标题区域",
    description: "适合封面与活动视觉"
  }
];

export const textToImageModifiers: InputSuggestion[] = [
  { label: "自然光", value: "自然柔和光线" },
  { label: "主体居中", value: "主体居中，构图稳定" },
  { label: "预留文字", value: "画面留出干净的文字区域" },
  { label: "细节清晰", value: "材质和边缘细节清晰" },
  { label: "简洁背景", value: "背景简洁，不添加无关元素" }
];

export const productSellingPointSuggestions: InputSuggestion[] = [
  { label: "突出材质", value: "突出材质纹理和做工细节" },
  { label: "保留实物颜色", value: "保持商品真实颜色和外观" },
  { label: "主体居中", value: "商品主体居中，比例自然" },
  { label: "自然光影", value: "使用自然柔和的商业摄影光线" },
  { label: "预留文案区", value: "为商品文案预留干净空间" }
];

export const objectRemovalSuggestions: InputSuggestion[] = [
  { label: "背景路人", value: "移除背景中的路人并自然补全环境" },
  { label: "桌面杂物", value: "移除桌面上的零散杂物" },
  { label: "电线和标牌", value: "移除画面中的电线和多余标牌" },
  { label: "水印文字", value: "移除角落的水印和多余文字" }
];

export const posterCopyPresets: Record<PosterUsage, Array<{ label: string; title: string; subtitle: string }>> = {
  xiaohongshu: [
    { label: "经验分享", title: "这 5 个方法真的有效", subtitle: "亲测整理 · 建议收藏" },
    { label: "好物推荐", title: "近期爱用好物分享", subtitle: "真实体验 · 理性种草" }
  ],
  wechat: [
    { label: "观点文章", title: "重新理解长期主义", subtitle: "方法、实践与思考" },
    { label: "行业观察", title: "本周行业趋势观察", subtitle: "关键变化与行动建议" }
  ],
  community: [
    { label: "活动招募", title: "周末主题活动招募", subtitle: "限时参与 · 欢迎报名" },
    { label: "福利通知", title: "会员专属福利开启", subtitle: "活动时间与参与方式" }
  ],
  course: [
    { label: "课程招生", title: "7 天掌握核心方法", subtitle: "每天 30 分钟 · 系统练习" },
    { label: "直播预告", title: "主题直播公开课", subtitle: "今晚 20:00 准时开讲" }
  ],
  checkin: [
    { label: "学习打卡", title: "今日学习打卡", subtitle: "保持专注 · 持续进步" },
    { label: "习惯养成", title: "21 天习惯养成计划", subtitle: "第 1 天 · 从今天开始" }
  ]
};
