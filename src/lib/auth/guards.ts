import "server-only";

import { redirect } from "next/navigation";
import type { AppRole, SessionUser } from "./types";
import { getDefaultRouteForRole } from "./constants";
import { getSessionUser } from "./session";

export async function requireAuthenticatedUser(allowedRoles?: readonly AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return user;
}
