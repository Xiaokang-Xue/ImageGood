"use client";

import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordTokenPage({ params }: { params: { token: string } }) {
  return (
    <Suspense>
      <ResetPasswordForm tokenFromPath={params.token} />
    </Suspense>
  );
}
