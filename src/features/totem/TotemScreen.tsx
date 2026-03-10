"use client";

import { useEffect, useMemo, useState } from "react";
import { createNextTicket, loadQueues } from "./api";
import type { QueueOption } from "./types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { MainTopNav } from "@/components/MainTopNav";
import { HighContrastToggle } from "@/features/accessibility/HighContrastToggle";
import { useHighContrast } from "@/features/accessibility/HighContrastProvider";

type FeedbackState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export function TotemScreen() {
  const { isHighContrast } = useHighContrast();
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [issuingPrefix, setIssuingPrefix] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lastIssuedTicket, setLastIssuedTicket] = useState<string | null>(null);
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
    setLastIssuedTicket(formattedTicket);
    const stageStatus =
      result.data.currentStage && result.data.currentStage !== "waiting_attendant"
        ? ` Estagio retornado: ${result.data.currentStage}.`
        : "";

    setFeedback({
      kind: "success",
      message: `Senha ${formattedTicket} gerada com sucesso.${stageStatus} Aguarde a chamada no painel.`
    });
    setIssuingPrefix(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <MainTopNav activePath="/totem" />

      <div className="mb-4 flex justify-end">
        <HighContrastToggle />
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <section
        className={`rounded-3xl border-4 p-8 md:p-10 ${
          isHighContrast
            ? "border-white bg-black text-white shadow-none"
            : "border-sky-900 bg-white/95 shadow-xl backdrop-blur-sm"
        }`}
      >
        <h1 className={`text-center text-4xl font-black tracking-tight md:text-5xl ${isHighContrast ? "text-white" : "text-slate-950"}`}>
          Autoatendimento
        </h1>
        <p className={`mt-3 text-center text-lg ${isHighContrast ? "text-slate-100" : "text-slate-700"}`}>
          Escolha o tipo de atendimento para gerar sua senha digital.
        </p>

        {feedback?.kind === "success" && lastIssuedTicket && (
          <div
            role="status"
            className={`mt-8 rounded-3xl border-2 px-5 py-6 text-center ${
              isHighContrast
                ? "border-white bg-black text-white"
                : "border-sky-200 bg-gradient-to-br from-sky-600 via-blue-600 to-blue-700 text-white shadow-[0_18px_40px_-18px_rgba(2,132,199,0.9)]"
            }`}
          >
            <p className={`text-sm font-black uppercase tracking-[0.2em] ${isHighContrast ? "text-slate-200" : "text-sky-100"}`}>
              Senha gerada
            </p>
            <p
              className={`mt-3 font-black leading-none tracking-[0.08em] md:mt-4 ${
                isHighContrast
                  ? "text-6xl text-yellow-300 md:text-7xl"
                  : "text-6xl text-white md:text-7xl"
              }`}
            >
              {lastIssuedTicket}
            </p>
            <p className={`mt-4 text-base font-semibold ${isHighContrast ? "text-slate-100" : "text-sky-50"}`}>{feedback.message}</p>
          </div>
        )}

        {feedback?.kind === "error" && (
          <div
            role="alert"
            className={`mt-8 rounded-2xl border-2 px-5 py-4 text-lg font-semibold ${
              isHighContrast ? "border-white bg-black text-white" : "border-rose-700 bg-rose-50 text-rose-900"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {isLoadingQueues && (
          <p
            className={`mt-8 rounded-2xl border-2 px-5 py-6 text-center text-xl font-semibold ${
              isHighContrast ? "border-white bg-black text-white" : "border-slate-300 bg-slate-50 text-slate-700"
            }`}
          >
            Carregando opcoes de atendimento...
          </p>
        )}

        {!isLoadingQueues && queueError && (
          <div
            className={`mt-8 rounded-2xl border-2 px-5 py-6 text-center ${
              isHighContrast ? "border-white bg-black" : "border-amber-600 bg-amber-50"
            }`}
          >
            <p className={`text-lg font-semibold ${isHighContrast ? "text-white" : "text-amber-900"}`}>{queueError}</p>
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
                  className={`flex min-h-28 w-full items-center justify-center rounded-2xl border-4 px-5 py-4 text-center text-2xl font-black transition disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                    isHighContrast
                      ? "border-white bg-yellow-300 text-black hover:bg-yellow-200 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                      : "border-sky-900 bg-gradient-to-b from-sky-100 to-sky-200 text-slate-950 shadow-[0_10px_18px_-12px_rgba(2,132,199,0.7)] hover:from-sky-200 hover:to-sky-300 disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-500"
                  }`}
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
          <p
            className={`mt-8 rounded-2xl border-2 px-5 py-6 text-center text-xl font-semibold ${
              isHighContrast ? "border-white bg-black text-white" : "border-slate-300 bg-slate-50 text-slate-700"
            }`}
          >
            Nenhuma fila encontrada no banco.
          </p>
        )}
      </section>
    </main>
  );
}
