import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";
import { callNextWithPriority } from "@/lib/tickets/callNextWithPriority";
import { isPriorityColumnUnavailable, PRIORITY_DESC_ORDER } from "@/lib/tickets/prioritySupport";
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
  is_priority?: unknown;
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
    consultingRoom: toNullableString(candidate.current_consulting_room),
    isPriority: candidate.is_priority === true
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

const ATTENDANT_BASE_TICKET_COLUMNS = "id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room";

function getAttendantTicketColumns(includePriority: boolean): string {
  return includePriority ? `${ATTENDANT_BASE_TICKET_COLUMNS}, is_priority` : ATTENDANT_BASE_TICKET_COLUMNS;
}

export async function loadAttendantSnapshot(queuePrefix: string): Promise<AsyncResult<AttendantSnapshot>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const businessDate = getCurrentBusinessDate();

    async function fetchCurrentTicket(includePriority: boolean) {
      return await supabase
        .from("tickets")
        .select(getAttendantTicketColumns(includePriority))
        .eq("ticket_date", businessDate)
        .eq("current_stage", "called_attendant")
        .eq("prefix", queuePrefix)
        .order("called_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);
    }

    async function fetchWaitingTickets(includePriority: boolean) {
      const query = supabase
        .from("tickets")
        .select(getAttendantTicketColumns(includePriority))
        .eq("ticket_date", businessDate)
        .eq("current_stage", "waiting_attendant")
        .eq("prefix", queuePrefix);

      if (includePriority) {
        query.order("is_priority", PRIORITY_DESC_ORDER);
      }

      return await query.order("created_at", { ascending: true }).limit(20);
    }

    let currentResult = await fetchCurrentTicket(true);
    if (currentResult.error && isPriorityColumnUnavailable(currentResult.error)) {
      currentResult = await fetchCurrentTicket(false);
    }

    if (currentResult.error) {
      return { ok: false, error: getErrorMessage(currentResult.error, "Nao foi possivel carregar a senha atual.") };
    }

    let waitingResult = await fetchWaitingTickets(true);
    if (waitingResult.error && isPriorityColumnUnavailable(waitingResult.error)) {
      waitingResult = await fetchWaitingTickets(false);
    }

    if (waitingResult.error) {
      return { ok: false, error: getErrorMessage(waitingResult.error, "Nao foi possivel carregar a fila de espera inicial.") };
    }

    const currentTicket = normalizeTicket(Array.isArray(currentResult.data) ? currentResult.data[0] : null);
    const waitingTickets = (Array.isArray(waitingResult.data) ? waitingResult.data : []).flatMap((row) => {
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
    return await callNextWithPriority({
      supabase,
      queuePrefix: input.queuePrefix,
      waitingStage: "waiting_attendant",
      calledStage: "called_attendant",
      destinationType: "attendant",
      destinationLabel: input.destinationLabel,
      calledBy: input.calledBy,
      currentConsultingRoom: null
    });
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
