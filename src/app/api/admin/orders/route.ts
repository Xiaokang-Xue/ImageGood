import { NextResponse } from "next/server";
import { listAdminOrders } from "@/lib/billing";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "没有管理员权限" } }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const provider = url.searchParams.get("provider") || "all";
  const result = await listAdminOrders({
    page: Number(url.searchParams.get("page") || "1"),
    limit: Number(url.searchParams.get("limit") || "10"),
    status: ["pending", "paid", "cancelled", "expired", "failed"].includes(status)
      ? (status as "pending" | "paid" | "cancelled" | "expired" | "failed")
      : "all",
    provider: ["wechat", "alipay", "manual"].includes(provider)
      ? (provider as "wechat" | "alipay" | "manual")
      : "all"
  });
  return NextResponse.json(result);
}
