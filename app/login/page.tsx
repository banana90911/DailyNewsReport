import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/login-panel";
import { getSessionOrNull } from "@/lib/session";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string; callbackUrl?: string };
}) {
  const session = await getSessionOrNull();

  if (session?.user?.id && session.user.googleLinked) {
    redirect(searchParams?.callbackUrl || "/");
  }

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <LoginPanel
      error={searchParams?.error}
      callbackUrl={searchParams?.callbackUrl || "/"}
      googleConfigured={googleConfigured}
    />
  );
}
