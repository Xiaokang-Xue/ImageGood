"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, LogOut, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

const navItems = [
  { label: "首页", href: "/" },
  { label: "智能修图", href: "/editor" },
  { label: "商品图", href: "/product" },
  { label: "封面海报", href: "/poster" },
  { label: "模板中心", href: "/templates" }
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refreshUser = () => {
      apiClient
        .me()
        .then((response) => setUser(response.user))
        .catch(() => setUser(null));
    };

    refreshUser();
    window.addEventListener("ai-image-credits-updated", refreshUser);
    return () => window.removeEventListener("ai-image-credits-updated", refreshUser);
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
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
  }, [menuOpen]);

  const handleLogout = async () => {
    await apiClient.logout().catch(() => null);
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const trialHref = user ? "/editor" : "/login?redirect=/editor";

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-button-gradient text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-base font-bold tracking-normal text-ink">ImageGood</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-studio-50 text-studio-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/history" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:block">
                历史记录
              </Link>
              <Link href="/pricing" className="hidden rounded-lg bg-studio-50 px-3 py-2 text-sm font-semibold text-studio-700 sm:block">
                积分：{user.credits}
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
                  onClick={() => setMenuOpen((value) => !value)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-studio-100 text-studio-700">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span className="hidden max-w-[120px] truncate sm:block">{user.name}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
                    <div className="border-b border-line px-4 py-3 text-sm font-semibold text-studio-700">
                      剩余积分：{user.credits}
                    </div>
                    <Link
                      href="/account"
                      className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      账户中心
                    </Link>
                    <Link
                      href="/pricing"
                      className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      购买积分
                    </Link>
                    <Link
                      href="/history"
                      className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      历史记录
                    </Link>
                    {user.role === "admin" ? (
                      <>
                        <Link
                          href="/admin/analytics"
                          className="block border-t border-line px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          数据看板
                        </Link>
                        <Link
                          href="/admin/orders"
                          className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          订单后台
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
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
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:block">
                登录
              </Link>
              <Link href="/register" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:block">
                注册
              </Link>
            </>
          )}
          <Link href={trialHref}>
            <Button size="md">
              立即体验
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
