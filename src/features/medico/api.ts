import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";
import { callNextWithPriority } from "@/lib/tickets/callNextWithPriority";
import type {
  AsyncResult,
  CallNextDoctorInput,
  DoctorRecentCall,
  DoctorSnapshot,
  DoctorTicket,
  FinishDoctorTicketInput
} from "./types";

type TicketRow = {
  id?: unknown;
  prefix?: unknown;
  ticket_number?: unknown;
  ticket_date?: unknown;
  current_stage?: unknown;
  created_at?: unknown;
  called_at?: unknown;
  current_consulting_room?: unknown;
  is_priority?: unknown;
};

type CallRow = {
  id?: unknown;
  ticket_id?: unknown;
  stage?: unknown;
  destination_label?: unknown;
  called_at?: unknown;
  called_by?: unknown;
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function normalizeDoctorTicket(row: unknown): DoctorTicket | null {
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

function normalizeRecentCall(row: unknown): Omit<DoctorRecentCall, "ticketPrefix" | "ticketNumber"> | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as CallRow;
  const id = toNumber(candidate.id);
  const ticketId = toNumber(candidate.ticket_id);
  const stage = toRequiredString(candidate.stage);
  const calledAt = toRequiredString(candidate.called_at);

  if (id === null || ticketId === null || stage === null || calledAt === null) {
    return null;
  }

  return {
    id,
    ticketId,
    stage,
    destinationLabel: toNullableString(candidate.destination_label),
    calledAt,
    calledBy: toNullableString(candidate.called_by)
  };
}

async function fetchCurrentDoctorTicket(queuePrefix: string, consultingRoom: string): Promise<AsyncResult<DoctorTicket | null>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room, is_priority")
    .eq("ticket_date", businessDate)
    .eq("current_stage", "called_doctor")
    .eq("prefix", queuePrefix)
    .eq("current_consulting_room", consultingRoom)
    .order("called_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar a senha atual do consultorio.") };
  }

  const currentTicket = normalizeDoctorTicket(Array.isArray(data) ? data[0] : null);
  return { ok: true, data: currentTicket };
}

async function fetchWaitingDoctorQueue(queuePrefix: string): Promise<AsyncResult<DoctorTicket[]>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room, is_priority")
    .eq("ticket_date", businessDate)
    .eq("current_stage", "waiting_doctor")
    .eq("prefix", queuePrefix)
    .order("is_priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar a fila medica em espera.") };
  }

  const waitingTickets = (Array.isArray(data) ? data : []).flatMap((row) => {
    const ticket = normalizeDoctorTicket(row);
    return ticket ? [ticket] : [];
  });

  return { ok: true, data: waitingTickets };
}

async function fetchRecentDoctorCalls(consultingRoom: string): Promise<AsyncResult<DoctorRecentCall[]>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("calls")
    .select("id, ticket_id, stage, destination_label, called_at, called_by")
    .eq("destination_type", "doctor")
    .eq("destination_label", consultingRoom)
    .order("called_at", { ascending: false })
    .limit(30);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar o historico do consultorio.") };
  }

  const recentCalls = (Array.isArray(data) ? data : []).flatMap((row) => {
    const call = normalizeRecentCall(row);
    return call ? [call] : [];
  });

  if (recentCalls.length === 0) {
    return { ok: true, data: [] };
  }

  const uniqueTicketIds = [...new Set(recentCalls.map((call) => call.ticketId))];
  const { data: ticketsData, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, ticket_date, is_priority")
    .eq("ticket_date", businessDate)
    .in("id", uniqueTicketIds);

  if (ticketsError) {
    return { ok: false, error: getErrorMessage(ticketsError, "Nao foi possivel cruzar os dados de historico.") };
  }

  const ticketLookup = new Map<number, { prefix: string; ticketNumber: number; isPriority: boolean }>();
  for (const row of Array.isArray(ticketsData) ? ticketsData : []) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = row as TicketRow;
    const id = toNumber(candidate.id);
    const prefix = toRequiredString(candidate.prefix);
    const ticketNumber = toNumber(candidate.ticket_number);

    if (id === null || prefix === null || ticketNumber === null) {
      continue;
    }

    ticketLookup.set(id, {
      prefix,
      ticketNumber,
      isPriority: candidate.is_priority === true
    });
  }

  const hydratedCalls = recentCalls.flatMap((call) => {
    const ticket = ticketLookup.get(call.ticketId);
    if (!ticket) {
      return [];
    }

    return [
      {
        ...call,
        ticketPrefix: ticket.prefix,
        ticketNumber: ticket.ticketNumber,
        isPriority: ticket.isPriority
      }
    ];
  }).slice(0, 10);

  return { ok: true, data: hydratedCalls };
}

export async function loadDoctorSnapshot(queuePrefix: string, consultingRoom: string): Promise<AsyncResult<DoctorSnapshot>> {
  try {
    const [currentResult, waitingResult, recentCallsResult] = await Promise.all([
      fetchCurrentDoctorTicket(queuePrefix, consultingRoom),
      fetchWaitingDoctorQueue(queuePrefix),
      fetchRecentDoctorCalls(consultingRoom)
    ]);

    if (!currentResult.ok) {
      return { ok: false, error: currentResult.error };
    }
    if (!waitingResult.ok) {
      return { ok: false, error: waitingResult.error };
    }
    if (!recentCallsResult.ok) {
      return { ok: false, error: recentCallsResult.error };
    }

    return {
      ok: true,
      data: {
        currentTicket: currentResult.data,
        waitingTickets: waitingResult.data,
        recentCalls: recentCallsResult.data
      }
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Falha ao carregar dados da tela medica.") };
  }
}

export async function callNextDoctor(input: CallNextDoctorInput): Promise<AsyncResult<null>> {
  try {
    const supabase = getSupabaseBrowserClient();
    return await callNextWithPriority({
      supabase,
      queuePrefix: input.queuePrefix,
      waitingStage: "waiting_doctor",
      calledStage: "called_doctor",
      destinationType: "doctor",
      destinationLabel: input.consultingRoom,
      calledBy: input.calledBy,
      currentConsultingRoom: input.consultingRoom
    });
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao chamar a proxima senha medica.") };
  }
}

export async function finishDoctorTicket(input: FinishDoctorTicketInput): Promise<AsyncResult<null>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const finishedAt = new Date().toISOString();

    const { error } = await supabase
      .from("tickets")
      .update({
        current_stage: "finished",
        finished_at: finishedAt
      })
      .eq("id", input.ticketId)
      .eq("current_stage", "called_doctor");

    if (error) {
      return { ok: false, error: getErrorMessage(error, "Nao foi possivel finalizar o atendimento atual.") };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao finalizar o atendimento.") };
  }
}
