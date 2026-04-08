import type { AsyncResult } from "./types";

type ResetPanelsResponse = {
  clearedOperationalTickets: number;
  clearedRecentCalls: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (isObject(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return fallbackMessage;
}

function toResetPanelsResponse(value: unknown): ResetPanelsResponse | null {
  if (!isObject(value)) {
    return null;
  }

  const clearedOperationalTickets = Number(value.clearedOperationalTickets);
  const clearedRecentCalls = value.clearedRecentCalls === true;

  if (!Number.isFinite(clearedOperationalTickets)) {
    return null;
  }

  return {
    clearedOperationalTickets,
    clearedRecentCalls
  };
}

export async function resetOperationalPanels(): Promise<AsyncResult<ResetPanelsResponse>> {
  try {
    const response = await fetch("/api/admin/panels/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { ok: false, error: getErrorMessage(payload, "Nao foi possivel limpar os painis de atendimento.") };
    }

    const data = toResetPanelsResponse(isObject(payload) ? payload.data : null);
    if (!data) {
      return { ok: false, error: "Resposta invalida ao limpar os painis de atendimento." };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: "Falha de comunicacao ao limpar os painis de atendimento." };
  }
}
