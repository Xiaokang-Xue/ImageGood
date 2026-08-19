import Link from "next/link";

export function ComplianceFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-6 text-xs leading-5 text-neutral-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="max-w-4xl">
          ImageGood 仅提供图片创作与处理技术服务。请确保上传内容及使用方式合法合规，并尊重他人的著作权、肖像权和隐私权；严禁用于违法违规、欺诈、侵权或误导性用途。
        </p>
        <div className="flex shrink-0 items-center gap-4 font-medium text-neutral-700">
          <Link href="/feedback" className="hover:text-neutral-950">反馈与建议</Link>
          <Link href="/" className="hover:text-neutral-950">© ImageGood</Link>
        </div>
      </div>
    </footer>
  );
}
