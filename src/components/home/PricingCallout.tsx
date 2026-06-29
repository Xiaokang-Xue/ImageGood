import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PricingCallout() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-neutral-400">按需购买积分</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">从一次真实创作开始</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300 sm:text-base">
              新用户注册可获得免费体验积分。每次成功生成消耗 1 积分，生成失败不扣积分。
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400">
              {["微信与支付宝支付", "支付成功自动到账", "积分适用于全部图片工具"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-white" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <Link href="/pricing" className="mt-8 inline-block shrink-0 lg:mt-0">
            <Button variant="secondary" size="lg" className="w-full border-white bg-white text-neutral-950 hover:bg-neutral-100 sm:w-auto">
              查看积分价格
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
