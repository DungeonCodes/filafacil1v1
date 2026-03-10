"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadPanelSnapshot } from "./api";
import type { NowCallingTicket, PanelSnapshot, RecentCallItem, WaitingTicketItem } from "./types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { MainTopNav } from "@/components/MainTopNav";

const POLL_INTERVAL_MS = 3000;

const INITIAL_SNAPSHOT: PanelSnapshot = {
  nowCalling: null,
  recentCalls: [],
  waitingTickets: []
};

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

function getStageLabel(stage: string): string {
  if (stage === "called_attendant") {
    return "Atendimento inicial";
  }
  if (stage === "called_doctor") {
    return "Consulta medica";
  }
  if (stage === "waiting_attendant") {
    return "Aguardando triagem";
  }
  if (stage === "waiting_doctor") {
    return "Aguardando medico";
  }
  return stage;
}

function getCallDestination(call: RecentCallItem): string {
  if (call.destinationLabel) {
    return call.destinationLabel;
  }
  if (call.destinationType === "doctor") {
    return "Consultorio";
  }
  if (call.destinationType === "attendant") {
    return "Atendimento inicial";
  }
  return getStageLabel(call.stage);
}

function getNowCallingAnnouncement(nowCalling: NowCallingTicket): string {
  const ticket = formatTicket(nowCalling.prefix, nowCalling.ticketNumber);
  const destination = nowCalling.consultingRoom ? ` para ${nowCalling.consultingRoom}` : "";
  return `Nova chamada: ${ticket}${destination}.`;
}

export function PainelChamadaScreen() {
  const [snapshot, setSnapshot] = useState<PanelSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const lastAnnouncedTicket = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let isRequestRunning = false;

    async function refreshPanel() {
      if (isRequestRunning) {
        return;
      }
      isRequestRunning = true;

      const result = await loadPanelSnapshot();
      if (!active) {
        isRequestRunning = false;
        return;
      }

      if (!result.ok) {
        setError(result.error);
      } else {
        setSnapshot(result.data);
        setError(null);
        setLastUpdatedAt(new Date().toISOString());
      }

      setIsLoading(false);
      isRequestRunning = false;
    }

    void refreshPanel();
    const timer = window.setInterval(() => {
      void refreshPanel();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reloadVersion]);

  useEffect(() => {
    if (!snapshot.nowCalling) {
      return;
    }

    const ticket = formatTicket(snapshot.nowCalling.prefix, snapshot.nowCalling.ticketNumber);
    if (ticket === lastAnnouncedTicket.current) {
      return;
    }

    lastAnnouncedTicket.current = ticket;
    setLiveMessage(getNowCallingAnnouncement(snapshot.nowCalling));
  }, [snapshot.nowCalling]);

  const nowCallingTicket = useMemo(() => {
    if (!snapshot.nowCalling) {
      return null;
    }
    return formatTicket(snapshot.nowCalling.prefix, snapshot.nowCalling.ticketNumber);
  }, [snapshot.nowCalling]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 md:px-8">
      <MainTopNav activePath="/painel-chamada" showLogout />

      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {liveMessage}
      </div>

      <section className="rounded-3xl border-4 border-slate-900 bg-white/95 p-6 shadow-xl md:p-10">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Painel de Chamada</h1>
          <p className="mt-3 text-lg font-semibold text-slate-700">Atualizacao automatica a cada 3 segundos.</p>
          {lastUpdatedAt && <p className="mt-1 text-sm font-medium text-slate-600">Ultima atualizacao: {formatTime(lastUpdatedAt)}</p>}
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border-2 border-rose-700 bg-rose-50 px-4 py-4 text-center">
            <p role="alert" className="text-lg font-semibold text-rose-900">
              {error}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-900 px-5 text-base font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              onClick={() => setReloadVersion((value) => value + 1)}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <section
          aria-label="Agora chamando"
          className="rounded-3xl border-4 border-slate-900 bg-gradient-to-br from-amber-100 via-amber-50 to-white px-6 py-7 text-center shadow-sm md:px-10 md:py-10"
        >
          <p className="text-lg font-black uppercase tracking-[0.15em] text-slate-700">Agora chamando</p>
          {isLoading ? (
            <p className="mt-5 text-3xl font-black text-slate-600 md:text-5xl">Carregando...</p>
          ) : nowCallingTicket ? (
            <>
              <p className="mt-5 text-6xl font-black text-slate-950 md:text-8xl">{nowCallingTicket}</p>
              <p className="mt-4 text-xl font-bold text-slate-800">{getStageLabel(snapshot.nowCalling?.stage ?? "")}</p>
              {snapshot.nowCalling?.consultingRoom && (
                <p className="mt-2 text-lg font-semibold text-slate-700">Destino: {snapshot.nowCalling.consultingRoom}</p>
              )}
              <p className="mt-2 text-base font-medium text-slate-600">
                Horario da chamada: {formatTime(snapshot.nowCalling?.calledAt ?? null)}
              </p>
            </>
          ) : (
            <p className="mt-5 text-2xl font-bold text-slate-700 md:text-4xl">Nenhuma senha em chamada no momento.</p>
          )}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
            <h2 className="text-2xl font-black text-slate-900">Ultimas chamadas</h2>
            {snapshot.recentCalls.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                Ainda nao ha chamadas registradas.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label="Lista de ultimas chamadas">
                {snapshot.recentCalls.map((call) => (
                  <li key={call.id} className="rounded-xl border border-slate-300 bg-white px-4 py-3">
                    <p className="text-2xl font-black text-slate-950">{formatTicket(call.ticketPrefix, call.ticketNumber)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {getStageLabel(call.stage)} • {getCallDestination(call)}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Chamado as {formatTime(call.calledAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
            <h2 className="text-2xl font-black text-slate-900">Proximas senhas em espera</h2>
            {snapshot.waitingTickets.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                Nao ha senhas aguardando no momento.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label="Lista de proximas senhas em espera">
                {snapshot.waitingTickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3">
                    <p className="text-2xl font-black text-slate-950">{formatTicket(ticket.prefix, ticket.ticketNumber)}</p>
                    <span className="rounded-full border border-slate-400 bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                      {getStageLabel(ticket.stage)}
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
