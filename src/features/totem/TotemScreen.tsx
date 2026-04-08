"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createNextTicket, loadQueues } from "./api";
import type { QueueOption } from "./types";
import { formatTicket } from "@/lib/tickets/formatTicket";
import { MainTopNav } from "@/components/MainTopNav";
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

type QueueVisualConfig = {
  eyebrow: string;
  description: string;
  icon: "general" | "pediatric" | "exams" | "default";
  accentGradient: string;
  iconTone: string;
};

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

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v5a4 4 0 0 0 8 0V4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h4M14 4h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v2a4 4 0 0 0 8 0v-1.5a2.5 2.5 0 1 0-2.5 2.5H20" />
      <circle cx="17.5" cy="12" r="1.5" />
    </svg>
  );
}

function ChildCareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="6.25" r="2.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 21v-4.5l-2.5-2.25a2.4 2.4 0 0 1-.7-2.32l.45-2.08A2.8 2.8 0 0 1 9.48 7.7h5.04a2.8 2.8 0 0 1 2.73 2.15l.45 2.08a2.4 2.4 0 0 1-.7 2.32l-2.5 2.25V21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5 12 15l2.5-2.5" />
    </svg>
  );
}

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 3h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3v5.2l-5.7 9.25A2.2 2.2 0 0 0 7.17 21h9.66a2.2 2.2 0 0 0 1.87-3.55L13 8.2V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.8 14h6.4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.7 17h4.6" />
    </svg>
  );
}

function ContrastIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a2.8 2.8 0 0 0-2.8 2.8v4.4a2.8 2.8 0 1 0 5.6 0V6.8A2.8 2.8 0 0 0 12 4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 10.75a5.5 5.5 0 0 0 11 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.25V20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.2 20h5.6" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.25v5" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StatusSparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.5 15 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
    </svg>
  );
}

function renderQueueIcon(icon: QueueVisualConfig["icon"], className?: string) {
  switch (icon) {
    case "general":
      return <StethoscopeIcon className={className} />;
    case "pediatric":
      return <ChildCareIcon className={className} />;
    case "exams":
      return <FlaskIcon className={className} />;
    default:
      return <StatusSparkIcon className={className} />;
  }
}

function getVoiceStepLabel(step: VoiceStep): string {
  switch (step) {
    case "listening_choice":
      return "Ouvindo opcao";
    case "confirming_choice":
      return "Confirmando opcao";
    case "generating":
      return "Gerando senha";
    case "completed":
      return "Concluido";
    case "starting":
      return "Iniciando";
    case "unsupported":
      return "Indisponivel";
    case "error":
      return "Erro";
    default:
      return "Desativado";
  }
}

function getQueueVisualConfig(queue: QueueOption): QueueVisualConfig {
  const normalizedName = normalizeVoiceInput(queue.name);
  const normalizedPrefix = queue.prefix.toUpperCase();

  if (normalizedPrefix === "CG" || normalizedName.includes("clinico") || normalizedName.includes("geral")) {
    return {
      eyebrow: "Clinica geral",
      description: "Consultas e triagem inicial.",
      icon: "general",
      accentGradient: "from-sky-500 via-blue-500 to-indigo-600",
      iconTone: "bg-sky-100 text-sky-700"
    };
  }

  if (normalizedPrefix === "PD" || normalizedName.includes("pediatria")) {
    return {
      eyebrow: "Atendimento infantil",
      description: "Cuidado infantil e juvenil.",
      icon: "pediatric",
      accentGradient: "from-cyan-400 via-sky-500 to-blue-600",
      iconTone: "bg-cyan-100 text-cyan-700"
    };
  }

  if (normalizedPrefix === "EX" || normalizedName.includes("exame")) {
    return {
      eyebrow: "Coleta e diagnostico",
      description: "Coletas, imagens e diagnostico.",
      icon: "exams",
      accentGradient: "from-indigo-500 via-blue-600 to-sky-700",
      iconTone: "bg-indigo-100 text-indigo-700"
    };
  }

  return {
    eyebrow: "Atendimento digital",
    description: "Emissao imediata com toque facilitado.",
    icon: "default",
    accentGradient: "from-sky-500 via-blue-500 to-indigo-600",
    iconTone: "bg-sky-100 text-sky-700"
  };
}

