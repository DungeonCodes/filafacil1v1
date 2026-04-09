import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AsyncResult, QueueOption, TicketPayload } from "./types";

type QueueRow = {
  id: unknown;
  name: unknown;
  prefix: unknown;
};

type TicketApiRow = {
  prefix?: unknown;
  ticketNumber?: unknown;
  ticketDate?: unknown;
  currentStage?: unknown;
  isPriority?: unknown;
};

function normalizeQueueRows(rows: unknown): QueueOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const candidate = row as QueueRow;
    if (typeof candidate.id !== "number") {
      return [];
    }
    if (typeof candidate.name !== "string") {
      return [];
    }
    if (typeof candidate.prefix !== "string") {
      return [];
    }

    return [
      {
        id: candidate.id,
        name: candidate.name,
        prefix: candidate.prefix
      }
    ];
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeTicketPayload(data: unknown): TicketPayload | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as TicketApiRow;
  const prefix = typeof candidate.prefix === "string" ? candidate.prefix : null;
  const numberCandidate = Number(candidate.ticketNumber);

  if (!prefix || !Number.isFinite(numberCandidate)) {
    return null;
  }

  const ticketDate = typeof candidate.ticketDate === "string" ? candidate.ticketDate : undefined;
  const currentStage = typeof candidate.currentStage === "string" ? candidate.currentStage : undefined;
  const isPriority = candidate.isPriority === true;

  return {
    prefix,
    ticketNumber: numberCandidate,
    ticketDate,
    currentStage,
    isPriority
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = (error as { error?: unknown }).error;
    if (typeof apiError === "string" && apiError.trim().length > 0) {
      return apiError;
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

export async function loadQueues(): Promise<AsyncResult<QueueOption[]>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("queues").select("id, name, prefix").order("name", { ascending: true });

    if (error) {
      return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar as filas.") };
    }

    return { ok: true, data: normalizeQueueRows(data) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Falha de configuracao do Supabase.") };
  }
}

export async function createNextTicket(queuePrefix: string, isPriority = false): Promise<AsyncResult<TicketPayload>> {
  try {
    const response = await fetch("/api/totem/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        queuePrefix,
        isPriority
      })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { ok: false, error: getErrorMessage(isObject(payload) ? payload : null, "Nao foi possivel gerar a senha.") };
    }

    const ticket = normalizeTicketPayload(isObject(payload) ? payload.data : null);
    if (!ticket) {
      return { ok: false, error: "Resposta invalida ao gerar a senha." };
    }

    return { ok: true, data: ticket };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao gerar a senha.") };
  }
}
