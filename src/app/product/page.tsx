import { ProductStudio } from "@/components/product/ProductStudio";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProductPage({
  searchParams
}: {
  searchParams?: PageSearchParams;
}) {
  return <ProductStudio initialTemplate={firstParam(searchParams?.template)} />;
}
