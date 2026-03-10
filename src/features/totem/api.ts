import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AsyncResult, QueueOption, TicketPayload } from "./types";

type QueueRow = {
  id: unknown;
  name: unknown;
  prefix: unknown;
};

type TicketRpcRow = {
  prefix?: unknown;
  ticket_number?: unknown;
  ticket_date?: unknown;
  current_stage?: unknown;
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

function normalizeTicketPayload(data: unknown): TicketPayload | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as TicketRpcRow;
  const prefix = typeof candidate.prefix === "string" ? candidate.prefix : null;
  const numberCandidate = Number(candidate.ticket_number);

  if (!prefix || !Number.isFinite(numberCandidate)) {
    return null;
  }

  const ticketDate = typeof candidate.ticket_date === "string" ? candidate.ticket_date : undefined;
  const currentStage = typeof candidate.current_stage === "string" ? candidate.current_stage : undefined;

  return {
    prefix,
    ticketNumber: numberCandidate,
    ticketDate,
    currentStage
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
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

export async function createNextTicket(queuePrefix: string): Promise<AsyncResult<TicketPayload>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_next_ticket", { p_queue_prefix: queuePrefix });

    if (error) {
      return { ok: false, error: getErrorMessage(error, "Nao foi possivel gerar a senha.") };
    }

    const ticket = normalizeTicketPayload(data);
    if (!ticket) {
      return { ok: false, error: "Resposta invalida ao gerar a senha." };
    }

    return { ok: true, data: ticket };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao gerar a senha.") };
  }
}
