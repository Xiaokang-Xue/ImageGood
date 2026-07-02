"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  Eraser,
  ImagePlus,
  LogIn,
  LogOut,
  Menu,
  Paintbrush,
  ScanLine,
  Scissors,
  ShoppingBag,
  Sparkles,
  UserRound,
  WandSparkles,
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logoutCurrentUser } from "@/lib/client-auth-api";
import {
  clearCurrentUserCache,
  getCurrentUserCached,
  subscribeCurrentUser
} from "@/lib/client-current-user";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

interface ToolNavItem {
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const processingTools: ToolNavItem[] = [
  { label: "AI 修图", description: "用自然语言完成图片修改", href: "/editor", icon: WandSparkles },
  { label: "智能抠图", description: "生成透明背景 PNG", href: "/remove-background", icon: Scissors },
  { label: "图片增强", description: "提升清晰度与细节质感", href: "/image-enhancer", icon: ScanLine },
  { label: "去杂物", description: "移除路人和多余元素", href: "/object-remover", icon: Eraser },
  { label: "换背景", description: "快速替换图片背景", href: "/editor?tool=background", icon: Paintbrush }
];

const generationTools: ToolNavItem[] = [
  { label: "文生图", description: "输入描述生成创意图片", href: "/text-to-image", icon: ImagePlus },
  { label: "商品图", description: "生成专业商品场景图", href: "/product", icon: ShoppingBag },
  { label: "封面海报", description: "制作封面与海报背景", href: "/poster", icon: Sparkles }
];

type DesktopMenu = "processing" | "generation" | null;

function isActivePath(pathname: string, href: string) {
  const targetPath = href.split("?")[0];
  return pathname === targetPath || (targetPath !== "/" && pathname.startsWith(`${targetPath}/`));
}

function ToolMenuLink({
  item,
  pathname,
  onClick,
  compact = false
}: {
  item: ToolNavItem;
  pathname: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent transition",
        compact ? "min-h-[68px] px-3 py-3" : "px-3 py-3",
        active
          ? "border-neutral-200 bg-neutral-50 text-neutral-950"
          : "text-neutral-700 hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-950"
      )}
      onClick={onClick}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-800 transition group-hover:border-neutral-500 group-hover:text-neutral-950">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className={cn("mt-0.5 block text-xs leading-5 text-neutral-500", compact && "hidden sm:block")}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState<DesktopMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCurrentUser(setUser);
    const refreshUser = () => {
      void getCurrentUserCached({ force: true });
    };

