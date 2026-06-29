import Link from "next/link";
import {
  ArrowUpRight,
  Eraser,
  ImagePlus,
  Paintbrush,
  ScanLine,
  Scissors,
  ShoppingBag,
  Sparkles,
  WandSparkles,
  type LucideIcon
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { taskCards } from "@/lib/studio-content";

const icons: Record<(typeof taskCards)[number]["id"], LucideIcon> = {
  edit: WandSparkles,
  "remove-background": Scissors,
  "image-enhancer": ScanLine,
  "object-remover": Eraser,
  background: Paintbrush,
  "text-to-image": ImagePlus,
  product: ShoppingBag,
  poster: Sparkles
};

const groups = [
  {
    id: "processing",
    eyebrow: "AI 图片处理",
    title: "让已有图片更接近你的想法",
    description: "上传一张图片，完成修饰、抠图、增强、去物和背景替换。"
  },
  {
    id: "generation",
    eyebrow: "AI 图片生成",
    title: "从文字和素材开始创作",
    description: "生成创意图片、商品场景和封面海报视觉。"
  }
] as const;

export function ToolDirectory() {
  return (
    <section className="border-b border-neutral-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-blue-600">全部工具</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            两类任务，一套清晰流程
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-600">
            选择目标，提供图片或文字，生成结果会自动保存到历史记录。
          </p>
        </div>

        <div className="mt-14 space-y-14">
          {groups.map((group) => {
            const tools = taskCards.filter((task) => task.group === group.id);

            return (
              <div key={group.id}>
                <div className="mb-6 flex flex-col justify-between gap-3 border-b border-neutral-300 pb-5 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">{group.eyebrow}</p>
                    <h3 className="mt-2 text-xl font-semibold text-neutral-950 sm:text-2xl">{group.title}</h3>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-neutral-500">{group.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((task) => {
                    const Icon = icons[task.id];

                    return (
                      <Link key={task.id} href={task.route} className="group block h-full">
                        <Card className="flex h-full min-h-[184px] flex-col p-6 hover:border-neutral-500 hover:bg-neutral-50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]">
                          <div className="flex items-start justify-between gap-4">
                            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 text-neutral-900 transition group-hover:border-neutral-950 group-hover:bg-neutral-950 group-hover:text-white">
                              <Icon className="h-5 w-5" />
                            </span>
                            <ArrowUpRight className="h-4 w-4 text-neutral-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-700" />
                          </div>
                          <div className="mt-auto pt-6">
                            <h4 className="text-base font-semibold text-neutral-950">{task.title}</h4>
                            <p className="mt-2 text-sm leading-6 text-neutral-500">{task.description}</p>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
