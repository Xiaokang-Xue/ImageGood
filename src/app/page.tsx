import { CleanHeroSection } from "@/components/home/CleanHeroSection";
import { PricingCallout } from "@/components/home/PricingCallout";
import { ResultShowcase } from "@/components/home/ResultShowcase";
import { ToolDirectory } from "@/components/home/ToolDirectory";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <CleanHeroSection />
      <ToolDirectory />
      <ResultShowcase />
      <PricingCallout />
    </main>
  );
}
