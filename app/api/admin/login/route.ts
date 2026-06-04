import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, getAdminPassword, isAdminPassword } from "@/lib/admin-auth";
import { badRequest } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const password = String(payload.password || "");

  if (!isAdminPassword(password)) {
    return badRequest("密碼不正確。", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, getAdminPassword(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
