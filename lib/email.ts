import nodemailer from "nodemailer";

type AvailabilityEmail = {
  to: string;
  bookTitle: string;
};

export async function sendAvailabilityEmail({ to, bookTitle }: AvailabilityEmail) {
  const user = process.env.GMAIL_SMTP_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!user || !appPassword) {
    return { sent: false, error: "尚未設定預約通知寄信服務。" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: `幼兒園圖書借閱 <${user}>`,
      to,
      subject: `預約書籍已可借閱：${bookTitle}`,
      html: `<p>您預約的「${escapeHtml(bookTitle)}」已歸還，現在可以借閱。</p><p>請前往幼兒園圖書借閱系統查看。</p>`
    });
    return { sent: true, error: null };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "寄信失敗。" };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}