export function TotemScreen() {
  const { isHighContrast, toggleHighContrast } = useHighContrast();
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
  const [openQueueInfoId, setOpenQueueInfoId] = useState<number | null>(null);

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

  const issuedTicketParts = useMemo(() => {
    if (!lastIssuedTicket) {
      return null;
    }

    const [prefix, number] = lastIssuedTicket.split("-");
    if (!number) {
      return {
        prefix: lastIssuedTicket,
        number: null
      };
    }

    return {
      prefix,
      number
    };
  }, [lastIssuedTicket]);

  const voiceStepSummary = useMemo(() => getVoiceStepLabel(voiceStep), [voiceStep]);

  const voiceStatusBadge = useMemo(() => {
    if (isHighContrast) {
      if (voiceStep === "error") {
        return {
          label: "Erro",
          className: "bg-white text-black"
        };
      }

      return {
        label: voiceStep === "completed" ? "Concluido" : voiceStep === "unsupported" ? "Indisponivel" : "Acessivel",
        className: "bg-yellow-300 text-black"
      };
    }

    if (voiceStep === "listening_choice" || voiceStep === "confirming_choice") {
      return {
        label: "Ouvindo",
        className: "bg-sky-100 text-sky-700"
      };
    }

    if (voiceStep === "generating") {
      return {
        label: "Gerando",
        className: "bg-blue-100 text-blue-700"
      };
    }

    if (voiceStep === "completed") {
      return {
        label: "Concluido",
        className: "bg-emerald-100 text-emerald-700"
      };
    }

    if (voiceStep === "error" || voiceStep === "unsupported") {
      return {
        label: voiceStep === "error" ? "Erro" : "Indisponivel",
        className: "bg-rose-100 text-rose-700"
      };
    }

    return {
      label: isVoiceModeActive ? "Ativo" : "Pronto",
      className: "bg-slate-100 text-slate-700"
    };
  }, [isHighContrast, isVoiceModeActive, voiceStep]);

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
    setOpenQueueInfoId(null);
    await issueTicket(queue);
  }

  return (
    <main
      className={`relative overflow-hidden ${
        isHighContrast
          ? "bg-black"
          : "bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.20),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_52%,_#e7eff8_100%)]"
      }`}
    >
      {!isHighContrast && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,_rgba(255,255,255,0.92)_0%,_rgba(255,255,255,0)_72%)]" />
          <div className="pointer-events-none absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-9rem] left-[-5rem] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
        </>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <MainTopNav activePath="/totem" />

        <section
          className={`relative overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 sm:py-5 ${
            isHighContrast
              ? "border-2 border-white bg-black text-white shadow-none"
              : "border border-white/70 bg-white/88 text-slate-950 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl"
          }`}
        >
          {!isHighContrast && (
            <>
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-400/15 blur-2xl" />
              <div className="pointer-events-none absolute bottom-[-2rem] left-[-1rem] h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />
            </>
          )}

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${
                      isHighContrast ? "bg-white text-black" : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    Totem
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                      isHighContrast ? "border border-white text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Autoatendimento
                  </span>
                </div>

                <h1 className={`mt-3 text-3xl font-black tracking-tight sm:text-[2.55rem] ${isHighContrast ? "text-white" : "text-slate-950"}`}>
                  Escolha seu atendimento.
                </h1>
                <p className={`mt-2 text-sm font-medium sm:text-base ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                  Toque em uma opcao para gerar sua senha.
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                  isHighContrast
                    ? "border border-white text-white"
                    : "border border-white/80 bg-white text-slate-600 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.28)]"
                }`}
              >
                <StatusSparkIcon className="h-4 w-4" />
                {voiceStatusBadge.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={isVoiceModeActive ? handleDeactivateVoiceMode : handleActivateVoiceMode}
                disabled={isLoadingQueues || Boolean(issuingPrefix)}
                aria-pressed={isVoiceModeActive}
                aria-label={isVoiceModeActive ? "Desativar modo por voz guiado" : "Ativar modo por voz guiado"}
                className={`inline-flex min-h-[4rem] items-center justify-between gap-2 rounded-[1.35rem] border px-3.5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${
                  isHighContrast
                    ? isVoiceModeActive
                      ? "border-white bg-yellow-300 text-black hover:bg-yellow-200 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                      : "border-white bg-black text-white hover:bg-slate-900 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                    : isVoiceModeActive
                      ? "border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_20px_42px_-24px_rgba(16,185,129,0.7)] hover:from-emerald-600 hover:to-teal-600 disabled:border-slate-200 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      : "border-sky-200 bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] hover:border-sky-300 hover:bg-sky-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isHighContrast
                        ? isVoiceModeActive
                          ? "bg-black text-yellow-300"
                          : "border border-white text-white"
                        : isVoiceModeActive
                          ? "bg-white/15 text-white"
                          : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    <VoiceIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate">Voz</span>
                    <span
                      className={`block text-[11px] font-bold uppercase tracking-[0.18em] ${
                        isHighContrast
                          ? isVoiceModeActive
                            ? "text-black/80"
                            : "text-slate-300"
                          : isVoiceModeActive
                            ? "text-white/75"
                            : "text-slate-500"
                      }`}
                    >
                      Mic
                    </span>
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                    isHighContrast
                      ? isVoiceModeActive
                        ? "bg-black text-yellow-300"
                        : "border border-white text-white"
                      : isVoiceModeActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isVoiceModeActive ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleHighContrast}
                aria-pressed={isHighContrast}
                aria-label={isHighContrast ? "Desativar modo de alto contraste" : "Ativar modo de alto contraste"}
                className={`inline-flex min-h-[4rem] items-center justify-between gap-2 rounded-[1.35rem] border px-3.5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                  isHighContrast
                    ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
                    : "border-amber-200 bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] hover:border-amber-300 hover:bg-amber-50/80"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isHighContrast ? "bg-black text-yellow-300" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <ContrastIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate">Contraste</span>
                    <span className={`block text-[11px] font-bold uppercase tracking-[0.18em] ${isHighContrast ? "text-black/80" : "text-slate-500"}`}>
                      Tela
                    </span>
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                    isHighContrast ? "bg-black text-yellow-300" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isHighContrast ? "On" : "Off"}
                </span>
              </button>
            </div>

            {(selectedVoiceQueue || lastHeardCommand || voiceStep !== "idle") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                    isHighContrast ? "border border-white text-white" : voiceStatusBadge.className
                  }`}
                >
                  <VoiceIcon className="h-4 w-4" />
                  {voiceStepSummary}
                </span>

                {selectedVoiceQueue && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      isHighContrast ? "border border-white text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Opcao: {selectedVoiceQueue.name}
                  </span>
                )}

                {lastHeardCommand && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      isHighContrast ? "border border-white text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Comando: &quot;{lastHeardCommand}&quot;
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </div>

        {feedback?.kind === "success" && lastIssuedTicket && (
          <section
            role="status"
            className={`relative mt-6 overflow-hidden rounded-[2.25rem] ${
              isHighContrast
                ? "border-2 border-white bg-black text-white shadow-none"
                : "bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-[0_30px_80px_-34px_rgba(37,99,235,0.55)]"
            }`}
          >
            {!isHighContrast && (
              <>
                <div className="pointer-events-none absolute inset-y-0 right-[-3rem] w-48 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute bottom-[-4rem] left-[-4rem] h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
              </>
            )}

            <div className="relative grid gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${
                      isHighContrast ? "bg-yellow-300 text-black" : "bg-white/15 text-sky-50"
                    }`}
                  >
                    Senha gerada
                  </span>
                  {issuedTicketParts?.prefix && (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${
                        isHighContrast ? "border border-white text-white" : "bg-white/10 text-sky-50"
                      }`}
                    >
                      Prefixo {issuedTicketParts.prefix}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Sua senha esta pronta.</h2>
                <p className={`mt-3 max-w-md text-base leading-7 ${isHighContrast ? "text-slate-100" : "text-blue-50"}`}>
                  A confirmacao fica em destaque para leitura rapida. Guarde o numero e acompanhe a chamada no painel.
                </p>
              </div>

              <div
                className={`rounded-[1.9rem] px-5 py-6 text-center sm:px-7 sm:py-8 ${
                  isHighContrast ? "border-2 border-white bg-black text-white" : "bg-white/12 backdrop-blur-md"
                }`}
              >
                <p className={`text-sm font-black uppercase tracking-[0.22em] ${isHighContrast ? "text-yellow-300" : "text-sky-100"}`}>
                  Guarde esta senha
                </p>
                <p className="mt-5 text-center font-black leading-none tracking-[-0.08em] text-[clamp(3.8rem,18vw,7.2rem)]">
                  {issuedTicketParts?.number ? (
                    <>
                      <span className="inline-block">{issuedTicketParts.prefix}</span>
                      <span className="mx-2 inline-block opacity-70">-</span>
                      <span className="inline-block">{issuedTicketParts.number}</span>
                    </>
                  ) : (
                    lastIssuedTicket
                  )}
                </p>
                <p className={`mt-5 text-base font-semibold leading-7 ${isHighContrast ? "text-slate-100" : "text-blue-50"}`}>
                  {feedback.message}
                </p>
              </div>
            </div>
          </section>
        )}

        {feedback?.kind === "error" && (
          <section
            role="alert"
            className={`mt-6 rounded-[2rem] px-5 py-5 sm:px-6 ${
              isHighContrast
                ? "border-2 border-white bg-black text-white shadow-none"
                : "border border-rose-200 bg-rose-50 text-rose-900 shadow-[0_20px_55px_-38px_rgba(225,29,72,0.4)]"
            }`}
          >
            <p className={`text-sm font-black uppercase tracking-[0.22em] ${isHighContrast ? "text-yellow-300" : "text-rose-700"}`}>
              Nao foi possivel concluir
            </p>
            <p className="mt-3 text-lg font-semibold">{feedback.message}</p>
          </section>
        )}

        <section className="mt-4">
          {isLoadingQueues && (
            <p
              className={`rounded-[2rem] px-5 py-8 text-center text-xl font-semibold ${
                isHighContrast
                  ? "border-2 border-white bg-black text-white shadow-none"
                  : "border border-white/70 bg-white/86 text-slate-700 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)]"
              }`}
            >
              Carregando opcoes de atendimento...
            </p>
          )}

          {!isLoadingQueues && queueError && (
            <div
              className={`rounded-[2rem] px-5 py-6 text-center ${
                isHighContrast
                  ? "border-2 border-white bg-black text-white shadow-none"
                  : "border border-amber-200 bg-amber-50 text-amber-950 shadow-[0_20px_60px_-40px_rgba(245,158,11,0.25)]"
              }`}
            >
              <p className={`text-lg font-semibold ${isHighContrast ? "text-white" : "text-amber-900"}`}>{queueError}</p>
              <button
                type="button"
                className={`mt-5 inline-flex min-h-14 items-center justify-center rounded-[1.35rem] border px-6 text-lg font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                  isHighContrast
                    ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
                    : "border-sky-200 bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-[0_18px_45px_-24px_rgba(37,99,235,0.55)] hover:from-sky-700 hover:to-blue-700"
                }`}
                onClick={() => setReloadVersion((currentValue) => currentValue + 1)}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isLoadingQueues && !queueError && queues.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Filas disponiveis para emissao de senha">
              {queues.map((queue) => {
                const queueVisual = getQueueVisualConfig(queue);
                const isIssuingCurrentQueue = issuingPrefix === queue.prefix;
                const isInfoOpen = openQueueInfoId === queue.id;
                const queueAssistiveTextId = `queue-assistive-${queue.id}`;
                const queueInfoPanelId = `queue-info-panel-${queue.id}`;

                return (
                  <li key={queue.id} className="relative">
                    <button
                      type="button"
                      className={`group relative flex min-h-[12.75rem] w-full flex-col overflow-hidden rounded-[2rem] px-6 py-5 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none ${
                        isHighContrast
                          ? "border-2 border-white bg-black text-white hover:bg-slate-950 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                          : "border border-white/80 bg-gradient-to-b from-white via-white to-sky-50/90 text-slate-950 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.22)] hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_26px_80px_-38px_rgba(37,99,235,0.24)] disabled:border-slate-200 disabled:from-slate-100 disabled:to-slate-200 disabled:text-slate-500"
                      }`}
                      aria-label={`Gerar senha para ${queue.name}`}
                      aria-describedby={queueAssistiveTextId}
                      onClick={() => void handleIssueTicket(queue)}
                      disabled={Boolean(issuingPrefix)}
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-1.5 ${
                          isHighContrast ? "bg-yellow-300" : `bg-gradient-to-r ${queueVisual.accentGradient}`
                        }`}
                      />

                      {!isHighContrast && (
                        <div
                          className={`pointer-events-none absolute inset-x-10 top-6 h-20 rounded-full bg-gradient-to-r ${queueVisual.accentGradient} opacity-10 blur-3xl`}
                        />
                      )}

                      <div className="relative flex h-full flex-col items-center">
                        <div
                          className={`flex h-20 w-20 items-center justify-center rounded-[1.7rem] border shadow-[0_18px_42px_-28px_rgba(37,99,235,0.4)] ${
                            isHighContrast
                              ? "border-white bg-yellow-300 text-black shadow-none"
                              : `${queueVisual.iconTone} border-white/70`
                          }`}
                        >
                          {renderQueueIcon(queueVisual.icon, "h-10 w-10")}
                        </div>

                        <div className="mt-5">
                          <p
                            className={`text-[11px] font-black uppercase tracking-[0.24em] ${
                              isHighContrast ? "text-yellow-300" : "text-sky-700"
                            }`}
                          >
                            {queueVisual.eyebrow}
                          </p>
                          <h3
                            className={`mt-2 text-[1.95rem] font-black leading-[1.05] tracking-tight ${
                              isHighContrast ? "text-white" : "text-slate-950"
                            }`}
                          >
                            {queue.name}
                          </h3>
                        </div>

                        <div className="mt-auto pt-5">
                          <div
                            className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-black ${
                              isHighContrast
                                ? "border border-white text-white"
                                : isIssuingCurrentQueue
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isIssuingCurrentQueue ? "Gerando senha..." : "Toque para emitir senha"}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      aria-label={`${isInfoOpen ? "Ocultar" : "Mostrar"} informacoes sobre ${queue.name}`}
                      aria-expanded={isInfoOpen}
                      aria-controls={queueInfoPanelId}
                      disabled={Boolean(issuingPrefix)}
                      onClick={() => setOpenQueueInfoId((currentId) => (currentId === queue.id ? null : queue.id))}
                      className={`absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${
                        isHighContrast
                          ? "border-white bg-black text-white hover:bg-slate-950 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                          : isInfoOpen
                            ? "border-sky-200 bg-sky-100 text-sky-700 shadow-[0_12px_28px_-24px_rgba(2,132,199,0.45)]"
                            : "border-white/80 bg-white/90 text-slate-500 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.28)] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                      }`}
                    >
                      <InfoIcon className="h-4 w-4" />
                    </button>

                    <span id={queueAssistiveTextId} className="sr-only">
                      {`${queue.name}. ${queueVisual.eyebrow}. Toque no card para gerar sua senha. Use o botao de informacoes para ler detalhes adicionais.`}
                    </span>

                    {isInfoOpen && (
                      <div
                        id={queueInfoPanelId}
                        className={`mt-2 rounded-[1.35rem] px-4 py-3 ${
                          isHighContrast
                            ? "border-2 border-white bg-black text-white"
                            : "border border-sky-100 bg-white/95 text-slate-700 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.22)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              isHighContrast ? "bg-yellow-300 text-black" : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            <InfoIcon className="h-4 w-4" />
                          </span>
                          <p className={`text-sm font-semibold leading-6 ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                            {queueVisual.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!isLoadingQueues && !queueError && queues.length === 0 && (
            <p
              className={`rounded-[2rem] px-5 py-8 text-center text-xl font-semibold ${
                isHighContrast
                  ? "border-2 border-white bg-black text-white shadow-none"
                  : "border border-white/70 bg-white/86 text-slate-700 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)]"
              }`}
            >
              Nenhuma fila encontrada no banco.
            </p>
          )}
        </section>

      </div>
    </main>
  );
}
