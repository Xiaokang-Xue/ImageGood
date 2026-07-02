import { NextResponse } from "next/server";
import { CREDIT_PACKAGES } from "@/config/billing-plans";

export function GET() {
  return NextResponse.json(
    { packages: CREDIT_PACKAGES },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600"
      }
    }
  );
}
