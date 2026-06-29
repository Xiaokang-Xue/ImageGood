import type {
  EditTool,
  PosterRatio,
  PosterStyle,
  PosterUsage,
  ProductRatio,
  ProductScene,
  ProductStyle,
  ProductTemplate,
  TextToImageStyle
} from "@/types/image";

const DEFAULT_USER_PROMPT = "请根据图片内容进行自然、专业的优化。";

export const editToolLabels: Record<EditTool, string> = {
  background: "换背景",
  remove: "去杂物",
  enhance: "增强清晰度",
  style: "改风格",
  expand: "扩图",
  custom: "自定义修图"
};

const productTemplateLabels: Record<ProductTemplate, string> = {
  "white-bg": "白底主图",
  lifestyle: "生活场景图",
  festival: "节日促销图",
  social: "社交媒体种草图"
};

const productSceneLabels: Record<ProductScene, string> = {
  kitchen: "厨房",
  bedroom: "卧室",
  desk: "办公桌",
  outdoor: "户外",
  gift: "礼盒"
};

const productStyleLabels: Record<ProductStyle, string> = {
  minimal: "简约",
  premium: "高级",
  warm: "温暖",
  fresh: "清新"
};

const posterUsageLabels: Record<PosterUsage, string> = {
  xiaohongshu: "小红书封面",
  wechat: "公众号首图",
  community: "社群活动海报",
  course: "课程封面",
  checkin: "学习打卡图"
};

const posterStyleLabels: Record<PosterStyle, string> = {
  clean: "干净清爽",
  premium: "高级质感",
  cute: "轻快亲和",
  tech: "科技秩序",
  handdrawn: "手作灵感"
};

const posterStyleGuides: Record<PosterStyle, string> = {
  clean: "大面积留白、浅色背景、清晰层次、轻量图形元素",
  premium: "克制高级的商业视觉、柔和光影、精致材质、低饱和配色",
  cute: "明亮轻快、亲和但不幼稚、圆润细节、柔和色块",
  tech: "现代科技感、秩序网格、清晰几何结构、冷静色彩",
  handdrawn: "轻设计手作感、细腻线条、自然纸感、干净构图"
};

const textToImageStyleLabels: Record<TextToImageStyle, string> = {
  realistic: "写实摄影",
  product: "电商商品图",
  poster: "海报设计",
  illustration: "精致插画",
  minimal: "极简风"
};

const textToImageStyleGuides: Record<TextToImageStyle, string> = {
  realistic: "真实摄影质感、自然光影、干净构图、细节可信",
  product: "商业摄影光线、主体突出、背景整洁、适合电商和社媒展示",
  poster: "现代海报视觉、清晰视觉中心、预留标题区域、适合封面和运营图",
  illustration: "细腻插画质感、稳定造型、完整构图、避免廉价卡通感",
  minimal: "留白充足、元素克制、低噪点、清爽高级"
};

function withFallback(value?: string) {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_USER_PROMPT;
}

function editRules(userPrompt: string) {
  return [
    `用户具体要求：${userPrompt}`,
    "严格只执行用户要求中明确提到的修改，不要自行增加阴影、光晕、边框、贴纸、文字、水印、装饰物或无关背景元素。",
    "保持主要主体的身份、形状、材质、颜色、纹理、文字标识和真实边缘细节尽量一致。",
    "如果用户要求移动、缩小、放大或调整主体位置，只改变主体的尺寸或位置，并自然补全露出的背景；不要给主体外圈添加投影、描边或发光效果。",
    "保持画面真实摄影质感，避免过度锐化、塑料感、AI 畸形、重复物体和不自然融合。",
    "输出一张完整、干净、可直接使用的图片。"
  ].join("\n");
}

export function buildEditPrompt(tool: EditTool, userPrompt?: string) {
  const prompt = withFallback(userPrompt);
  const rules = editRules(prompt);

  const templates: Record<EditTool, string> = {
    background: [
      "请在保持图片主体外观、材质、颜色、比例和边缘细节不变的前提下替换背景。",
      "背景应干净、明亮、专业、自然，光影方向与主体一致。",
      "不要改变主体大小、角度和关键细节。",
      rules
    ].join("\n"),
    remove: [
      "请移除画面中不必要的杂物、路人、污点或干扰元素，并自然补全原有背景。",
      "保持主要主体不变，不改变主体颜色、形状、材质和位置。",
      "补全区域应与周围纹理、透视和光线一致。",
      rules
    ].join("\n"),
    enhance: [
      "请提升图片整体清晰度、细节质感、色彩平衡和光影表现。",
      "画面应更干净自然，适合发布，但不要改变主体结构和场景内容。",
      "不要添加任何新物体或装饰效果。",
      rules
    ].join("\n"),
    style: [
      "请将图片调整为更高级、更专业的商业视觉风格。",
      "优化构图、光影、色彩和整体质感，但保持主体内容、形状和核心场景不变。",
      "不要把真实物体改成插画、3D 或不相干风格，除非用户明确要求。",
      rules
    ].join("\n"),
    expand: [
      "请在保持主体不变的前提下自然扩展画面边缘。",
      "扩展区域应与原图背景、透视、光线、景深和纹理自然一致。",
      "不要复制出第二个主体，不要改变主体比例和细节。",
      rules
    ].join("\n"),
    custom: [
      "请根据用户要求对图片进行精确编辑。",
      "优先理解用户要求中的对象、位置、大小、背景和风格约束。",
      "如果用户要求把某个物体缩小或调整位置，应保持该物体真实外观，只改变尺寸或位置，并自然补全背景。",
      rules
    ].join("\n")
  };

  return templates[tool];
}

