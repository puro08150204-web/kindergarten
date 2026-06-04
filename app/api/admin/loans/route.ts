import { NextRequest, NextResponse } from "next/server";
import { demoLoans } from "@/lib/demo-data";
import { isOverdue } from "@/lib/dates";
import { isMissingSupabaseConfig, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "active";
    const supabase = getAdminSupabase();

    let query = supabase
      .from("loans")
      .select("*, books(*), borrowers(*)")
      .order("borrowed_at", { ascending: false });

    if (mode !== "all") query = query.is("returned_at", null);

    const { data, error } = await query;
    if (error) throw error;

    const loans = (data ?? [])
      .map((loan) => ({
        ...loan,
        loan_status: loan.returned_at ? "已歸還" : isOverdue(loan.due_at, loan.returned_at) ? "逾期" : "借閱中"
      }))
      .filter((loan) => (mode === "overdue" ? loan.loan_status === "逾期" : true));

    return NextResponse.json({ loans });
  } catch (error) {
    if (isMissingSupabaseConfig(error)) {
      const mode = new URL(request.url).searchParams.get("mode") || "active";
      const loans = demoLoans.filter((loan) => (mode === "overdue" ? loan.loan_status === "逾期" : true));
      return NextResponse.json({ loans, setupRequired: true });
    }
    return serverError(error);
  }
}
