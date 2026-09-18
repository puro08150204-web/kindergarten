import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (secret && authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const supabase = getAdminSupabase();
    const checks = await Promise.all([
      supabase.from("books").select("id").limit(1),
      supabase.from("loans").select("id").limit(1),
      supabase.from("borrowers").select("id").limit(1),
      supabase.from("book_categories").select("id").limit(1)
    ]);

    const errors = checks
      .map((result, index) => result.error && `query ${index + 1}: ${result.error.message}`)
      .filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    return NextResponse.json({
      ok: true,
      queries: checks.length,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return serverError(error);
  }
}
