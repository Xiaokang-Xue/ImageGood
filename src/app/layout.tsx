import type { Metadata } from "next";
import "./globals.css";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "ImageGood - AI 图片创作平台",
  description:
    "ImageGood 是一款面向内容创作者、电商商家和普通用户的 AI 图片创作平台，支持 AI 修图、文生图、智能抠图、商品图生成、封面海报生成和历史记录管理。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
