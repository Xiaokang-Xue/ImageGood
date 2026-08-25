import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ComplianceFooter } from "@/components/layout/ComplianceFooter";
import { LazyActiveImageTaskMonitor } from "@/components/tasks/LazyActiveImageTaskMonitor";

export const metadata: Metadata = {
  title: "ImageGood - AI 图片创作平台",
  description:
    "ImageGood 是一款面向内容创作者、电商商家和普通用户的 AI 图片创作平台，支持 AI 修图、文生图、智能抠图、商品图生成、封面海报生成和历史记录管理。",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cosBucket = process.env.TENCENT_COS_BUCKET?.trim();
  const cosRegion = process.env.TENCENT_COS_REGION?.trim();
  const cosOrigin = cosBucket && cosRegion ? `https://${cosBucket}.cos.${cosRegion}.myqcloud.com` : "";

  return (
    <html lang="zh-CN">
      {cosOrigin ? (
        <head>
          <link rel="dns-prefetch" href={cosOrigin} />
          <link rel="preconnect" href={cosOrigin} crossOrigin="anonymous" />
        </head>
      ) : null}
      <body>
        <SiteHeader />
        <PageViewTracker />
        <LazyActiveImageTaskMonitor />
        {children}
        <ComplianceFooter />
      </body>
    </html>
  );
}
