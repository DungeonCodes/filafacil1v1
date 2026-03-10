import { AdminScreen } from "@/features/admin/AdminScreen";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAuthenticatedUser(["admin"]);
  return <AdminScreen />;
}
