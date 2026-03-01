// Copyright 2026 Fractalyze Inc. All rights reserved.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const ALLOWED_ORG = "fractalyze";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user read:org" } },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "github" || !profile?.login) {
        return false;
      }

      const res = await fetch(
        `https://api.github.com/orgs/${ALLOWED_ORG}/members/${profile.login}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      // 204 = member, 302/404 = not a member
      return res.status === 204;
    },
  },
});
