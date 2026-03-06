// Copyright 2026 Fractalyze Inc. All rights reserved.

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (
    req.nextUrl.pathname.startsWith("/admin") &&
    req.auth.user.orgRole !== "admin"
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon\\.ico).*)"],
};
