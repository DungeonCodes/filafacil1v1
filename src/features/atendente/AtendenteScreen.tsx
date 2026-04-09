"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQueues } from "@/features/totem/api";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { callNextAttendant, finishInitialAttendance, loadAttendantSnapshot, recallCurrentTicket } from "./api";
import type { AttendantSnapshot } from "./types";
import type { QueueOption } from "@/features/totem/types";
import { MainTopNav } from "@/components/MainTopNav";

const POLL_INTERVAL_MS = 3000;
const INITIAL_SNAPSHOT: AttendantSnapshot = {
  currentTicket: null,
  waitingTickets: []
};
const CALL_DESTINATIONS = ["Mesa 1", "Mesa 2", "Mesa 3"] as const;
const CALLED_BY_OPTIONS = ["Atendente", "Recepcao", "Triagem"] as const;

type FeedbackState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

function formatTime(value: string | null): string {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function AtendenteScreen() {
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [selectedQueuePrefix, setSelectedQueuePrefix] = useState("");
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [isLoadingPanel, setIsLoadingPanel] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<AttendantSnapshot>(INITIAL_SNAPSHOT);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [destinationLabel, setDestinationLabel] = useState<(typeof CALL_DESTINATIONS)[number]>("Mesa 1");
  const [calledBy, setCalledBy] = useState<(typeof CALLED_BY_OPTIONS)[number]>("Atendente");

  useEffect(() => {
    let ignore = false;

    async function fetchQueues() {
      setIsLoadingQueues(true);
      const result = await loadQueues();

      if (ignore) {
        return;
      }

      if (!result.ok) {
        setQueues([]);
        setFeedback({ kind: "error", message: result.error });
      } else {
        setQueues(result.data);
        setSelectedQueuePrefix((currentPrefix) => currentPrefix || result.data[0]?.prefix || "");
      }

      setIsLoadingQueues(false);
    }

    void fetchQueues();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedQueuePrefix) {
      setIsLoadingPanel(false);
      setSnapshot(INITIAL_SNAPSHOT);
      return;
    }

    let active = true;
    let requestRunning = false;

    async function refreshSnapshot() {
      if (requestRunning) {
        return;
      }
      requestRunning = true;

      const result = await loadAttendantSnapshot(selectedQueuePrefix);
      if (!active) {
        requestRunning = false;
        return;
      }

      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error });
      } else {
        setSnapshot(result.data);
      }

      setIsLoadingPanel(false);
      requestRunning = false;
    }

    void refreshSnapshot();
    const timer = window.setInterval(() => {
      void refreshSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedQueuePrefix, reloadVersion]);

  const currentTicketLabel = useMemo(() => {
    if (!snapshot.currentTicket) {
      return null;
    }
    return formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber, 3, snapshot.currentTicket.isPriority === true);
  }, [snapshot.currentTicket]);

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) {
    setIsActionRunning(true);
    const result = await action();

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error ?? "Operacao nao concluida." });
      setIsActionRunning(false);
      return;
    }

    setFeedback({ kind: "success", message: successMessage });
    setReloadVersion((value) => value + 1);
    setIsActionRunning(false);
  }

  async function handleCallNext() {
    if (!selectedQueuePrefix) {
      setFeedback({ kind: "error", message: "Selecione uma fila antes de chamar a proxima senha." });
      return;
    }

    setIsActionRunning(true);

    const previousCurrentTicketId = snapshot.currentTicket?.id ?? null;
    const previousWaitingTicketIds = new Set(snapshot.waitingTickets.map((ticket) => ticket.id));
    const callResult = await callNextAttendant({
      queuePrefix: selectedQueuePrefix,
      destinationLabel,
      calledBy
    });

    if (!callResult.ok) {
      setFeedback({ kind: "error", message: callResult.error ?? "Operacao nao concluida." });
      setIsActionRunning(false);
      return;
    }

    const snapshotResult = await loadAttendantSnapshot(selectedQueuePrefix);
    if (!snapshotResult.ok) {
      setFeedback({ kind: "error", message: "A chamada foi enviada, mas nao foi possivel confirmar a atualizacao do painel." });
      setIsActionRunning(false);
      return;
    }

    setSnapshot(snapshotResult.data);
    const currentTicket = snapshotResult.data.currentTicket;
    const didTransition =
      currentTicket !== null &&
      currentTicket.id !== previousCurrentTicketId &&
      (previousWaitingTicketIds.size === 0 || previousWaitingTicketIds.has(currentTicket.id) || previousCurrentTicketId === null);

    if (!didTransition) {
      setFeedback({
        kind: "error",
        message: "Nenhuma senha elegivel foi chamada nesta fila. Verifique se ha atendimento em andamento ou senhas disponiveis hoje."
      });
      setIsActionRunning(false);
      return;
    }

    setFeedback({ kind: "success", message: "Proxima senha chamada com sucesso." });
    setIsActionRunning(false);
  }

  async function handleRecall() {
    if (!snapshot.currentTicket) {
      setFeedback({ kind: "error", message: "Nao existe senha em atendimento para rechamar." });
      return;
    }

    const ticketLabel = formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber, 3, snapshot.currentTicket.isPriority === true);
    await runAction(
      async () =>
        recallCurrentTicket({
          ticketId: snapshot.currentTicket?.id ?? 0,
          destinationLabel,
          calledBy
        }),
      `Senha ${ticketLabel} rechamada com sucesso.`
    );
  }

  async function handleFinishAttendance() {
    if (!snapshot.currentTicket) {
      setFeedback({ kind: "error", message: "Nao existe senha em atendimento para finalizar." });
      return;
    }

    const ticketLabel = formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber, 3, snapshot.currentTicket.isPriority === true);
    await runAction(
      async () =>
        finishInitialAttendance({
          ticketId: snapshot.currentTicket?.id ?? 0,
          calledBy
        }),
      `Atendimento inicial da senha ${ticketLabel} finalizado com sucesso.`
    );
  }

  const actionDisabled = isActionRunning || isLoadingPanel || !selectedQueuePrefix;

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.16),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_52%,_#e7eff8_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,_rgba(255,255,255,0.92)_0%,_rgba(255,255,255,0)_72%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-9rem] left-[-5rem] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-8">
        <MainTopNav activePath="/atendente" showLogout />

        <section className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl md:p-10">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-400/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-2rem] left-[-1rem] h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />

          <header className="relative mb-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
                Atendente
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                Fila inicial
              </span>
            </div>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Painel do Atendente</h1>
            <p className="mt-2 text-lg font-semibold text-slate-700">
              Operacao da fila inicial com atualizacao automatica a cada 3 segundos.
            </p>
          </header>

          {feedback && (
            <div
              role={feedback.kind === "error" ? "alert" : "status"}
              className={`mb-6 rounded-[1.5rem] border px-4 py-4 text-base font-semibold shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] ${
                feedback.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <section className="grid gap-4 rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Fila</span>
              <select
                className="min-h-12 rounded-[1.15rem] border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                value={selectedQueuePrefix}
                onChange={(event) => setSelectedQueuePrefix(event.target.value)}
                disabled={isLoadingQueues || isActionRunning}
              >
                {queues.map((queue) => (
                  <option key={queue.id} value={queue.prefix}>
                    {queue.name} ({queue.prefix})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Destino de chamada</span>
              <select
                value={destinationLabel}
                onChange={(event) => setDestinationLabel(event.target.value as (typeof CALL_DESTINATIONS)[number])}
                disabled={isActionRunning}
                className="min-h-12 rounded-[1.15rem] border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                {CALL_DESTINATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Chamado por</span>
              <select
                value={calledBy}
                onChange={(event) => setCalledBy(event.target.value as (typeof CALLED_BY_OPTIONS)[number])}
                disabled={isActionRunning}
                className="min-h-12 rounded-[1.15rem] border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                {CALLED_BY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-[0_24px_72px_-42px_rgba(15,23,42,0.26)] ring-1 ring-white/75">
              <div className="pointer-events-none absolute right-[-2rem] top-[-2rem] h-28 w-28 rounded-full bg-amber-200/35 blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">
                    Em atendimento
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.2)]">
                    Fila inicial
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Senha em atendimento inicial</h2>

                {isLoadingPanel ? (
                  <p className="mt-5 text-xl font-bold text-slate-700">Carregando...</p>
                ) : currentTicketLabel ? (
                  <>
                    <p className="mt-5 text-6xl font-black tracking-[-0.08em] text-slate-950 md:text-7xl">{currentTicketLabel}</p>
                    <p className="mt-3 text-base font-semibold text-slate-700">
                      Chamada as {formatTime(snapshot.currentTicket?.calledAt ?? null)}
                    </p>
                  </>
                ) : (
                  <p className="mt-5 text-xl font-bold text-slate-700">Nenhuma senha em atendimento nesta fila.</p>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void handleCallNext()}
                    disabled={actionDisabled}
                    className="min-h-14 rounded-[1.2rem] border border-slate-900 bg-slate-900 px-4 text-base font-black text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    Chamar proximo
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRecall()}
                    disabled={actionDisabled || !snapshot.currentTicket}
                    className="min-h-14 rounded-[1.2rem] border border-white/80 bg-white px-4 text-base font-black text-slate-900 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.18)] transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    Rechamar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFinishAttendance()}
                    disabled={actionDisabled || !snapshot.currentTicket}
                    className="min-h-14 rounded-[1.2rem] border border-sky-200 bg-sky-100 px-4 text-base font-black text-slate-900 shadow-[0_16px_34px_-28px_rgba(14,165,233,0.24)] transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    Finalizar atendimento
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Fila de espera inicial</h2>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">
                  Em espera
                </span>
              </div>
              {isLoadingPanel ? (
                <p className="mt-4 text-base font-semibold text-slate-700">Carregando fila...</p>
              ) : snapshot.waitingTickets.length === 0 ? (
                <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                  Nenhuma senha aguardando triagem nesta fila.
                </p>
              ) : (
                <ul className="mt-4 space-y-3" aria-label="Fila de espera inicial">
                  {snapshot.waitingTickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-center justify-between rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.2)]">
                      <p className="text-2xl font-black tracking-tight text-slate-950">{formatTicket(ticket.prefix, ticket.ticketNumber, 3, ticket.isPriority === true)}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Entrada {formatTime(ticket.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
