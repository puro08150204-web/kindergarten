import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, getAdminPassword } from "@/lib/admin-auth";

function hasAdminAccess(request: NextRequest) {
  return request.cookies.get(adminCookieName)?.value === getAdminPassword();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !hasAdminAccess(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login") && !pathname.startsWith("/api/admin/logout") && !hasAdminAccess(request)) {
    return NextResponse.json({ error: "請先輸入後台密碼。" }, { status: 401 });
  }

  const protectsBookMutation =
    pathname.startsWith("/api/import") ||
    (pathname.startsWith("/api/categories") && request.method !== "GET") ||
    (pathname.startsWith("/api/books") && request.method !== "GET");

  if (protectsBookMutation && !hasAdminAccess(request)) {
    return NextResponse.json({ error: "請先輸入後台密碼。" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/books/:path*", "/api/categories/:path*", "/api/import/:path*"]
};
