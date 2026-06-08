import { NextRequest, NextResponse } from "next/server";
import { formatTaiwanDate } from "@/lib/dates";
import { serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

type ReminderLoan = {
  id: string;
  due_at: string;
  books: {
    title: string;
    book_code: string;
  } | null;
  borrowers: {
    borrower_last_name: string;
    borrower_email: string | null;
  } | null;
};

function taiwanDayRangeInUtc(daysFromNow: number) {
  const taiwanOffsetMs = 8 * 60 * 60 * 1000;
  const nowInTaiwan = new Date(Date.now() + taiwanOffsetMs);
  nowInTaiwan.setUTCDate(nowInTaiwan.getUTCDate() + daysFromNow);
  nowInTaiwan.setUTCHours(0, 0, 0, 0);

  const start = new Date(nowInTaiwan.getTime() - taiwanOffsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function groupLoansByEmail(loans: ReminderLoan[]) {
  const groups = new Map<string, ReminderLoan[]>();
  for (const loan of loans) {
    const email = loan.borrowers?.borrower_email?.trim().toLowerCase();
    if (!email) continue;
    groups.set(email, [...(groups.get(email) ?? []), loan]);
  }
  return groups;
}

function reminderEmailHtml(loans: ReminderLoan[]) {
  const borrowerName = loans[0]?.borrowers?.borrower_last_name ?? "家長";
  const dueDate = formatTaiwanDate(loans[0]?.due_at);
  const items = loans
    .map((loan) => `<li>${loan.books?.title ?? "未命名書籍"}（${loan.books?.book_code ?? "-"}）</li>`)
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; color: #17211d;">
      <h2>幼兒園圖書借閱提醒</h2>
      <p>${borrowerName} 家長您好：</p>
      <p>您借閱的書籍將於 <strong>${dueDate}</strong> 到期，請記得準時歸還。</p>
      <ul>${items}</ul>
      <p>謝謝您。</p>
    </div>
  `;
}

async function sendReminderEmail(to: string, loans: ReminderLoan[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const from = process.env.RESEND_FROM_EMAIL || "幼兒園圖書借閱 <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: "圖書即將到期提醒",
      html: reminderEmailHtml(loans)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Email 寄送失敗。");
  }
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { start, end } = taiwanDayRangeInUtc(3);
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("loans")
      .select("id,due_at,books(title,book_code),borrowers(borrower_last_name,borrower_email)")
      .is("returned_at", null)
      .is("due_reminder_sent_at", null)
      .gte("due_at", start)
      .lt("due_at", end)
      .order("due_at", { ascending: true });

    if (error) throw error;

    const groups = groupLoansByEmail((data ?? []) as unknown as ReminderLoan[]);
    const sentLoanIds: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const [email, loans] of groups) {
      try {
        await sendReminderEmail(email, loans);
        sentLoanIds.push(...loans.map((loan) => loan.id));
      } catch (error) {
        failed.push({ email, error: error instanceof Error ? error.message : "寄送失敗" });
      }
    }

    if (sentLoanIds.length > 0) {
      const { error: updateError } = await supabase
        .from("loans")
        .update({ due_reminder_sent_at: new Date().toISOString() })
        .in("id", sentLoanIds);
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      ok: true,
      checked_from: start,
      checked_to: end,
      sent: sentLoanIds.length,
      failed
    });
  } catch (error) {
    return serverError(error);
  }
}
