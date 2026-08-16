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
    const { error } = await supabase.from("books").select("id").limit(1);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return serverError(error);
  }
}
