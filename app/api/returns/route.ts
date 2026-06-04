import { NextRequest, NextResponse } from "next/server";
import { isOverdue } from "@/lib/dates";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const lineId = new URL(request.url).searchParams.get("lineId")?.trim();
    if (!lineId) return badRequest("請輸入 Line ID。");

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("loans")
      .select("*, books(*), borrowers!inner(*)")
      .eq("borrowers.borrower_line_id", lineId)
      .is("returned_at", null)
      .order("borrowed_at", { ascending: false });

    if (error) throw error;

    const loans = (data ?? []).map((loan) => ({
      ...loan,
      loan_status: isOverdue(loan.due_at, loan.returned_at) ? "逾期" : "借閱中"
    }));

    return NextResponse.json({ loans });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const loanIds = Array.isArray(payload.loan_ids) ? payload.loan_ids.filter(Boolean) : [];
    if (loanIds.length === 0) return badRequest("請選擇要歸還的書。");

    const supabase = getAdminSupabase();
    const { data: loans, error: findError } = await supabase
      .from("loans")
      .select("id,book_id")
      .in("id", loanIds)
      .is("returned_at", null);

    if (findError) throw findError;
    const bookIds = (loans ?? []).map((loan) => loan.book_id);

    const { error: loanError } = await supabase
      .from("loans")
      .update({ returned_at: new Date().toISOString() })
      .in("id", loanIds)
      .is("returned_at", null);

    if (loanError) throw loanError;

    if (bookIds.length > 0) {
      const { error: bookError } = await supabase
        .from("books")
        .update({ status: "在架上" })
        .in("id", bookIds);
      if (bookError) throw bookError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
