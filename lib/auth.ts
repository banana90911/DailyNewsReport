import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

function getProviderList(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ];

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.push(
      DiscordProvider({
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true
      }) as (typeof providers)[number]
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: getProviderList(),
  callbacks: {
    async signIn({ user, account }) {
      if (!account) {
        return false;
      }

      if (account.provider === "google") {
        return true;
      }

      if (account.provider === "discord") {
        const googleLinked = await prisma.account.findFirst({
          where: {
            userId: user.id,
            provider: "google"
          },
          select: { id: true }
        });

        if (!googleLinked) {
          return "/login?error=google_required";
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

      if (token.userId) {
        const accounts = await prisma.account.findMany({
          where: { userId: token.userId },
          select: { provider: true }
        });

        token.googleLinked = accounts.some((a) => a.provider === "google");
        token.discordLinked = accounts.some((a) => a.provider === "discord");
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.googleLinked = Boolean(token.googleLinked);
        session.user.discordLinked = Boolean(token.discordLinked);
      }
      return session;
    }
  }
};
