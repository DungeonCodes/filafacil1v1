"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQueues } from "@/features/totem/api";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { callNextAttendant, forwardTicketToDoctor, loadAttendantSnapshot, recallCurrentTicket } from "./api";
import type { AttendantSnapshot } from "./types";
import type { QueueOption } from "@/features/totem/types";
import { MainTopNav } from "@/components/MainTopNav";

const POLL_INTERVAL_MS = 3000;
const INITIAL_SNAPSHOT: AttendantSnapshot = {
  currentTicket: null,
  waitingTickets: []
};
const CALL_DESTINATIONS = ["Mesa 1", "Mesa 2", "Mesa 3"] as const;
const FORWARD_DESTINATIONS = ["Consultorio 001", "Consultorio 002", "Consultorio 003"] as const;
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
  const [forwardDestinationLabel, setForwardDestinationLabel] = useState<(typeof FORWARD_DESTINATIONS)[number]>(
    "Consultorio 001"
  );
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
    return formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber);
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

    await runAction(
      async () =>
        callNextAttendant({
          queuePrefix: selectedQueuePrefix,
          destinationLabel,
          calledBy
        }),
      "Proxima senha chamada com sucesso."
    );
  }

  async function handleRecall() {
    if (!snapshot.currentTicket) {
      setFeedback({ kind: "error", message: "Nao existe senha em atendimento para rechamar." });
      return;
    }

    const ticketLabel = formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber);
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

  async function handleForward() {
    if (!snapshot.currentTicket) {
      setFeedback({ kind: "error", message: "Nao existe senha em atendimento para encaminhar." });
      return;
    }

    const ticketLabel = formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber);
    await runAction(
      async () =>
        forwardTicketToDoctor({
          ticketId: snapshot.currentTicket?.id ?? 0,
          destinationLabel: forwardDestinationLabel,
          calledBy
        }),
      `Senha ${ticketLabel} encaminhada com sucesso para ${forwardDestinationLabel}.`
    );
  }

  const actionDisabled = isActionRunning || isLoadingPanel || !selectedQueuePrefix;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 md:px-8">
      <MainTopNav activePath="/atendente" />

      <section className="rounded-3xl border-4 border-slate-900 bg-white/95 p-6 shadow-xl md:p-10">
        <header className="mb-7">
          <h1 className="text-4xl font-black text-slate-950 md:text-5xl">Painel do Atendente</h1>
          <p className="mt-2 text-lg font-semibold text-slate-700">
            Operacao da fila inicial com atualizacao automatica a cada 3 segundos.
          </p>
        </header>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mb-6 rounded-2xl border-2 px-4 py-4 text-base font-semibold ${
              feedback.kind === "error"
                ? "border-rose-700 bg-rose-50 text-rose-900"
                : "border-emerald-700 bg-emerald-50 text-emerald-900"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="grid gap-4 rounded-2xl border-2 border-slate-700 bg-slate-50 p-4 md:grid-cols-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Fila</span>
            <select
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
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
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Destino de chamada</span>
            <select
              value={destinationLabel}
              onChange={(event) => setDestinationLabel(event.target.value as (typeof CALL_DESTINATIONS)[number])}
              disabled={isActionRunning}
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            >
              {CALL_DESTINATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Encaminhar para</span>
            <select
              value={forwardDestinationLabel}
              onChange={(event) =>
                setForwardDestinationLabel(event.target.value as (typeof FORWARD_DESTINATIONS)[number])
              }
              disabled={isActionRunning}
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            >
              {FORWARD_DESTINATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Chamado por</span>
            <select
              value={calledBy}
              onChange={(event) => setCalledBy(event.target.value as (typeof CALLED_BY_OPTIONS)[number])}
              disabled={isActionRunning}
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
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
          <article className="rounded-3xl border-4 border-slate-900 bg-amber-50 p-6">
            <h2 className="text-2xl font-black text-slate-950">Senha em atendimento inicial</h2>

            {isLoadingPanel ? (
              <p className="mt-5 text-xl font-bold text-slate-700">Carregando...</p>
            ) : currentTicketLabel ? (
              <>
                <p className="mt-5 text-6xl font-black text-slate-950 md:text-7xl">{currentTicketLabel}</p>
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
                className="min-h-14 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Chamar proximo
              </button>
              <button
                type="button"
                onClick={() => void handleRecall()}
                disabled={actionDisabled || !snapshot.currentTicket}
                className="min-h-14 rounded-xl border-2 border-slate-900 bg-white px-4 text-base font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Rechamar
              </button>
              <button
                type="button"
                onClick={() => void handleForward()}
                disabled={actionDisabled || !snapshot.currentTicket}
                className="min-h-14 rounded-xl border-2 border-slate-900 bg-sky-200 px-4 text-base font-black text-slate-900 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Encaminhar
              </button>
            </div>
          </article>

          <article className="rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
            <h2 className="text-2xl font-black text-slate-900">Fila de espera inicial</h2>
            {isLoadingPanel ? (
              <p className="mt-4 text-base font-semibold text-slate-700">Carregando fila...</p>
            ) : snapshot.waitingTickets.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                Nenhuma senha aguardando triagem nesta fila.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label="Fila de espera inicial">
                {snapshot.waitingTickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3">
                    <p className="text-2xl font-black text-slate-950">{formatTicket(ticket.prefix, ticket.ticketNumber)}</p>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Entrada {formatTime(ticket.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
