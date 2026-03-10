"use client";

import { useEffect, useMemo, useState } from "react";
import { createNextTicket, loadQueues } from "./api";
import type { QueueOption } from "./types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { MainTopNav } from "@/components/MainTopNav";

type FeedbackState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export function TotemScreen() {
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [issuingPrefix, setIssuingPrefix] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function run() {
      setIsLoadingQueues(true);
      setQueueError(null);

      const result = await loadQueues();
      if (ignore) {
        return;
      }

      if (!result.ok) {
        setQueues([]);
        setQueueError(result.error);
      } else {
        setQueues(result.data);
      }

      setIsLoadingQueues(false);
    }

    void run();

    return () => {
      ignore = true;
    };
  }, [reloadVersion]);

  const liveMessage = useMemo(() => {
    if (!feedback) {
      return "";
    }
    return feedback.message;
  }, [feedback]);

  async function handleIssueTicket(queue: QueueOption) {
    setIssuingPrefix(queue.prefix);
    setFeedback(null);

    const result = await createNextTicket(queue.prefix);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setIssuingPrefix(null);
      return;
    }

    const formattedTicket = formatTicket(result.data.prefix, result.data.ticketNumber);
    const stageStatus =
      result.data.currentStage && result.data.currentStage !== "waiting_attendant"
        ? ` Estagio retornado: ${result.data.currentStage}.`
        : "";

    setFeedback({
      kind: "success",
      message: `Senha gerada com sucesso: ${formattedTicket}.${stageStatus} Aguarde a chamada no painel.`
    });
    setIssuingPrefix(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <MainTopNav activePath="/totem" />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <section className="rounded-3xl border-4 border-slate-900 bg-white/90 p-8 shadow-xl backdrop-blur-sm md:p-10">
        <h1 className="text-center text-4xl font-black text-slate-950 md:text-5xl">Autoatendimento</h1>
        <p className="mt-4 text-center text-lg text-slate-700">
          Escolha o tipo de atendimento para gerar sua senha digital.
        </p>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mt-8 rounded-2xl border-2 px-5 py-4 text-lg font-semibold ${
              feedback.kind === "error"
                ? "border-rose-700 bg-rose-50 text-rose-900"
                : "border-emerald-700 bg-emerald-50 text-emerald-900"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {isLoadingQueues && (
          <p className="mt-8 rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 py-6 text-center text-xl font-semibold text-slate-700">
            Carregando opcoes de atendimento...
          </p>
        )}

        {!isLoadingQueues && queueError && (
          <div className="mt-8 rounded-2xl border-2 border-amber-600 bg-amber-50 px-5 py-6 text-center">
            <p className="text-lg font-semibold text-amber-900">{queueError}</p>
            <button
              type="button"
              className="mt-4 inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-900 px-6 text-lg font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              onClick={() => setReloadVersion((currentValue) => currentValue + 1)}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoadingQueues && !queueError && (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Filas disponiveis para emissao de senha">
            {queues.map((queue) => (
              <li key={queue.id}>
                <button
                  type="button"
                  className="flex min-h-28 w-full items-center justify-center rounded-2xl border-4 border-slate-900 bg-sky-100 px-5 py-4 text-center text-2xl font-black text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  aria-label={`Gerar senha para ${queue.name}`}
                  onClick={() => void handleIssueTicket(queue)}
                  disabled={Boolean(issuingPrefix)}
                >
                  {issuingPrefix === queue.prefix ? "Gerando..." : queue.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!isLoadingQueues && !queueError && queues.length === 0 && (
          <p className="mt-8 rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 py-6 text-center text-xl font-semibold text-slate-700">
            Nenhuma fila encontrada no banco.
          </p>
        )}
      </section>
    </main>
  );
}
