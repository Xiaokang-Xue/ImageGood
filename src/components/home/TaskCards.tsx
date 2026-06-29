"use client";

import { useRouter } from "next/navigation";
import { Eraser, ImagePlus, Paintbrush, ScanLine, Scissors, ShoppingBag, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { taskCards, toolPrompts } from "@/lib/studio-content";
import { useStudioStore } from "@/lib/studio-store";
import type { EditTool } from "@/types/image";

const icons = [Paintbrush, Sparkles, Scissors, ImagePlus, Eraser, ShoppingBag];

export function TaskCards() {
  const router = useRouter();
  const setSelectedTool = useStudioStore((state) => state.setSelectedTool);
  const setPrompt = useStudioStore((state) => state.setPrompt);

  return (
    <section className="py-14">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-studio-600">常用任务</p>
          <h2 className="mt-2 text-2xl font-bold tracking-normal text-ink">从一个明确目标开始</h2>
        </div>
        <p className="hidden max-w-xl text-sm leading-6 text-muted md:block">
          选择一个常用图片任务，上传素材后即可生成并保存结果。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {taskCards.map((task, index) => {
          const Icon = icons[index] ?? Paintbrush;
          return (
            <Card
              key={task.title}
              role="button"
              tabIndex={0}
              className="group cursor-pointer p-5 hover:-translate-y-1 hover:border-studio-200 hover:shadow-soft"
              onClick={() => {
                if ("tool" in task && task.tool) {
                  const tool = task.tool as EditTool;
                  setSelectedTool(tool);
                  setPrompt(toolPrompts[tool]);
                }
                router.push(task.route);
              }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-950 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-ink">{task.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{task.description}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
