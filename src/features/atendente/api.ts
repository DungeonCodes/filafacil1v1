import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AsyncResult,
  AttendantSnapshot,
  AttendantTicket,
  CallNextAttendantInput,
  FinishInitialAttendanceInput,
  RecallTicketInput
} from "./types";

type TicketRow = {
  id?: unknown;
  prefix?: unknown;
  ticket_number?: unknown;
  current_stage?: unknown;
  created_at?: unknown;
  called_at?: unknown;
  current_consulting_room?: unknown;
};

function toNumber(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return normalized;
}

function toRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toRequiredString(value);
}

function normalizeTicket(row: unknown): AttendantTicket | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as TicketRow;
  const id = toNumber(candidate.id);
  const prefix = toRequiredString(candidate.prefix);
  const ticketNumber = toNumber(candidate.ticket_number);
  const stage = toRequiredString(candidate.current_stage);
  const createdAt = toRequiredString(candidate.created_at);

  if (id === null || prefix === null || ticketNumber === null || stage === null || createdAt === null) {
    return null;
  }

  return {
    id,
    prefix,
    ticketNumber,
    stage,
    createdAt,
    calledAt: toNullableString(candidate.called_at),
    consultingRoom: toNullableString(candidate.current_consulting_room)
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

export async function loadAttendantSnapshot(queuePrefix: string): Promise<AsyncResult<AttendantSnapshot>> {
  try {
    const supabase = getSupabaseBrowserClient();

    const { data: currentData, error: currentError } = await supabase
      .from("tickets")
      .select("id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room")
      .eq("current_stage", "called_attendant")
      .eq("prefix", queuePrefix)
      .order("called_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (currentError) {
      return { ok: false, error: getErrorMessage(currentError, "Nao foi possivel carregar a senha atual.") };
    }

    const { data: waitingData, error: waitingError } = await supabase
      .from("tickets")
      .select("id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room")
      .eq("current_stage", "waiting_attendant")
      .eq("prefix", queuePrefix)
      .order("created_at", { ascending: true })
      .limit(20);

    if (waitingError) {
      return { ok: false, error: getErrorMessage(waitingError, "Nao foi possivel carregar a fila de espera inicial.") };
    }

    const currentTicket = normalizeTicket(Array.isArray(currentData) ? currentData[0] : null);
    const waitingTickets = (Array.isArray(waitingData) ? waitingData : []).flatMap((row) => {
      const ticket = normalizeTicket(row);
      return ticket ? [ticket] : [];
    });

    return {
      ok: true,
      data: {
        currentTicket,
        waitingTickets
      }
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Falha ao carregar dados do atendente.") };
  }
}

export async function callNextAttendant(input: CallNextAttendantInput): Promise<AsyncResult<null>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("call_next_attendant", {
      p_queue_prefix: input.queuePrefix,
      p_destination_label: input.destinationLabel,
      p_called_by: input.calledBy
    });

    if (error) {
      return { ok: false, error: getErrorMessage(error, "Nao foi possivel chamar a proxima senha.") };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao chamar a proxima senha.") };
  }
}

export async function finishInitialAttendance(input: FinishInitialAttendanceInput): Promise<AsyncResult<null>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("tickets")
      .update({
        current_stage: "waiting_doctor",
        current_consulting_room: null,
        called_at: null
      })
      .eq("id", input.ticketId)
      .eq("current_stage", "called_attendant");

    if (error) {
      return { ok: false, error: getErrorMessage(error, "Nao foi possivel finalizar o atendimento inicial.") };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao finalizar o atendimento inicial.") };
  }
}

export async function recallCurrentTicket(input: RecallTicketInput): Promise<AsyncResult<null>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const recalledAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tickets")
      .update({ called_at: recalledAt })
      .eq("id", input.ticketId)
      .eq("current_stage", "called_attendant");

    if (updateError) {
      return { ok: false, error: getErrorMessage(updateError, "Nao foi possivel rechamar a senha atual.") };
    }

    const { error: insertError } = await supabase.from("calls").insert({
      ticket_id: input.ticketId,
      stage: "called_attendant",
      destination_type: "attendant",
      destination_label: input.destinationLabel,
      called_by: input.calledBy,
      called_at: recalledAt
    });

    if (insertError) {
      return { ok: false, error: getErrorMessage(insertError, "Nao foi possivel registrar o rechamado.") };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao rechamar a senha.") };
  }
}
