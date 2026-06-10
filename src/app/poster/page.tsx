import { PosterStudio } from "@/components/poster/PosterStudio";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PosterPage({
  searchParams
}: {
  searchParams?: PageSearchParams;
}) {
  return (
    <PosterStudio
      initialUsage={firstParam(searchParams?.usage)}
      initialStyle={firstParam(searchParams?.style)}
      initialRatio={firstParam(searchParams?.ratio)}
    />
  );
}
