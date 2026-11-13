import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const renewalDays = 30;

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getAdminSupabase();
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select("id,book_id,due_at,returned_at")
      .eq("id", id)
      .single();

    if (loanError) throw loanError;
    if (loan.returned_at) return badRequest("這筆借閱已歸還，無法續借。", 409);

    const { count, error: reservationError } = await supabase
      .from("book_reservations")
      .select("id", { count: "exact", head: true })
      .eq("book_id", loan.book_id)
      .eq("status", "waiting");

    if (reservationError) throw reservationError;
    if ((count ?? 0) > 0) {
      return badRequest("這本書已有人預約，無法續借。", 409);
    }

    const currentDueAt = new Date(loan.due_at).getTime();
    const baseTime = Math.max(Date.now(), currentDueAt);
    const dueAt = new Date(baseTime + renewalDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("loans")
      .update({ due_at: dueAt })
      .eq("id", id)
      .is("returned_at", null)
      .select("due_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, due_at: data.due_at });
  } catch (error) {
    return serverError(error);
  }
}
