import { MedicoScreen } from "@/features/medico/MedicoScreen";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MedicoPage() {
  await requireAuthenticatedUser(["doctor", "admin"]);
  return <MedicoScreen />;
}