export function buildProductPrompt(input: {
  template: ProductTemplate;
  scene: ProductScene;
  style: ProductStyle;
  sellingPoints?: string;
  ratio: ProductRatio;
}) {
  return [
    "请基于上传的商品图生成一张高质量商业商品图。",
    "保持商品主体、包装、颜色、比例、文字标识和材质细节尽量一致，不要改变商品身份。",
    `图片类型：${productTemplateLabels[input.template]}。`,
    `图片场景：${productSceneLabels[input.scene]}。`,
    `整体风格：${productStyleLabels[input.style]}。`,
    `商品卖点：${withFallback(input.sellingPoints)}。`,
    `画面比例倾向：${input.ratio}。`,
    "画面应干净、真实、专业，适合电商平台或社交媒体发布。",
    "不要生成虚假品牌文字、价格、二维码、水印或夸张装饰。"
  ].join("\n");
}

export function buildPosterPrompt(input: {
  title: string;
  subtitle?: string;
  usage: PosterUsage;
  style: PosterStyle;
  ratio: PosterRatio;
}) {
  return [
    "请生成一张适合作为海报或封面的高质量视觉背景，而不是带完整文字的成品海报。",
    `主题：${withFallback(input.title)}。`,
    input.subtitle?.trim() ? `辅助语义：${input.subtitle.trim()}。` : "",
    `用途：${posterUsageLabels[input.usage]}。`,
    `风格：${posterStyleLabels[input.style]}，${posterStyleGuides[input.style]}。`,
    `画面比例倾向：${input.ratio}。`,
    "构图要求：画面干净、现代、有审美，预留明确的大块文字排版区域，视觉中心不要挤满。",
    "画面元素建议：使用抽象形状、柔和光影、空间层次、少量生活方式或主题相关元素，保持高级克制。",
    "禁止生成复杂文字、乱码文字、价格、二维码、水印、Logo 或不可编辑文本。",
    "不要使用廉价卡通、杂乱拼贴、过度饱和渐变或密集装饰。"
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTextToImagePrompt(input: {
  prompt: string;
  style?: TextToImageStyle;
}) {
  const style = input.style || "realistic";

  return [
    "请根据用户描述生成一张高质量图片。",
    `用户描述：${withFallback(input.prompt)}。`,
    `视觉风格：${textToImageStyleLabels[style]}，${textToImageStyleGuides[style]}。`,
    "画面要求：主体清晰、构图完整、光影自然、细节干净，适合直接用于内容创作或商业展示。",
    "不要生成水印、Logo、二维码、乱码文字、扭曲文字或不必要的边框。",
    "如果用户没有明确要求文字，请不要在画面中生成文字。"
  ].join("\n");
}

export function buildRemoveBackgroundPrompt(userPrompt?: string) {
  return [
    "请对上传图片进行智能抠图，去除背景并保留主体。",
    "输出透明背景 PNG，主体边缘自然干净，尽量保留毛发、半透明材质、细小孔洞和边缘细节。",
    "不要改变主体形状、颜色、材质、文字标识、比例和姿态。",
    "不要添加新背景、投影、描边、发光、装饰物或水印。",
    userPrompt?.trim() ? `用户补充要求：${userPrompt.trim()}。` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildImageEnhancePrompt(userPrompt?: string) {
  return [
    "请对上传图片进行高清增强和质感优化。",
    "提升整体清晰度、细节层次、自然锐度、色彩平衡和光影表现，让画面更干净、更适合发布。",
    "保持原图主体、构图、场景、比例和真实质感不变。",
    "不要添加新物体、文字、边框、水印、装饰、强烈滤镜或不自然阴影。",
    userPrompt?.trim() ? `用户补充要求：${userPrompt.trim()}。` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildObjectRemovePrompt(userPrompt?: string) {
  return [
    "请根据用户描述移除图片中的多余元素，并自然补全背景。",
    `需要移除的内容：${withFallback(userPrompt)}。`,
    "常见对象包括路人、杂物、污点、水印、桌面杂乱物、多余文字或干扰元素。",
    "保持主要主体、构图、颜色、材质、透视和光线不变。",
    "补全区域应与周围纹理、景深、阴影和光照自然一致，避免涂抹感和重复纹理。",
    "不要添加新物体、边框、发光、贴纸或无关装饰。"
  ].join("\n");
}
