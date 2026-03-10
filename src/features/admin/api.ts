import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AdminDashboardSnapshot, AsyncResult, HourlyVolumeItem, QueueDistributionItem, StageFlowItem } from "./types";

type TicketRow = {
  id?: unknown;
  queue_id?: unknown;
  prefix?: unknown;
  current_stage?: unknown;
  created_at?: unknown;
  called_at?: unknown;
};

type QueueRow = {
  id?: unknown;
  name?: unknown;
  prefix?: unknown;
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function getDayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function buildQueueDistribution(ticketsToday: TicketRow[], queueNameById: Map<number, string>): QueueDistributionItem[] {
  const totalsByQueue = new Map<string, number>();

  for (const ticket of ticketsToday) {
    const queueId = toNumber(ticket.queue_id);
    const prefix = toRequiredString(ticket.prefix);
    const queueName = queueId !== null ? queueNameById.get(queueId) : null;
    const label = queueName ?? prefix ?? "Nao identificado";
    totalsByQueue.set(label, (totalsByQueue.get(label) ?? 0) + 1);
  }

  return [...totalsByQueue.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total);
}

function buildHourlyVolume(ticketsToday: TicketRow[]): HourlyVolumeItem[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: 0
  }));

  for (const ticket of ticketsToday) {
    const createdAt = toRequiredString(ticket.created_at);
    if (!createdAt) {
      continue;
    }

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    buckets[date.getHours()].total += 1;
  }

  return buckets.filter((bucket) => bucket.total > 0).map((bucket) => ({
    hour: `${String(bucket.hour).padStart(2, "0")}h`,
    total: bucket.total
  }));
}

function buildStageFlow(ticketsToday: TicketRow[]): StageFlowItem[] {
  const totalsByStage = new Map<string, number>();

  for (const ticket of ticketsToday) {
    const stage = toRequiredString(ticket.current_stage) ?? "unknown";
    totalsByStage.set(stage, (totalsByStage.get(stage) ?? 0) + 1);
  }

  return [...totalsByStage.entries()]
    .map(([stage, total]) => ({ stage, total }))
    .sort((left, right) => right.total - left.total);
}

function calculateAverageWaitMinutes(ticketsToday: TicketRow[]): number | null {
  const waitTimesInMinutes: number[] = [];

  for (const ticket of ticketsToday) {
    const createdAt = toRequiredString(ticket.created_at);
    const calledAt = toRequiredString(ticket.called_at);

    if (!createdAt || !calledAt) {
      continue;
    }

    const createdDate = new Date(createdAt);
    const calledDate = new Date(calledAt);

    if (Number.isNaN(createdDate.getTime()) || Number.isNaN(calledDate.getTime())) {
      continue;
    }

    const diffMs = calledDate.getTime() - createdDate.getTime();
    if (diffMs < 0) {
      continue;
    }

    waitTimesInMinutes.push(diffMs / 60000);
  }

  if (waitTimesInMinutes.length === 0) {
    return null;
  }

  const total = waitTimesInMinutes.reduce((sum, value) => sum + value, 0);
  return Number((total / waitTimesInMinutes.length).toFixed(1));
}

export async function loadAdminDashboardSnapshot(): Promise<AsyncResult<AdminDashboardSnapshot>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { startIso, endIso } = getDayRange();

    const [ticketsTodayResult, queuesResult, waitingCountResult, finishedCountResult] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, queue_id, prefix, current_stage, created_at, called_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      supabase.from("queues").select("id, name, prefix"),
      supabase.from("tickets").select("id", { count: "exact", head: true }).in("current_stage", ["waiting_attendant", "waiting_doctor"]),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("current_stage", "finished")
        .gte("finished_at", startIso)
        .lt("finished_at", endIso)
    ]);

    if (ticketsTodayResult.error) {
      return { ok: false, error: getErrorMessage(ticketsTodayResult.error, "Nao foi possivel carregar tickets de hoje.") };
    }
    if (queuesResult.error) {
      return { ok: false, error: getErrorMessage(queuesResult.error, "Nao foi possivel carregar filas.") };
    }
    if (waitingCountResult.error) {
      return { ok: false, error: getErrorMessage(waitingCountResult.error, "Nao foi possivel carregar total em espera.") };
    }
    if (finishedCountResult.error) {
      return { ok: false, error: getErrorMessage(finishedCountResult.error, "Nao foi possivel carregar total finalizado.") };
    }

    const ticketsToday = (Array.isArray(ticketsTodayResult.data) ? ticketsTodayResult.data : []) as TicketRow[];
    const queues = (Array.isArray(queuesResult.data) ? queuesResult.data : []) as QueueRow[];
    const queueNameById = new Map<number, string>();

    for (const queue of queues) {
      const id = toNumber(queue.id);
      if (id === null) {
        continue;
      }
      const name = toRequiredString(queue.name) ?? toRequiredString(queue.prefix) ?? `Fila ${id}`;
      queueNameById.set(id, name);
    }

    const queueDistribution = buildQueueDistribution(ticketsToday, queueNameById);
    const hourlyVolume = buildHourlyVolume(ticketsToday);
    const stageFlow = buildStageFlow(ticketsToday);
    const averageWaitMinutes = calculateAverageWaitMinutes(ticketsToday);

    return {
      ok: true,
      data: {
        kpis: {
          totalGeneratedToday: ticketsToday.length,
          totalFinishedToday: finishedCountResult.count ?? 0,
          totalWaiting: waitingCountResult.count ?? 0,
          averageWaitMinutes
        },
        queueDistribution,
        hourlyVolume,
        stageFlow
      }
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Falha ao carregar o dashboard administrativo.") };
  }
}
