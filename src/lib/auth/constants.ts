import type { AppRole } from "./types";

const LOGIN_EMAIL_DOMAIN = "filafacil.local";
const USERNAME_PATTERN = /^[A-Z0-9._-]{3,32}$/;

export const INITIAL_ADMIN_USERNAME = "ADM";
export const INITIAL_ADMIN_PASSWORD = "Filafacil@2026";

export function normalizeUsername(value: string): string {
  return value.trim().toUpperCase();
}

export function buildLoginEmail(username: string): string {
  const normalizedUsername = normalizeUsername(username);
  return `${normalizedUsername.toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
}

export function isValidUsername(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);
  return USERNAME_PATTERN.test(normalizedUsername);
}

export function getDefaultRouteForRole(role: AppRole): string {
  if (role === "attendant") {
    return "/atendente";
  }
  if (role === "doctor") {
    return "/medico";
  }
  return "/admin";
}
