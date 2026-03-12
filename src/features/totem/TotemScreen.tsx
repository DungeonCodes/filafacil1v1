"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type VoiceStep =
  | "idle"
  | "starting"
  | "listening_choice"
  | "confirming_choice"
  | "generating"
  | "completed"
  | "unsupported"
  | "error";

type VoiceListenPhase = "choice" | "confirmation";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike>;

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const DIGIT_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "um",
  "2": "dois",
  "3": "tres",
  "4": "quatro",
  "5": "cinco",
  "6": "seis",
  "7": "sete",
  "8": "oito",
  "9": "nove"
};

function normalizeVoiceInput(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function spellTicketForSpeech(ticketLabel: string): string {
  return ticketLabel
    .replace("-", " ")
    .split("")
    .map((char) => {
      if (char === " ") {
        return " ";
      }
      if (DIGIT_WORDS[char]) {
        return DIGIT_WORDS[char];
      }
      return char.toUpperCase();
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQueueByVoiceCommand(command: string, queues: QueueOption[]): QueueOption | null {
  const normalizedCommand = normalizeVoiceInput(command);

  if (normalizedCommand.includes("clinico") || normalizedCommand.includes("geral")) {
    return (
      queues.find((queue) => normalizeVoiceInput(queue.name).includes("clinico")) ??
      queues.find((queue) => queue.prefix.toUpperCase() === "CG") ??
      null
    );
  }

  if (normalizedCommand.includes("pediatria")) {
    return (
      queues.find((queue) => normalizeVoiceInput(queue.name).includes("pediatria")) ??
      queues.find((queue) => queue.prefix.toUpperCase() === "PD") ??
      null
    );
  }

  if (normalizedCommand.includes("exame")) {
    return (
      queues.find((queue) => normalizeVoiceInput(queue.name).includes("exame")) ??
      queues.find((queue) => queue.prefix.toUpperCase() === "EX") ??
      null
    );
  }

  return null;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return maybeWindow.SpeechRecognition ?? maybeWindow.webkitSpeechRecognition ?? null;
}

function isVoiceRecognitionAvailable(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

export function TotemScreen() {
  const { isHighContrast } = useHighContrast();
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [issuingPrefix, setIssuingPrefix] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lastIssuedTicket, setLastIssuedTicket] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [voiceStep, setVoiceStep] = useState<VoiceStep>("idle");
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("Modo por voz desativado.");
  const [selectedVoiceQueue, setSelectedVoiceQueue] = useState<QueueOption | null>(null);
  const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);

  const [voiceFeaturesReady, setVoiceFeaturesReady] = useState(false);
  const voiceModeActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const selectedVoiceQueueRef = useRef<QueueOption | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const supportsVoice = isVoiceRecognitionAvailable() && isSpeechSynthesisAvailable();
    setVoiceFeaturesReady(supportsVoice);
    if (!supportsVoice) {
      setVoiceStep("unsupported");
      setVoiceStatusMessage("Reconhecimento de voz indisponivel neste navegador.");
    }
  }, []);

  const liveMessage = useMemo(() => {
    if (!feedback) {
      return "";
    }
    return feedback.message;
  }, [feedback]);

  useEffect(() => {
    return () => {
      voiceModeActiveRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort?.();
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    voiceModeActiveRef.current = isVoiceModeActive;
  }, [isVoiceModeActive]);

  function speakText(text: string, onEnd?: () => void) {
    if (!isSpeechSynthesisAvailable()) {
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = window.speechSynthesis.getVoices().find((candidateVoice) => candidateVoice.lang.toLowerCase().startsWith("pt"));
    if (voice) {
      utterance.voice = voice;
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
  }

  function startListening(phase: VoiceListenPhase) {
    if (!voiceModeActiveRef.current) {
      return;
    }

    const RecognitionConstructor = getSpeechRecognitionConstructor();
    if (!RecognitionConstructor) {
      setVoiceStep("unsupported");
      setVoiceStatusMessage("Reconhecimento de voz indisponivel neste navegador.");
      setIsVoiceModeActive(false);
      voiceModeActiveRef.current = false;
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort?.();
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new RecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let hasResult = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      hasResult = true;
      setLastHeardCommand(transcript);
      const command = normalizeVoiceInput(transcript);

      if (command.includes("cancelar")) {
        setVoiceStep("idle");
        setVoiceStatusMessage("Modo por voz cancelado.");
        setIsVoiceModeActive(false);
        voiceModeActiveRef.current = false;
        setSelectedVoiceQueue(null);
        selectedVoiceQueueRef.current = null;
        speakText("Modo por voz cancelado.");
        return;
      }

      if (phase === "choice") {
        if (command.includes("repetir")) {
          const optionsText = queues.map((queue) => queue.name).join(", ");
          setVoiceStep("starting");
          setVoiceStatusMessage("Repetindo as opcoes...");
          speakText(
            `Opcoes disponiveis: ${optionsText}. Diga Clinico Geral, Pediatria ou Exames. Voce tambem pode dizer cancelar.`,
            () => {
              setVoiceStep("listening_choice");
              setVoiceStatusMessage("Ouvindo sua escolha...");
              startListening("choice");
            }
          );
          return;
        }

        const selectedQueue = getQueueByVoiceCommand(command, queues);
        if (!selectedQueue) {
          setVoiceStep("listening_choice");
          setVoiceStatusMessage("Comando nao reconhecido. Ouvindo novamente...");
          speakText("Nao entendi a opcao. Diga Clinico Geral, Pediatria, Exames, repetir ou cancelar.", () => {
            startListening("choice");
          });
          return;
        }

        setSelectedVoiceQueue(selectedQueue);
        selectedVoiceQueueRef.current = selectedQueue;
        setVoiceStep("confirming_choice");
        setVoiceStatusMessage(`Confirmando opcao: ${selectedQueue.name}`);
        speakText(
          `Voce escolheu ${selectedQueue.name}. Deseja confirmar? Diga confirmar ou sim para continuar. Diga nao para escolher novamente.`,
          () => {
            startListening("confirmation");
          }
        );
        return;
      }

      if (phase === "confirmation") {
        const queueToConfirm = selectedVoiceQueueRef.current;

        if (command.includes("repetir")) {
          if (!queueToConfirm) {
            setVoiceStep("listening_choice");
            setVoiceStatusMessage("Voltando para escolha...");
            speakText("Vamos voltar para escolha da opcao.", () => {
              startListening("choice");
            });
            return;
          }

          setVoiceStep("confirming_choice");
          setVoiceStatusMessage(`Confirmando opcao: ${queueToConfirm.name}`);
          speakText(
            `Voce escolheu ${queueToConfirm.name}. Deseja confirmar? Diga confirmar ou sim para continuar. Diga nao para escolher novamente.`,
            () => {
              startListening("confirmation");
            }
          );
          return;
        }

        if (command.includes("nao")) {
          setVoiceStep("listening_choice");
          setVoiceStatusMessage("Escolha cancelada. Ouvindo nova opcao...");
          setSelectedVoiceQueue(null);
          selectedVoiceQueueRef.current = null;
          speakText("Escolha cancelada. Diga Clinico Geral, Pediatria ou Exames.", () => {
            startListening("choice");
          });
          return;
        }

        if ((command.includes("confirmar") || command.includes("sim")) && queueToConfirm) {
          setVoiceStep("generating");
          setVoiceStatusMessage(`Gerando senha para ${queueToConfirm.name}...`);
          speakText(`Gerando senha para ${queueToConfirm.name}.`);
          void issueTicket(queueToConfirm, { speakResult: true });
          return;
        }

        setVoiceStep("confirming_choice");
        setVoiceStatusMessage("Comando nao reconhecido na confirmacao.");
        speakText("Nao entendi. Diga confirmar, sim, nao, repetir ou cancelar.", () => {
          startListening("confirmation");
        });
      }
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setVoiceStep("error");
      setVoiceStatusMessage("Nao foi possivel ouvir o comando. Tente novamente.");
      if (voiceModeActiveRef.current) {
        speakText("Nao foi possivel ouvir o comando. Tente novamente.");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!voiceModeActiveRef.current) {
        return;
      }
      if (hasResult) {
        return;
      }

      if (phase === "choice") {
        setVoiceStep("listening_choice");
        setVoiceStatusMessage("Sem resposta. Ouvindo novamente...");
        speakText("Nao ouvi sua resposta. Diga Clinico Geral, Pediatria, Exames, repetir ou cancelar.", () => {
          startListening("choice");
        });
        return;
      }

      if (phase === "confirmation") {
        setVoiceStep("confirming_choice");
        setVoiceStatusMessage("Sem resposta na confirmacao. Ouvindo novamente...");
        speakText("Nao ouvi sua confirmacao. Diga confirmar, sim, nao, repetir ou cancelar.", () => {
          startListening("confirmation");
        });
      }
    };

    try {
      recognition.start();
      if (phase === "choice") {
        setVoiceStep("listening_choice");
        setVoiceStatusMessage("Ouvindo sua escolha...");
      } else {
        setVoiceStep("confirming_choice");
        setVoiceStatusMessage("Ouvindo confirmacao...");
      }
    } catch {
      setVoiceStep("error");
      setVoiceStatusMessage("Nao foi possivel iniciar o reconhecimento de voz.");
    }
  }

  function handleActivateVoiceMode() {
    if (!voiceFeaturesReady) {
      setVoiceStep("unsupported");
      setVoiceStatusMessage("Reconhecimento de voz indisponivel neste navegador.");
      return;
    }

    if (queues.length === 0) {
      setVoiceStep("error");
      setVoiceStatusMessage("Nao ha opcoes de atendimento carregadas para iniciar o modo por voz.");
      return;
    }

    setIsVoiceModeActive(true);
    voiceModeActiveRef.current = true;
    setVoiceStep("starting");
    setSelectedVoiceQueue(null);
    selectedVoiceQueueRef.current = null;
    setLastHeardCommand(null);

    const optionsText = queues.map((queue) => queue.name).join(", ");
    setVoiceStatusMessage("Lendo opcoes de atendimento por voz...");
    speakText(
      `Bem vindo ao modo por voz. Opcoes disponiveis: ${optionsText}. Diga Clinico Geral, Pediatria ou Exames. Voce tambem pode dizer repetir ou cancelar.`,
      () => {
        startListening("choice");
      }
    );
  }

  function handleDeactivateVoiceMode() {
    setIsVoiceModeActive(false);
    voiceModeActiveRef.current = false;
    setVoiceStep("idle");
    setVoiceStatusMessage("Modo por voz desativado.");
    setSelectedVoiceQueue(null);
    selectedVoiceQueueRef.current = null;
    setLastHeardCommand(null);
    if (recognitionRef.current) {
      recognitionRef.current.abort?.();
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (isSpeechSynthesisAvailable()) {
      window.speechSynthesis.cancel();
    }
  }

  async function issueTicket(queue: QueueOption, options?: { speakResult?: boolean }) {
    setIssuingPrefix(queue.prefix);
    setFeedback(null);

    const result = await createNextTicket(queue.prefix);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setIssuingPrefix(null);
      if (options?.speakResult && voiceModeActiveRef.current) {
      setVoiceStep("error");
      setVoiceStatusMessage("Erro ao gerar senha no modo por voz.");
        speakText(`Nao foi possivel gerar a senha para ${queue.name}. Tente novamente ou cancele o modo por voz.`, () => {
          if (voiceModeActiveRef.current) {
            startListening("choice");
          }
        });
      }
      return { ok: false as const, error: result.error };
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

    if (options?.speakResult && voiceModeActiveRef.current) {
      setVoiceStep("completed");
      setVoiceStatusMessage(`Senha gerada: ${formattedTicket}`);
      const spelledTicket = spellTicketForSpeech(formattedTicket);
      speakText(`Senha ${spelledTicket} gerada com sucesso. Aguarde a chamada no painel.`);
      setIsVoiceModeActive(false);
      voiceModeActiveRef.current = false;
      setSelectedVoiceQueue(null);
      selectedVoiceQueueRef.current = null;
    }

    return { ok: true as const, formattedTicket };
  }

  async function handleIssueTicket(queue: QueueOption) {
    await issueTicket(queue);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <MainTopNav activePath="/totem" />

      <div className="mb-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={isVoiceModeActive ? handleDeactivateVoiceMode : handleActivateVoiceMode}
          disabled={isLoadingQueues || Boolean(issuingPrefix)}
          className={`inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 disabled:text-slate-500 ${
            isVoiceModeActive
              ? "border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700"
              : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
          }`}
          aria-pressed={isVoiceModeActive}
          aria-label={isVoiceModeActive ? "Desativar modo por voz guiado" : "Ativar modo por voz guiado"}
        >
          {isVoiceModeActive ? "Desativar modo por voz" : "Ativar modo por voz"}
        </button>
        <HighContrastToggle />
      </div>

      <div
        className={`mb-4 rounded-2xl border-2 px-4 py-3 text-sm font-semibold ${
          isHighContrast ? "border-white bg-black text-white" : "border-slate-300 bg-white/80 text-slate-800"
        }`}
        aria-live="polite"
      >
        <p>
          <span className="font-black">Modo por voz:</span>{" "}
          {voiceStep === "listening_choice"
            ? "Ouvindo opcao..."
            : voiceStep === "confirming_choice"
              ? "Confirmando opcao..."
              : voiceStep === "generating"
                ? "Gerando senha..."
                : voiceStep === "completed"
                  ? "Concluido."
                  : voiceStep === "starting"
                    ? "Iniciando..."
                    : voiceStep === "unsupported"
                      ? "Indisponivel."
                      : voiceStep === "error"
                        ? "Erro."
                        : "Desativado."}
        </p>
        <p className="mt-1">{voiceStatusMessage}</p>
        {selectedVoiceQueue && <p className="mt-1">Opcao atual: {selectedVoiceQueue.name}</p>}
        {lastHeardCommand && <p className="mt-1">Ultimo comando reconhecido: &quot;{lastHeardCommand}&quot;</p>}
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
