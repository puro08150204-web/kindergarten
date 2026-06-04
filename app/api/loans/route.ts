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

    const { data, error } = await supabase
      .from("loans")
      .select("*, books(*), borrowers(*)")
      .is("returned_at", null)
      .order("due_at", { ascending: true });

    if (error) throw error;

    const loans = (data ?? [])
      .map((loan) => ({
        ...loan,
        loan_status: isOverdue(loan.due_at, loan.returned_at) ? "逾期" : "借閱中"
      }))
      .filter((loan) => (mode === "overdue" ? loan.loan_status === "逾期" : true));

    return NextResponse.json({ loans });
  } catch (error) {
    if (isMissingSupabaseConfig(error)) {
      const loans = demoLoans.filter((loan) => (new URL(request.url).searchParams.get("mode") === "overdue" ? loan.loan_status === "逾期" : true));
      return NextResponse.json({ loans, setupRequired: true });
    }
    return serverError(error);
  }
}
