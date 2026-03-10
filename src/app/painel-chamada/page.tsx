import { PainelChamadaScreen } from "@/features/painel-chamada/PainelChamadaScreen";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function PainelChamadaPage() {
  await requireAuthenticatedUser();
  return <PainelChamadaScreen />;
}
