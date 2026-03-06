// Copyright 2026 Fractalyze Inc. All rights reserved.

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      login: string;
      orgRole: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
    orgRole?: string;
  }
}
