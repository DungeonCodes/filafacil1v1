"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { loadAdminDashboardSnapshot } from "./api";
import { resetOperationalPanels } from "./operationsApi";
import type { AdminDashboardSnapshot } from "./types";
import { MainTopNav } from "@/components/MainTopNav";
import { UserManagementSection } from "./UserManagementSection";

const POLL_INTERVAL_MS = 15000;
const CHART_COLORS = ["#0f766e", "#0284c7", "#22c55e", "#f59e0b", "#ef4444", "#6366f1"];
const INITIAL_SNAPSHOT: AdminDashboardSnapshot = {
  kpis: {
    totalGeneratedToday: 0,
    totalFinishedToday: 0,
    totalWaiting: 0,
    averageWaitMinutes: null
  },
  queueDistribution: [],
  hourlyVolume: [],
  stageFlow: []
};

function formatKpiNumber(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return value.toLocaleString("pt-BR");
}

function formatStageLabel(stage: string): string {
  if (stage === "waiting_attendant") {
    return "Aguardando triagem";
  }
  if (stage === "called_attendant") {
    return "Em triagem";
  }
  if (stage === "waiting_doctor") {
    return "Aguardando medico";
  }
  if (stage === "called_doctor") {
    return "Em consulta";
  }
  if (stage === "finished") {
    return "Finalizado";
  }
  return stage;
}

type FeedbackState =
  | { kind: "error"; message: string }
  | null;

