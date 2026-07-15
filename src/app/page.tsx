import { CleanHeroSection } from "@/components/home/CleanHeroSection";
import { PricingCallout } from "@/components/home/PricingCallout";
import { ResultShowcase } from "@/components/home/ResultShowcase";
import { ToolDirectory } from "@/components/home/ToolDirectory";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <CleanHeroSection />
      <div className="hidden [content-visibility:auto] [contain-intrinsic-size:900px] md:block">
        <ToolDirectory />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:760px]">
        <ResultShowcase />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:360px]">
        <PricingCallout />
      </div>
    </main>
  );
}