    void getCurrentUserCached();
    window.addEventListener("ai-image-credits-updated", refreshUser);
    window.addEventListener("imagegood-auth-changed", refreshUser);
    return () => {
      unsubscribe();
      window.removeEventListener("ai-image-credits-updated", refreshUser);
      window.removeEventListener("imagegood-auth-changed", refreshUser);
    };
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setDesktopMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen && !desktopMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && headerRef.current?.contains(target)) return;
      setUserMenuOpen(false);
      setDesktopMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setDesktopMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [desktopMenu, userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logoutCurrentUser().catch(() => null);
    clearCurrentUserCache();
    setUser(null);
    setUserMenuOpen(false);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  };

  const toggleDesktopMenu = (menu: Exclude<DesktopMenu, null>) => {
    setUserMenuOpen(false);
    setDesktopMenu((current) => (current === menu ? null : menu));
  };

  const trialHref = user ? "/editor" : "/login?redirect=/editor";
  const processingActive = processingTools.some((item) => isActivePath(pathname, item.href));
  const generationActive = generationTools.some((item) => isActivePath(pathname, item.href));

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="ImageGood 首页">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-950 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-normal text-neutral-950">ImageGood</span>
        </Link>

        <nav className="hidden h-full items-center gap-1 lg:flex" aria-label="主导航">
          <Link
            href="/"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition",
              pathname === "/" ? "bg-neutral-100 text-neutral-950" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
            )}
          >
            首页
          </Link>

          <div className="relative">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
                processingActive || desktopMenu === "processing"
                  ? "bg-neutral-100 text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              )}
              aria-expanded={desktopMenu === "processing"}
              onClick={() => toggleDesktopMenu("processing")}
            >
              AI 图片处理
              <ChevronDown className={cn("h-3.5 w-3.5 transition", desktopMenu === "processing" && "rotate-180")} />
            </button>
            {desktopMenu === "processing" ? (
              <div className="absolute left-1/2 top-[calc(100%+10px)] w-[520px] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
                <div className="grid grid-cols-2 gap-1">
                  {processingTools.map((item) => (
                    <ToolMenuLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
                generationActive || desktopMenu === "generation"
                  ? "bg-neutral-100 text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              )}
              aria-expanded={desktopMenu === "generation"}
              onClick={() => toggleDesktopMenu("generation")}
            >
              AI 图片生成
              <ChevronDown className={cn("h-3.5 w-3.5 transition", desktopMenu === "generation" && "rotate-180")} />
            </button>
            {desktopMenu === "generation" ? (
              <div className="absolute left-1/2 top-[calc(100%+10px)] w-[420px] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
                <div className="grid gap-1">
                  {generationTools.map((item) => (
                    <ToolMenuLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {[
            { label: "价格", href: "/pricing" },
            { label: "历史记录", href: "/history" }
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                isActivePath(pathname, item.href)
                  ? "bg-neutral-100 text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/pricing"
                className="hidden rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 sm:block"
              >
                {user.credits} 积分
              </Link>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                  aria-label="打开用户菜单"
                  aria-expanded={userMenuOpen}
                  onClick={() => {
                    setDesktopMenu(null);
                    setUserMenuOpen((value) => !value);
                  }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <span className="hidden max-w-[108px] truncate sm:block">{user.name}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-neutral-400 sm:block" />
                </button>
                {userMenuOpen ? (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
                    <div className="border-b border-neutral-100 px-3 py-2.5 text-xs font-medium text-neutral-500">
                      剩余积分：{user.credits}
                    </div>
                    <Link href="/account" className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                      账户中心
                    </Link>
                    <Link href="/pricing" className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                      购买积分
                    </Link>
                    <Link href="/history" className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                      历史记录
                    </Link>
                    {user.role === "admin" ? (
                      <>
                        <div className="my-1 border-t border-neutral-100" />
                        <Link href="/admin/analytics" className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                          数据看板
                        </Link>
                        <Link href="/admin/orders" className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                          订单后台
                        </Link>
                      </>
                    ) : null}
                    <div className="my-1 border-t border-neutral-100" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              登录
            </Link>
          )}

          <Link href={trialHref} className="hidden lg:block">
            <Button size="sm">
              立即体验
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 lg:hidden"
            aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={mobileOpen}
            onClick={() => {
              setUserMenuOpen(false);
              setMobileOpen((value) => !value);
            }}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 top-16 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            aria-label="关闭菜单"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[84vw] max-w-[320px] flex-col border-l border-neutral-300 bg-white shadow-2xl sm:max-w-[340px]">
            <div className="scrollbar-soft flex-1 overflow-y-auto px-4 py-5">
              <Link
                href="/"
                className={cn(
                  "mb-5 flex min-h-12 items-center rounded-lg border px-4 text-sm font-semibold",
                  pathname === "/"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-900"
                )}
              >
                首页
              </Link>

              <div>
                <p className="px-1 text-xs font-semibold text-neutral-400">AI 图片处理</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {processingTools.map((item) => (
                    <ToolMenuLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      compact
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="px-1 text-xs font-semibold text-neutral-400">AI 图片生成</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {generationTools.map((item) => (
                    <ToolMenuLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      compact
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 border-t border-neutral-200 pt-5">
                <Link href="/pricing" className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-800">
                  价格
                </Link>
                <Link href="/history" className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-800">
                  历史记录
                </Link>
                {user ? (
                  <Link href="/account" className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-800">
                    账户中心
                  </Link>
                ) : (
                  <Link href="/register" className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-800">
                    注册
                  </Link>
                )}
                {user ? (
                  <button
                    type="button"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rose-200 text-sm font-semibold text-rose-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                ) : (
                  <Link href="/login" className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-neutral-950 bg-neutral-950 text-sm font-semibold text-white">
                    <LogIn className="h-4 w-4" />
                    登录
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white p-4">
              <Link href={trialHref} onClick={() => setMobileOpen(false)}>
                <Button className="w-full">
                  开始创作
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
