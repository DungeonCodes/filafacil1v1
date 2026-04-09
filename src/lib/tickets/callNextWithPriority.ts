import { getCurrentBusinessDate } from "./businessDate";
import { isPriorityColumnUnavailable, PRIORITY_DESC_ORDER } from "./prioritySupport";

type TicketStage = "waiting_attendant" | "called_attendant" | "waiting_doctor" | "called_doctor";
type DestinationType = "attendant" | "doctor";

type SupabaseLike = {
  from: (table: string) => any;
};

type CallNextWithPriorityInput = {
  supabase: SupabaseLike;
  queuePrefix: string;
  waitingStage: Extract<TicketStage, "waiting_attendant" | "waiting_doctor">;
  calledStage: Extract<TicketStage, "called_attendant" | "called_doctor">;
  destinationType: DestinationType;
  destinationLabel: string;
  calledBy: string;
  currentConsultingRoom: string | null;
};

type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };

type TicketLookupRow = {
  id?: unknown;
};

function toNumber(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return normalized;
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

export async function callNextWithPriority(input: CallNextWithPriorityInput): Promise<AsyncResult<null>> {
  try {
    const businessDate = getCurrentBusinessDate();
    const currentCalledQuery = input.supabase
      .from("tickets")
      .select("id")
      .eq("ticket_date", businessDate)
      .eq("current_stage", input.calledStage)
      .eq("prefix", input.queuePrefix);

    const currentCalledResult =
      input.calledStage === "called_doctor" && input.currentConsultingRoom
        ? await currentCalledQuery.eq("current_consulting_room", input.currentConsultingRoom).limit(1)
        : await currentCalledQuery.limit(1);

    if (currentCalledResult.error) {
      return { ok: false, error: getErrorMessage(currentCalledResult.error, "Nao foi possivel validar o atendimento em andamento.") };
    }

    if (Array.isArray(currentCalledResult.data) && currentCalledResult.data.length > 0) {
      return { ok: true, data: null };
    }

    async function fetchNextWaitingTicket(prioritizeByFlag: boolean) {
      const query = input.supabase
        .from("tickets")
        .select("id")
        .eq("ticket_date", businessDate)
        .eq("current_stage", input.waitingStage)
        .eq("prefix", input.queuePrefix);

      if (prioritizeByFlag) {
        query.order("is_priority", PRIORITY_DESC_ORDER);
      }

      return await query.order("created_at", { ascending: true }).limit(1);
    }

    let nextWaitingResult = await fetchNextWaitingTicket(true);
    if (nextWaitingResult.error && isPriorityColumnUnavailable(nextWaitingResult.error)) {
      nextWaitingResult = await fetchNextWaitingTicket(false);
    }

    if (nextWaitingResult.error) {
      return { ok: false, error: getErrorMessage(nextWaitingResult.error, "Nao foi possivel localizar a proxima senha elegivel.") };
    }

    const nextTicketRow = Array.isArray(nextWaitingResult.data) ? nextWaitingResult.data[0] : null;
    const ticketId = toNumber((nextTicketRow as TicketLookupRow | null)?.id);
    if (ticketId === null) {
      return { ok: true, data: null };
    }

    const calledAt = new Date().toISOString();
    const updateResult = await input.supabase
      .from("tickets")
      .update({
        current_stage: input.calledStage,
        called_at: calledAt,
        current_consulting_room: input.currentConsultingRoom
      })
      .eq("id", ticketId)
      .eq("current_stage", input.waitingStage)
      .select("id")
      .limit(1);

    if (updateResult.error) {
      return { ok: false, error: getErrorMessage(updateResult.error, "Nao foi possivel chamar a proxima senha.") };
    }

    if (!Array.isArray(updateResult.data) || updateResult.data.length === 0) {
      return { ok: true, data: null };
    }

    const { error: insertError } = await input.supabase.from("calls").insert({
      ticket_id: ticketId,
      stage: input.calledStage,
      destination_type: input.destinationType,
      destination_label: input.destinationLabel,
      called_by: input.calledBy,
      called_at: calledAt
    });

    if (insertError) {
      return { ok: false, error: getErrorMessage(insertError, "Nao foi possivel registrar a chamada.") };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Erro inesperado ao chamar a proxima senha.") };
  }
}
