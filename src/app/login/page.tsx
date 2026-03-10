import { redirect } from "next/navigation";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { getDefaultRouteForRole } from "@/lib/auth/constants";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user?.isActive) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return <LoginScreen />;
}
