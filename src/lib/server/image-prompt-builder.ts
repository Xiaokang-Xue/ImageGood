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

const DEFAULT_EDIT_PROMPT = "自然优化画面，未明确要求的内容保持不变";

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

function withFallback(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function joinPrompt(lines: Array<string | undefined>) {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export function buildEditPrompt(tool: EditTool, userPrompt?: string) {
  const defaults: Record<EditTool, string> = {
    background: "将背景替换为与主体自然协调的干净背景",
    remove: "移除画面中明显的干扰元素并自然补全背景",
    enhance: "提升清晰度和细节，保持画面自然",
    style: "统一色调与光影，提升整体视觉质感",
    expand: "自然扩展画面边缘",
    custom: DEFAULT_EDIT_PROMPT
  };
  const requirement = withFallback(userPrompt, defaults[tool]);

  const templates: Record<EditTool, string> = {
    background: joinPrompt([
      "任务：替换图片背景。",
      `用户要求（优先执行）：${requirement}。`,
      "除用户明确要求外，只改变背景；主体的形状、颜色、材质、比例、文字标识和边缘保持不变。",
      "新背景的透视、光线和景深应与主体自然一致，不添加无关元素。"
    ]),
    remove: joinPrompt([
      "任务：移除指定元素并补全背景。",
      `用户要求（优先执行）：${requirement}。`,
      "只处理目标及其覆盖区域，其他主体、构图、颜色和光影保持不变。",
      "补全纹理、透视和光照应与周围一致，不留下涂抹或重复痕迹。"
    ]),
    enhance: joinPrompt([
      "任务：增强图片清晰度。",
      `用户要求（优先执行）：${requirement}。`,
      "改善细节、噪点和自然锐度；保持原有主体、构图、颜色与场景不变。",
      "不要新增物体、文字、阴影、滤镜或装饰。"
    ]),
    style: joinPrompt([
      "任务：调整图片视觉风格。",
      `用户要求（优先执行）：${requirement}。`,
      "只按要求调整色调、光影和质感；主体身份、形状、比例与场景内容保持不变。",
      "不要引入用户未要求的风格、物体、文字或特效。"
    ]),
    expand: joinPrompt([
      "任务：自然扩展图片画面。",
      `用户要求（优先执行）：${requirement}。`,
      "原图区域和主体保持不变；仅补全画面边缘。",
      "扩展内容应延续原图的透视、光线、景深和纹理，不复制主体。"
    ]),
    custom: joinPrompt([
      "任务：按要求精确编辑图片。",
      `用户要求（优先执行）：${requirement}。`,
      "只修改要求涉及的对象和区域，未提及内容保持不变。",
      "结果应自然可信，不添加用户未要求的阴影、描边、文字、物体或特效。"
    ])
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
  const sellingPoints = input.sellingPoints?.trim();

  return joinPrompt([
    "任务：基于上传图片制作真实的商业商品图。",
    "商品本身优先保持一致：外形、包装、颜色、比例、材质和已有文字标识不得擅自改变。",
    `成图要求：${productTemplateLabels[input.template]}；场景为${productSceneLabels[input.scene]}；${productStyleLabels[input.style]}风格；比例 ${input.ratio}。`,
    sellingPoints ? `视觉重点：${sellingPoints}。仅通过构图和场景体现，不新增宣传文字。` : undefined,
    "画面自然、整洁，商品清晰突出；不添加虚假品牌、价格、二维码或水印。"
  ]);
}

export function buildPosterPrompt(input: {
  title: string;
  subtitle?: string;
  usage: PosterUsage;
  style: PosterStyle;
  ratio: PosterRatio;
}) {
  return joinPrompt([
    "任务：生成无文字的封面或海报背景。",
    `主题：${withFallback(input.title, "与用户用途相关的封面视觉")}。`,
    input.subtitle?.trim() ? `补充语义：${input.subtitle.trim()}。` : undefined,
    `用途：${posterUsageLabels[input.usage]}；风格：${posterStyleLabels[input.style]}，${posterStyleGuides[input.style]}；比例 ${input.ratio}。`,
    "围绕主题建立清晰视觉中心，并预留完整、低干扰的标题排版区域。",
    "不要生成任何文字、Logo、价格、二维码或水印；避免杂乱拼贴和无关装饰。"
  ]);
}

export function buildTextToImagePrompt(input: {
  prompt: string;
  style?: TextToImageStyle;
}) {
  const style = input.style || "realistic";

  return joinPrompt([
    "任务：根据描述生成图片。",
    `用户描述（优先执行）：${withFallback(input.prompt, "生成一张构图完整、内容自然的图片")}。`,
    `参考风格：${textToImageStyleLabels[style]}，${textToImageStyleGuides[style]}。若与用户描述冲突，以用户描述为准。`,
    "忠实呈现用户指定的主体、数量、关系、场景和构图，不擅自增加关键元素。",
    "除非用户明确要求，否则不要生成文字、Logo、二维码、水印或边框。"
  ]);
}

export function buildRemoveBackgroundPrompt(userPrompt?: string) {
  return joinPrompt([
    "任务：去除背景，输出透明背景 PNG。",
    userPrompt?.trim() ? `用户要求（优先执行）：${userPrompt.trim()}。` : undefined,
    "完整保留主体及毛发、孔洞和半透明边缘；主体的形状、颜色、材质、文字、比例和姿态不变。",
    "边缘应自然干净，不添加新背景、阴影、描边、发光或水印。"
  ]);
}

export function buildImageEnhancePrompt(userPrompt?: string) {
  return joinPrompt([
    "任务：增强图片清晰度和细节。",
    userPrompt?.trim() ? `用户要求（优先执行）：${userPrompt.trim()}。` : undefined,
    "降低噪点与压缩痕迹，恢复自然细节和锐度；保持主体、构图、颜色、光影与场景不变。",
    "不要重绘内容或添加物体、文字、滤镜、阴影、边框和水印。"
  ]);
}

export function buildObjectRemovePrompt(userPrompt?: string) {
  return joinPrompt([
    "任务：移除用户指定的对象并补全背景。",
    `移除对象（仅限这些内容）：${withFallback(userPrompt, "用户明确指定的多余元素")}。`,
    "目标以外的主体、构图、颜色、材质和光线保持不变。",
    "补全区域应延续周围纹理、透视、景深和光照，不留涂抹、重复纹理或新增物体。"
  ]);
}