type OperationFeedbackState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export function AdminScreen() {
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackState>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetRunning, setIsResetRunning] = useState(false);

  useEffect(() => {
    let active = true;
    let requestRunning = false;

    async function refresh() {
      if (requestRunning) {
        return;
      }
      requestRunning = true;

      const result = await loadAdminDashboardSnapshot();
      if (!active) {
        requestRunning = false;
        return;
      }

      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error });
      } else {
        setSnapshot(result.data);
        setFeedback(null);
        setLastUpdatedAt(new Date().toISOString());
      }

      setIsLoading(false);
      requestRunning = false;
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reloadVersion]);

  const kpis = useMemo(() => snapshot.kpis, [snapshot.kpis]);
  const hasDataForCharts =
    snapshot.queueDistribution.length > 0 || snapshot.hourlyVolume.length > 0 || snapshot.stageFlow.length > 0;

  async function handleConfirmPanelReset() {
    setIsResetRunning(true);
    const result = await resetOperationalPanels();

    if (!result.ok) {
      setOperationFeedback({ kind: "error", message: result.error });
      setIsResetRunning(false);
      return;
    }

    const hasAnyReset = result.data.clearedOperationalTickets > 0 || result.data.clearedRecentCalls;

    setOperationFeedback({
      kind: "success",
      message: hasAnyReset
        ? "Paineis operacionais limpos com sucesso. Os tickets visiveis da operacao atual foram encerrados e as chamadas visuais do dia foram removidas."
        : "Nao havia estado operacional atual para limpar."
    });
    setIsResetConfirmOpen(false);
    setReloadVersion((value) => value + 1);
    setIsResetRunning(false);
  }

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.16),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_52%,_#e7eff8_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,_rgba(255,255,255,0.92)_0%,_rgba(255,255,255,0)_72%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-9rem] left-[-5rem] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-8">
        <MainTopNav activePath="/admin" showLogout />

        <section className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl md:p-10">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-400/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-2rem] left-[-1rem] h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />

          <header className="relative mb-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
                Admin
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                Dashboard
              </span>
            </div>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Dashboard Administrativo</h1>
            <p className="mt-2 text-lg font-semibold text-slate-700">
              Indicadores operacionais em tempo real para acompanhamento da unidade.
            </p>
            {lastUpdatedAt && (
              <p className="mt-1 text-sm font-medium text-slate-600">
                Ultima atualizacao:{" "}
                {new Date(lastUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </header>

          {feedback && (
            <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-base font-semibold text-rose-900 shadow-[0_18px_40px_-30px_rgba(225,29,72,0.26)]" role="alert">
              {feedback.message}
              <button
                type="button"
                className="ml-3 inline-flex min-h-10 items-center justify-center rounded-[1rem] border border-slate-900 bg-slate-900 px-4 text-sm font-black text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                onClick={() => setReloadVersion((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </div>
          )}

          <section className="mb-6 rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-xl font-black tracking-tight text-slate-950">Limpar painis de atendimento</h2>
                <p className="mt-2 text-base font-semibold text-slate-700">
                  Limpa ao mesmo tempo o estado exibido em <span className="font-black text-slate-950">/painel-chamada</span>,{" "}
                  <span className="font-black text-slate-950">/atendente</span> e <span className="font-black text-slate-950">/medico</span>.
                  A limpeza encerra os tickets operacionais visiveis do dia e remove as chamadas visuais atuais para deixar os tres painis vazios ao mesmo tempo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(true);
                  setOperationFeedback(null);
                }}
                disabled={isResetRunning}
                className="inline-flex min-h-12 items-center justify-center rounded-[1.2rem] border border-rose-600 bg-rose-600 px-5 text-base font-black text-white shadow-[0_18px_34px_-24px_rgba(225,29,72,0.45)] transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
              >
                Limpar painis de atendimento
              </button>
            </div>

            {isResetConfirmOpen && (
              <div className="mt-4 rounded-[1.5rem] border border-amber-300 bg-amber-50 p-4 shadow-[0_18px_40px_-34px_rgba(245,158,11,0.28)]">
                <p className="text-base font-black text-amber-950">Confirmacao obrigatoria</p>
                <p className="mt-2 text-sm font-semibold text-amber-900">
                  Esta limpeza zera as chamadas visuais atuais do <span className="font-black">/painel-chamada</span> e remove o atendimento em andamento do{" "}
                  <span className="font-black">/atendente</span> e do <span className="font-black">/medico</span>. Os tickets operacionais visiveis do dia serao encerrados e o historico visual do dia sera limpo para evitar estado antigo pendurado.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleConfirmPanelReset()}
                    disabled={isResetRunning}
                    className="inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-slate-900 bg-slate-900 px-4 text-sm font-black text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    {isResetRunning ? "Limpando..." : "Confirmar limpeza"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetConfirmOpen(false);
                      setOperationFeedback(null);
                    }}
                    disabled={isResetRunning}
                    className="inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-white/80 bg-white px-4 text-sm font-black text-slate-900 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.16)] transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {operationFeedback && (
              <div
                className={`mt-4 rounded-[1.5rem] border px-4 py-4 text-base font-semibold shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] ${
                  operationFeedback.kind === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
                role={operationFeedback.kind === "error" ? "alert" : "status"}
              >
                {operationFeedback.message}
              </div>
            )}
          </section>

          <section aria-label="Indicadores principais" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[1.7rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Senhas geradas hoje</p>
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{isLoading ? "--" : formatKpiNumber(kpis.totalGeneratedToday)}</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Atendimentos finalizados hoje</p>
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{isLoading ? "--" : formatKpiNumber(kpis.totalFinishedToday)}</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Senhas aguardando atendimento</p>
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{isLoading ? "--" : formatKpiNumber(kpis.totalWaiting)}</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Tempo medio de espera (min)</p>
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{isLoading ? "--" : formatKpiNumber(kpis.averageWaitMinutes)}</p>
            </article>
          </section>

          {isLoading ? (
            <p className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-5 text-base font-semibold text-slate-700">
              Carregando metricas e graficos...
            </p>
          ) : !hasDataForCharts ? (
            <p className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-5 text-base font-semibold text-slate-700">
              Ainda nao ha dados suficientes para exibicao dos graficos.
            </p>
          ) : (
            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
                <h2 className="text-xl font-black tracking-tight text-slate-900">Distribuicao por tipo de atendimento</h2>
                {snapshot.queueDistribution.length === 0 ? (
                  <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                    Sem dados de distribuicao para hoje.
                  </p>
                ) : (
                  <div className="mt-4 h-72 rounded-[1.35rem] bg-white px-2 py-2 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.18)]" aria-label="Grafico de distribuicao por tipo de atendimento">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={snapshot.queueDistribution} dataKey="total" nameKey="label" outerRadius={100} label>
                          {snapshot.queueDistribution.map((entry, index) => (
                            <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>

              <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md">
                <h2 className="text-xl font-black tracking-tight text-slate-900">Volume por faixa de horario</h2>
                {snapshot.hourlyVolume.length === 0 ? (
                  <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                    Sem volume de senhas registrado hoje.
                  </p>
                ) : (
                  <div className="mt-4 h-72 rounded-[1.35rem] bg-white px-2 py-2 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.18)]" aria-label="Grafico de volume por horario">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.hourlyVolume} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#0284c7" name="Senhas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>

              <article className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-md xl:col-span-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900">Evolucao do fluxo por status atual</h2>
                {snapshot.stageFlow.length === 0 ? (
                  <p className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700">
                    Sem dados de status para hoje.
                  </p>
                ) : (
                  <div className="mt-4 h-80 rounded-[1.35rem] bg-white px-2 py-2 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.18)]" aria-label="Grafico de evolucao por status">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={snapshot.stageFlow.map((item) => ({
                          stage: formatStageLabel(item.stage),
                          total: item.total
                        }))}
                        layout="vertical"
                        margin={{ top: 8, right: 16, bottom: 8, left: 90 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="stage" type="category" width={160} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#0f766e" name="Tickets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>
            </section>
          )}

          <UserManagementSection />
        </section>
      </div>
    </main>
  );
}
