import { NextResponse } from "next/server";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "系統發生錯誤，請稍後再試。";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function isMissingSupabaseConfig(error: unknown) {
  return error instanceof Error && error.message.includes("Missing NEXT_PUBLIC_SUPABASE_URL");
}
