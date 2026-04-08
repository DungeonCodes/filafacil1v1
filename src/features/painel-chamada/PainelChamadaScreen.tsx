"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadPanelSnapshot } from "./api";
import type { NowCallingTicket, PanelSnapshot, RecentCallItem } from "./types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { MainTopNav } from "@/components/MainTopNav";

const POLL_INTERVAL_MS = 3000;
const AUDIO_ENABLED_STORAGE_KEY = "filafacil:painel-audio-enabled";

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

function getNowCallingDestination(snapshot: PanelSnapshot): string {
  const nowCalling = snapshot.nowCalling;
  if (!nowCalling) {
    return "";
  }

  const recentCallMatch = snapshot.recentCalls.find((call) => call.ticketId === nowCalling.id);
  if (recentCallMatch?.destinationLabel) {
    return recentCallMatch.destinationLabel;
  }

  if (nowCalling.consultingRoom) {
    return nowCalling.consultingRoom;
  }

  if (nowCalling.stage === "called_attendant") {
    return "Atendimento inicial";
  }

  if (nowCalling.stage === "called_doctor") {
    return "Consultorio";
  }

  return "";
}

function buildSpeechTicket(ticketLabel: string): string {
  return ticketLabel.replace(/-/g, " ").split("").join(" ");
}

function buildSpokenAnnouncement(snapshot: PanelSnapshot): string | null {
  if (!snapshot.nowCalling) {
    return null;
  }

  const ticketLabel = formatTicket(snapshot.nowCalling.prefix, snapshot.nowCalling.ticketNumber);
  const destination = getNowCallingDestination(snapshot);
  const speechTicket = buildSpeechTicket(ticketLabel);

  if (!destination) {
    return `Senha ${speechTicket}.`;
  }

  return `Senha ${speechTicket}, dirigir-se a ${destination}.`;
}

