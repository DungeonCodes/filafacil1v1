import { AtendenteScreen } from "@/features/atendente/AtendenteScreen";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AtendentePage() {
  await requireAuthenticatedUser(["attendant", "admin"]);
  return <AtendenteScreen />;
}
