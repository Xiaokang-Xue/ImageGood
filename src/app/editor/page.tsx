import { EditorWorkspace } from "@/components/editor/EditorWorkspace";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function EditorPage({
  searchParams
}: {
  searchParams?: PageSearchParams;
}) {
  return <EditorWorkspace initialTool={firstParam(searchParams?.tool)} />;
}
