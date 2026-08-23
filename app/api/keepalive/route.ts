import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const TABLES_TO_PING = ["books", "loans", "borrowers", "book_categories"];

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (secret && authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const supabase = getAdminSupabase();
    let lastError = "";

    for (const table of TABLES_TO_PING) {
      const { error } = await supabase.from(table).select("id").limit(1);

      if (!error) {
        return NextResponse.json({
          ok: true,
          table,
          checkedAt: new Date().toISOString()
        });
      }

      lastError = `${table}: ${error.message}`;
    }

    throw new Error(lastError || "Supabase keepalive failed");
  } catch (error) {
    return serverError(error);
  }
}
