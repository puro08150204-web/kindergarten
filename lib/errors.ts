import { NextResponse } from "next/server";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(error: unknown) {
  let message = "系統發生錯誤，請稍後再試。";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object") {
    const detail = error as { message?: string; details?: string; hint?: string; code?: string };
    message = [detail.message, detail.details, detail.hint, detail.code && `代碼：${detail.code}`]
      .filter(Boolean)
      .join(" ");
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export function isMissingSupabaseConfig(error: unknown) {
  return error instanceof Error && error.message.includes("Missing NEXT_PUBLIC_SUPABASE_URL");
}
