"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQueues } from "@/features/totem/api";
import type { QueueOption } from "@/features/totem/types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { callNextDoctor, finishDoctorTicket, loadDoctorSnapshot } from "./api";
import type { DoctorSnapshot } from "./types";
import { MainTopNav } from "@/components/MainTopNav";

const POLL_INTERVAL_MS = 3000;
const INITIAL_SNAPSHOT: DoctorSnapshot = {
  currentTicket: null,
  waitingTickets: [],
  recentCalls: []
};
const CONSULTING_ROOMS = ["Consultorio 001", "Consultorio 002", "Consultorio 003"] as const;
const CALLED_BY_OPTIONS = ["Medico", "Plantonista", "Especialista"] as const;

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

export function MedicoScreen() {
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [selectedQueuePrefix, setSelectedQueuePrefix] = useState("");
  const [selectedConsultingRoom, setSelectedConsultingRoom] =
    useState<(typeof CONSULTING_ROOMS)[number]>("Consultorio 001");
  const [calledBy, setCalledBy] = useState<(typeof CALLED_BY_OPTIONS)[number]>("Medico");

  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [isLoadingPanel, setIsLoadingPanel] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<DoctorSnapshot>(INITIAL_SNAPSHOT);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

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
    if (!selectedQueuePrefix || !selectedConsultingRoom) {
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

      const result = await loadDoctorSnapshot(selectedQueuePrefix, selectedConsultingRoom);
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
  }, [selectedQueuePrefix, selectedConsultingRoom, reloadVersion]);

  const currentTicketLabel = useMemo(() => {
    if (!snapshot.currentTicket) {
      return null;
    }
    return formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber);
  }, [snapshot.currentTicket]);

  const nextWaitingTicket = useMemo(() => {
    const firstTicket = snapshot.waitingTickets[0];
    if (!firstTicket) {
      return null;
    }
    return formatTicket(firstTicket.prefix, firstTicket.ticketNumber);
  }, [snapshot.waitingTickets]);

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

  async function handleCallNextDoctor() {
    if (!selectedQueuePrefix || !selectedConsultingRoom) {
      setFeedback({ kind: "error", message: "Selecione fila e consultorio para chamar a proxima senha." });
      return;
    }

    await runAction(
      async () =>
        callNextDoctor({
          queuePrefix: selectedQueuePrefix,
          consultingRoom: selectedConsultingRoom,
          calledBy
        }),
      "Proxima senha medica chamada com sucesso."
    );
  }

  async function handleFinishTicket() {
    if (!snapshot.currentTicket) {
      setFeedback({ kind: "error", message: "Nao existe atendimento medico em andamento para finalizar." });
      return;
    }

    const ticketLabel = formatTicket(snapshot.currentTicket.prefix, snapshot.currentTicket.ticketNumber);
    await runAction(
      async () =>
        finishDoctorTicket({
          ticketId: snapshot.currentTicket?.id ?? 0
        }),
      `Atendimento da senha ${ticketLabel} finalizado com sucesso.`
    );
  }

  const actionDisabled = isActionRunning || isLoadingPanel || !selectedQueuePrefix || !selectedConsultingRoom;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 md:px-8">
      <MainTopNav activePath="/medico" showLogout />

      <section className="rounded-3xl border-4 border-slate-900 bg-white/95 p-6 shadow-xl md:p-10">
        <header className="mb-7">
          <h1 className="text-4xl font-black text-slate-950 md:text-5xl">Tela do Medico</h1>
          <p className="mt-2 text-lg font-semibold text-slate-700">
            Chamada medica e finalizacao de atendimento com atualizacao automatica.
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

        <section className="grid gap-4 rounded-2xl border-2 border-slate-700 bg-slate-50 p-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Fila/categoria</span>
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
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Consultorio</span>
            <select
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              value={selectedConsultingRoom}
              onChange={(event) => setSelectedConsultingRoom(event.target.value as (typeof CONSULTING_ROOMS)[number])}
              disabled={isActionRunning}
            >
              {CONSULTING_ROOMS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Chamado por</span>
            <select
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              value={calledBy}
              onChange={(event) => setCalledBy(event.target.value as (typeof CALLED_BY_OPTIONS)[number])}
              disabled={isActionRunning}
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
          <article className="rounded-3xl border-4 border-slate-900 bg-cyan-50 p-6">
            <h2 className="text-2xl font-black text-slate-950">Senha em atendimento medico</h2>

            {isLoadingPanel ? (
              <p className="mt-5 text-xl font-bold text-slate-700">Carregando...</p>
            ) : currentTicketLabel ? (
              <>
                <p className="mt-5 text-6xl font-black text-slate-950 md:text-7xl">{currentTicketLabel}</p>
                <p className="mt-3 text-base font-semibold text-slate-700">
                  Consultorio: {snapshot.currentTicket?.consultingRoom ?? selectedConsultingRoom}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-700">
                  Chamada as {formatTime(snapshot.currentTicket?.calledAt ?? null)}
                </p>
              </>
            ) : (
              <p className="mt-5 text-xl font-bold text-slate-700">Nenhuma senha em atendimento neste consultorio.</p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleCallNextDoctor()}
                disabled={actionDisabled}
                className="min-h-14 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Chamar proxima senha
              </button>
              <button
                type="button"
                onClick={() => void handleFinishTicket()}
                disabled={actionDisabled || !snapshot.currentTicket}
                className="min-h-14 rounded-xl border-2 border-slate-900 bg-white px-4 text-base font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Finalizar atendimento
              </button>
            </div>
          </article>

          <article className="rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
            <h2 className="text-2xl font-black text-slate-900">Fila medica em espera</h2>
            {isLoadingPanel ? (
              <p className="mt-4 text-base font-semibold text-slate-700">Carregando fila...</p>
            ) : snapshot.waitingTickets.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                Nenhuma senha aguardando medico nesta fila.
              </p>
            ) : (
              <>
                <p className="mt-4 text-base font-semibold text-slate-700">
                  Proxima senha prevista: <span className="font-black text-slate-950">{nextWaitingTicket}</span>
                </p>
                <ul className="mt-3 space-y-3" aria-label="Fila medica em espera">
                  {snapshot.waitingTickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3">
                      <p className="text-2xl font-black text-slate-950">{formatTicket(ticket.prefix, ticket.ticketNumber)}</p>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Entrada {formatTime(ticket.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        </section>

        <section className="mt-6 rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
          <h2 className="text-2xl font-black text-slate-900">Ultimas chamadas do consultorio</h2>
          {snapshot.recentCalls.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700">
              Ainda nao ha chamadas registradas para {selectedConsultingRoom}.
            </p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="Historico recente do consultorio">
              {snapshot.recentCalls.map((call) => (
                <li key={call.id} className="rounded-xl border border-slate-300 bg-white px-4 py-3">
                  <p className="text-2xl font-black text-slate-950">{formatTicket(call.ticketPrefix, call.ticketNumber)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {call.destinationLabel ?? selectedConsultingRoom} • Chamado as {formatTime(call.calledAt)}
                  </p>
                  {call.calledBy && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Por: {call.calledBy}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