export function PainelChamadaScreen() {
  const [snapshot, setSnapshot] = useState<PanelSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [lastSpokenAnnouncement, setLastSpokenAnnouncement] = useState<string | null>(null);
  const lastAnnouncementKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const speechSupported = "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
    setIsSpeechSupported(speechSupported);

    try {
      const storedPreference = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY);
      if (storedPreference === "disabled") {
        setIsAudioEnabled(false);
      }
      if (storedPreference === "enabled") {
        setIsAudioEnabled(true);
      }
    } catch {
      // Ignore storage errors and keep default preference.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, isAudioEnabled ? "enabled" : "disabled");
    } catch {
      // Ignore storage errors; panel keeps running without persistence.
    }
  }, [isAudioEnabled]);

  function speakAnnouncement(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = window.speechSynthesis.getVoices().find((candidateVoice) => candidateVoice.lang.toLowerCase().startsWith("pt"));
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

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
    const destination = getNowCallingDestination(snapshot);
    const announcementKey = `${snapshot.nowCalling.id}:${snapshot.nowCalling.calledAt ?? "na"}:${destination}`;

    if (announcementKey === lastAnnouncementKeyRef.current) {
      return;
    }

    lastAnnouncementKeyRef.current = announcementKey;
    setLiveMessage(getNowCallingAnnouncement(snapshot.nowCalling));

    const spokenMessage = buildSpokenAnnouncement(snapshot);
    if (!spokenMessage) {
      return;
    }

    setLastSpokenAnnouncement(spokenMessage);
    if (isAudioEnabled && isSpeechSupported) {
      speakAnnouncement(spokenMessage);
    }
  }, [isAudioEnabled, isSpeechSupported, snapshot]);

  function handleRepeatLastAnnouncement() {
    if (!lastSpokenAnnouncement || !isSpeechSupported || !isAudioEnabled) {
      return;
    }

    speakAnnouncement(lastSpokenAnnouncement);
  }

  const nowCallingTicket = useMemo(() => {
    if (!snapshot.nowCalling) {
      return null;
    }
    return formatTicket(snapshot.nowCalling.prefix, snapshot.nowCalling.ticketNumber);
  }, [snapshot.nowCalling]);

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.16),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_52%,_#e7eff8_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,_rgba(255,255,255,0.92)_0%,_rgba(255,255,255,0)_72%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-9rem] left-[-5rem] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-8">
        <MainTopNav activePath="/painel-chamada" showLogout />

        <div className="sr-only" aria-live="assertive" aria-atomic="true">
          {liveMessage}
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl md:p-10">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-400/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-2rem] left-[-1rem] h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />

          <header className="relative mb-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
                Painel
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                Atualizacao automatica
              </span>
            </div>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Painel de Chamada</h1>
            <p className="mt-3 text-lg font-semibold text-slate-700">Atualizacao automatica a cada 3 segundos.</p>
            {lastUpdatedAt && <p className="mt-1 text-sm font-medium text-slate-600">Ultima atualizacao: {formatTime(lastUpdatedAt)}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                className={`inline-flex min-h-[3.45rem] items-center justify-center rounded-[1.25rem] border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                  isAudioEnabled
                    ? "border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_18px_40px_-28px_rgba(16,185,129,0.7)] hover:from-emerald-600 hover:to-teal-600"
                    : "border-white/80 bg-white text-slate-900 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.24)] hover:border-sky-200 hover:bg-sky-50"
                }`}
                aria-pressed={isAudioEnabled}
                onClick={() => setIsAudioEnabled((value) => !value)}
                disabled={!isSpeechSupported}
              >
                Audio: {isAudioEnabled ? "Ligado" : "Desligado"}
              </button>

              <button
                type="button"
                onClick={handleRepeatLastAnnouncement}
                disabled={!isAudioEnabled || !isSpeechSupported || !lastSpokenAnnouncement}
                className="inline-flex min-h-[3.45rem] items-center justify-center rounded-[1.25rem] border border-white/80 bg-white px-4 text-sm font-black text-slate-900 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.24)] transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Repetir ultima chamada
              </button>
            </div>

            {!isSpeechSupported && <p className="mt-2 text-sm font-semibold text-slate-600">Audio indisponivel neste navegador.</p>}
          </header>

          {error && (
            <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-center shadow-[0_20px_55px_-38px_rgba(225,29,72,0.35)]">
              <p role="alert" className="text-lg font-semibold text-rose-900">
                {error}
              </p>
              <button
                type="button"
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-slate-900 bg-slate-900 px-5 text-base font-black text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                onClick={() => setReloadVersion((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </div>
          )}

          <section
            aria-label="Agora chamando"
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 px-6 py-7 text-center text-white shadow-[0_30px_80px_-34px_rgba(37,99,235,0.42)] md:px-10 md:py-10"
          >
            <div className="pointer-events-none absolute inset-y-0 right-[-3rem] w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] left-[-4rem] h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />

            <div className="relative">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-100">Agora chamando</p>
              {isLoading ? (
                <p className="mt-5 text-3xl font-black text-white/85 md:text-5xl">Carregando...</p>
              ) : nowCallingTicket ? (
                <>
                  <p className="mt-5 text-6xl font-black tracking-[-0.08em] text-white md:text-8xl">{nowCallingTicket}</p>
                  <p className="mt-4 text-xl font-bold text-blue-50">{getStageLabel(snapshot.nowCalling?.stage ?? "")}</p>
                  {snapshot.nowCalling?.consultingRoom && (
                    <p className="mt-2 text-lg font-semibold text-blue-50">Destino: {snapshot.nowCalling.consultingRoom}</p>
                  )}
                  <p className="mt-2 text-base font-medium text-blue-100">
                    Horario da chamada: {formatTime(snapshot.nowCalling?.calledAt ?? null)}
                  </p>
                </>
              ) : (
                <p className="mt-5 text-2xl font-bold text-blue-50 md:text-4xl">Nenhuma senha em chamada no momento.</p>
              )}
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Ultimas chamadas</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Historico
                </span>
              </div>
              {snapshot.recentCalls.length === 0 ? (
                <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                  Ainda nao ha chamadas registradas.
                </p>
              ) : (
                <ul className="mt-4 space-y-3" aria-label="Lista de ultimas chamadas">
                  {snapshot.recentCalls.map((call) => (
                    <li key={call.id} className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.2)]">
                      <p className="text-2xl font-black tracking-tight text-slate-950">{formatTicket(call.ticketPrefix, call.ticketNumber)}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {getStageLabel(call.stage)} - {getCallDestination(call)}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Chamado as {formatTime(call.calledAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Proximas senhas em espera</h2>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">
                  Fila
                </span>
              </div>
              {snapshot.waitingTickets.length === 0 ? (
                <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                  Nao ha senhas aguardando no momento.
                </p>
              ) : (
                <ul className="mt-4 space-y-3" aria-label="Lista de proximas senhas em espera">
                  {snapshot.waitingTickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-center justify-between rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.2)]">
                      <p className="text-2xl font-black tracking-tight text-slate-950">{formatTicket(ticket.prefix, ticket.ticketNumber)}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                        {getStageLabel(ticket.stage)}
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
