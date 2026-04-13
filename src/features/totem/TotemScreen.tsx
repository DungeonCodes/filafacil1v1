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

type ServiceMode = "normal" | "priority";

type VoiceStep =
  | "idle"
  | "starting"
  | "listening_choice"
  | "confirming_choice"
  | "generating"
  | "completed"
  | "unsupported"
  | "error";

type VoiceListenPhase = "service_mode" | "queue_choice" | "confirmation";

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

type TotemJourneyStep = {
  index: 1 | 2 | 3;
  label: string;
  title: string;
  description: string;
};

const TOTEM_TEA_MODE_STORAGE_KEY = "filafacil:totem-tea-mode";

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

function readStoredTeaModePreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(TOTEM_TEA_MODE_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

function persistTeaModePreference(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(TOTEM_TEA_MODE_STORAGE_KEY, value ? "enabled" : "disabled");
  } catch {
    // Ignore storage errors to avoid blocking the interface.
  }
}

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

function getServiceModeByVoiceCommand(command: string): ServiceMode | null {
  const normalizedCommand = normalizeVoiceInput(command);

  if (
    normalizedCommand.includes("prioritario") ||
    normalizedCommand.includes("prioridade") ||
    normalizedCommand.includes("preferencial")
  ) {
    return "priority";
  }

  if (normalizedCommand.includes("normal") || normalizedCommand.includes("comum")) {
    return "normal";
  }

  return null;
}

function getServiceModeLabel(mode: ServiceMode): string {
  return mode === "priority" ? "Atendimento prioritario" : "Atendimento normal";
}

function getServiceModeShortLabel(mode: ServiceMode): string {
  return mode === "priority" ? "Prioritario" : "Normal";
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

function FocusModeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.2C6.5 7.7 9 6.9 12 6.9s5.5.8 7.5 2.3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 14.8c2 1.5 4.5 2.3 7.5 2.3s5.5-.8 7.5-2.3" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

function TicketRequestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="5" y="4.5" width="14" height="15" rx="3.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.5h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15.5h4.5" />
    </svg>
  );
}

function PriorityCareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m18 4 .7 1.7L20.5 6.4l-1.8.7L18 8.8l-.7-1.7-1.8-.7 1.8-.7L18 4Z" />
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

function getTotemJourneyStep(hasIssuedTicket: boolean, selectedServiceMode: ServiceMode | null): TotemJourneyStep {
  if (hasIssuedTicket) {
    return {
      index: 3,
      label: "Passo 3",
      title: "Senha gerada",
      description: "Leia sua senha com calma e aguarde a chamada."
    };
  }

  if (selectedServiceMode) {
    return {
      index: 2,
      label: "Passo 2",
      title: "Escolha o servico",
      description: "Agora toque no servico desejado para emitir a senha."
    };
  }

  return {
    index: 1,
    label: "Passo 1",
    title: "Escolha o tipo",
    description: "Primeiro escolha entre atendimento normal e prioritario."
  };
}

export function TotemScreen() {
  const { isHighContrast, toggleHighContrast } = useHighContrast();
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isTeaModeActive, setIsTeaModeActive] = useState(false);
  const [selectedServiceMode, setSelectedServiceMode] = useState<ServiceMode | null>(null);
  const [issuingPrefix, setIssuingPrefix] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lastIssuedTicket, setLastIssuedTicket] = useState<string | null>(null);
  const [lastIssuedIsPriority, setLastIssuedIsPriority] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [voiceStep, setVoiceStep] = useState<VoiceStep>("idle");
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("Modo por voz desativado.");
  const [selectedVoiceQueue, setSelectedVoiceQueue] = useState<QueueOption | null>(null);
  const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);
  const [openQueueInfoId, setOpenQueueInfoId] = useState<number | null>(null);

  const [voiceFeaturesReady, setVoiceFeaturesReady] = useState(false);
  const voiceModeActiveRef = useRef(false);
  const selectedServiceModeRef = useRef<ServiceMode | null>(null);
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

  useEffect(() => {
    setIsTeaModeActive(readStoredTeaModePreference());
  }, []);

  useEffect(() => {
    persistTeaModePreference(isTeaModeActive);
  }, [isTeaModeActive]);

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

  const selectedServiceModeLabel = useMemo(
    () => (selectedServiceMode ? getServiceModeLabel(selectedServiceMode) : null),
    [selectedServiceMode]
  );

  const hasIssuedTicket = feedback?.kind === "success" && Boolean(lastIssuedTicket);

  const currentJourneyStep = useMemo(
    () => getTotemJourneyStep(hasIssuedTicket, selectedServiceMode),
    [hasIssuedTicket, selectedServiceMode]
  );

  const currentJourneyDescription = useMemo(() => {
    if (!isTeaModeActive) {
      return "Escolha o tipo e depois toque no servico.";
    }

    return currentJourneyStep.description;
  }, [currentJourneyStep.description, isTeaModeActive]);

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

  useEffect(() => {
    selectedServiceModeRef.current = selectedServiceMode;
  }, [selectedServiceMode]);

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

      if (phase === "service_mode") {
        if (command.includes("repetir")) {
          setVoiceStep("starting");
          setVoiceStatusMessage("Repetindo os tipos de atendimento...");
          speakText("Escolha atendimento normal ou atendimento prioritario. Voce tambem pode dizer cancelar.", () => {
            startListening("service_mode");
          });
          return;
        }

        const selectedServiceType = getServiceModeByVoiceCommand(command);
        if (!selectedServiceType) {
          setVoiceStep("listening_choice");
          setVoiceStatusMessage("Tipo de atendimento nao reconhecido. Ouvindo novamente...");
          speakText("Nao entendi. Diga atendimento normal, atendimento prioritario, repetir ou cancelar.", () => {
            startListening("service_mode");
          });
          return;
        }

        setSelectedServiceMode(selectedServiceType);
        selectedServiceModeRef.current = selectedServiceType;
        setSelectedVoiceQueue(null);
        selectedVoiceQueueRef.current = null;
        setVoiceStep("starting");
        setVoiceStatusMessage(`${getServiceModeLabel(selectedServiceType)} selecionado.`);
        speakText(`${getServiceModeLabel(selectedServiceType)} selecionado. Agora diga Clinico Geral, Pediatria ou Exames.`, () => {
          startListening("queue_choice");
        });
        return;
      }

      if (phase === "queue_choice") {
        if (command.includes("repetir")) {
          const optionsText = queues.map((queue) => queue.name).join(", ");
          setVoiceStep("starting");
          setVoiceStatusMessage("Repetindo as opcoes...");
          speakText(
            `Opcoes disponiveis: ${optionsText}. Diga Clinico Geral, Pediatria ou Exames. Voce tambem pode dizer cancelar.`,
            () => {
              setVoiceStep("listening_choice");
              setVoiceStatusMessage("Ouvindo sua escolha...");
              startListening("queue_choice");
            }
          );
          return;
        }

        const selectedQueue = getQueueByVoiceCommand(command, queues);
        if (!selectedQueue) {
          setVoiceStep("listening_choice");
          setVoiceStatusMessage("Comando nao reconhecido. Ouvindo novamente...");
          speakText("Nao entendi a opcao. Diga Clinico Geral, Pediatria, Exames, repetir ou cancelar.", () => {
            startListening("queue_choice");
          });
          return;
        }

        setSelectedVoiceQueue(selectedQueue);
        selectedVoiceQueueRef.current = selectedQueue;
        setVoiceStep("confirming_choice");
        setVoiceStatusMessage(`Confirmando opcao: ${selectedQueue.name}`);
        const selectedServiceType = selectedServiceModeRef.current;
        const serviceModeText = selectedServiceType ? ` com ${getServiceModeLabel(selectedServiceType).toLowerCase()}` : "";
        speakText(
          `Voce escolheu ${selectedQueue.name}${serviceModeText}. Deseja confirmar? Diga confirmar ou sim para continuar. Diga nao para escolher novamente.`,
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
            speakText("Vamos voltar para escolha do servico.", () => {
              startListening("queue_choice");
            });
            return;
          }

          setVoiceStep("confirming_choice");
          setVoiceStatusMessage(`Confirmando opcao: ${queueToConfirm.name}`);
          const selectedServiceType = selectedServiceModeRef.current;
          const serviceModeText = selectedServiceType ? ` com ${getServiceModeLabel(selectedServiceType).toLowerCase()}` : "";
          speakText(
            `Voce escolheu ${queueToConfirm.name}${serviceModeText}. Deseja confirmar? Diga confirmar ou sim para continuar. Diga nao para escolher novamente.`,
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
            startListening("queue_choice");
          });
          return;
        }

        if ((command.includes("confirmar") || command.includes("sim")) && queueToConfirm) {
          setVoiceStep("generating");
          setVoiceStatusMessage(`Gerando senha para ${queueToConfirm.name}...`);
          speakText(`Gerando senha para ${queueToConfirm.name}.`);
          void issueTicket(queueToConfirm, {
            speakResult: true,
            serviceMode: selectedServiceModeRef.current ?? "normal"
          });
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

      if (phase === "service_mode") {
        setVoiceStep("listening_choice");
        setVoiceStatusMessage("Sem resposta. Ouvindo novamente...");
        speakText("Nao ouvi sua resposta. Diga atendimento normal, atendimento prioritario, repetir ou cancelar.", () => {
          startListening("service_mode");
        });
        return;
      }

      if (phase === "queue_choice") {
        setVoiceStep("listening_choice");
        setVoiceStatusMessage("Sem resposta. Ouvindo novamente...");
        speakText("Nao ouvi sua resposta. Diga Clinico Geral, Pediatria, Exames, repetir ou cancelar.", () => {
          startListening("queue_choice");
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
      if (phase === "confirmation") {
        setVoiceStep("confirming_choice");
        setVoiceStatusMessage("Ouvindo confirmacao...");
      } else {
        setVoiceStep("listening_choice");
        setVoiceStatusMessage(phase === "service_mode" ? "Ouvindo tipo de atendimento..." : "Ouvindo sua escolha...");
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
    setSelectedServiceMode(null);
    selectedServiceModeRef.current = null;
    setSelectedVoiceQueue(null);
    selectedVoiceQueueRef.current = null;
    setLastHeardCommand(null);
    setFeedback(null);
    setLastIssuedTicket(null);
    setLastIssuedIsPriority(false);
    setVoiceStatusMessage("Lendo tipos de atendimento por voz...");
    speakText(
      "Bem vindo ao modo por voz. Escolha atendimento normal ou atendimento prioritario. Depois eu vou apresentar Clinico Geral, Pediatria e Exames. Voce tambem pode dizer repetir ou cancelar.",
      () => {
        startListening("service_mode");
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

  function handleSelectServiceMode(mode: ServiceMode) {
    setSelectedServiceMode(mode);
    selectedServiceModeRef.current = mode;
    setOpenQueueInfoId(null);
    setFeedback(null);
    setLastIssuedTicket(null);
    setLastIssuedIsPriority(false);
  }

  async function issueTicket(queue: QueueOption, options?: { speakResult?: boolean; serviceMode?: ServiceMode }) {
    const serviceMode = options?.serviceMode ?? selectedServiceModeRef.current;
    if (!serviceMode) {
      setFeedback({ kind: "error", message: "Escolha atendimento normal ou prioritario antes de selecionar o servico." });
      return { ok: false as const, error: "Tipo de atendimento nao selecionado." };
    }

    const isPriority = serviceMode === "priority";
    setIssuingPrefix(queue.prefix);
    setFeedback(null);

    const result = await createNextTicket(queue.prefix, isPriority);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setIssuingPrefix(null);
      if (options?.speakResult && voiceModeActiveRef.current) {
        setVoiceStep("error");
        setVoiceStatusMessage("Erro ao gerar senha no modo por voz.");
        speakText(`Nao foi possivel gerar a senha para ${queue.name}. Tente novamente ou cancele o modo por voz.`, () => {
          if (voiceModeActiveRef.current) {
            startListening("queue_choice");
          }
        });
      }
      return { ok: false as const, error: result.error };
    }

    const ticketIsPriority = result.data.isPriority ?? isPriority;
    const formattedTicket = formatTicket(result.data.prefix, result.data.ticketNumber, 3, ticketIsPriority);
    setLastIssuedTicket(formattedTicket);
    setLastIssuedIsPriority(ticketIsPriority);
    const stageStatus =
      result.data.currentStage && result.data.currentStage !== "waiting_attendant"
        ? ` Estagio retornado: ${result.data.currentStage}.`
        : "";

    setFeedback({
      kind: "success",
      message: `Senha ${formattedTicket} gerada com sucesso.${stageStatus} Aguarde a chamada no painel.`
    });
    setIssuingPrefix(null);
    setSelectedServiceMode(null);
    selectedServiceModeRef.current = null;

    if (options?.speakResult && voiceModeActiveRef.current) {
      setVoiceStep("completed");
      setVoiceStatusMessage(`Senha gerada: ${formattedTicket}`);
      const spelledTicket = spellTicketForSpeech(formattedTicket);
      const priorityText = ticketIsPriority ? "prioritaria " : "";
      speakText(`Senha ${priorityText}${spelledTicket} gerada com sucesso. Aguarde a chamada no painel.`);
      setIsVoiceModeActive(false);
      voiceModeActiveRef.current = false;
      setSelectedVoiceQueue(null);
      selectedVoiceQueueRef.current = null;
    }

    return { ok: true as const, formattedTicket };
  }

  async function handleIssueTicket(queue: QueueOption) {
    setOpenQueueInfoId(null);
    const serviceMode = selectedServiceModeRef.current;
    if (!serviceMode) {
      setFeedback({ kind: "error", message: "Escolha atendimento normal ou prioritario antes de selecionar o servico." });
      return;
    }

    await issueTicket(queue, { serviceMode });
  }

  return (
    <main
      className={`relative overflow-hidden ${
        isHighContrast
          ? "bg-black"
          : isTeaModeActive
            ? "bg-[linear-gradient(180deg,_#f5f7fb_0%,_#eef2f7_100%)]"
            : "bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.20),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_52%,_#e7eff8_100%)]"
      }`}
    >
      {!isHighContrast && !isTeaModeActive && (
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
              : isTeaModeActive
                ? "border border-slate-200 bg-slate-50/95 text-slate-950 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.16)]"
                : "border border-white/70 bg-white/88 text-slate-950 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl"
          }`}
        >
          {!isHighContrast && !isTeaModeActive && (
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
                      isHighContrast ? "bg-white text-black" : isTeaModeActive ? "bg-slate-200 text-slate-700" : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    Totem
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                      isHighContrast ? "border border-white text-white" : isTeaModeActive ? "bg-white text-slate-600" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Autoatendimento
                  </span>
                </div>

                <h1 className={`mt-3 text-3xl font-black tracking-tight sm:text-[2.55rem] ${isHighContrast ? "text-white" : "text-slate-950"}`}>
                  {isTeaModeActive ? "Um passo por vez." : "Escolha seu atendimento."}
                </h1>
                <p className={`mt-2 text-sm font-medium sm:text-base ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                  {currentJourneyDescription}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                  isHighContrast
                    ? "border border-white text-white"
                    : isTeaModeActive
                      ? "border border-slate-200 bg-white text-slate-600"
                      : "border border-white/80 bg-white text-slate-600 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.28)]"
                }`}
              >
                <StatusSparkIcon className="h-4 w-4" />
                {voiceStatusBadge.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={isVoiceModeActive ? handleDeactivateVoiceMode : handleActivateVoiceMode}
                disabled={isLoadingQueues || Boolean(issuingPrefix)}
                aria-pressed={isVoiceModeActive}
                aria-label={isVoiceModeActive ? "Desativar modo por voz guiado" : "Ativar modo por voz guiado"}
                className={`inline-flex min-h-[5.35rem] flex-col items-start justify-between rounded-[1.35rem] border px-3 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${
                  isHighContrast
                    ? isVoiceModeActive
                      ? "border-white bg-yellow-300 text-black hover:bg-yellow-200 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                      : "border-white bg-black text-white hover:bg-slate-900 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                    : isVoiceModeActive
                      ? isTeaModeActive
                        ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                        : "border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_20px_42px_-24px_rgba(16,185,129,0.7)] hover:from-emerald-600 hover:to-teal-600 disabled:border-slate-200 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      : isTeaModeActive
                        ? "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
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
                          : isTeaModeActive
                            ? "bg-slate-100 text-slate-700"
                            : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    <VoiceIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block leading-tight">Voz</span>
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
                className={`inline-flex min-h-[5.35rem] flex-col items-start justify-between rounded-[1.35rem] border px-3 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                  isHighContrast
                    ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
                    : isTeaModeActive
                      ? "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      : "border-amber-200 bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] hover:border-amber-300 hover:bg-amber-50/80"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isHighContrast ? "bg-black text-yellow-300" : isTeaModeActive ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <ContrastIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block leading-tight">Contraste</span>
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

              <button
                type="button"
                onClick={() => setIsTeaModeActive((currentValue) => !currentValue)}
                aria-pressed={isTeaModeActive}
                aria-label={isTeaModeActive ? "Desativar modo TEA" : "Ativar modo TEA"}
                className={`inline-flex min-h-[5.35rem] flex-col items-start justify-between rounded-[1.35rem] border px-3 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                  isHighContrast
                    ? isTeaModeActive
                      ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
                      : "border-white bg-black text-white hover:bg-slate-900"
                    : isTeaModeActive
                      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isHighContrast
                        ? isTeaModeActive
                          ? "bg-black text-yellow-300"
                          : "border border-white text-white"
                        : isTeaModeActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <FocusModeIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block leading-tight">Modo TEA</span>
                    <span
                      className={`block text-[11px] font-bold uppercase tracking-[0.18em] ${
                        isHighContrast
                          ? isTeaModeActive
                            ? "text-black/80"
                            : "text-slate-300"
                          : isTeaModeActive
                            ? "text-white/75"
                            : "text-slate-500"
                      }`}
                    >
                      Calmo
                    </span>
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                    isHighContrast
                      ? isTeaModeActive
                        ? "bg-black text-yellow-300"
                        : "border border-white text-white"
                      : isTeaModeActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isTeaModeActive ? "On" : "Off"}
                </span>
              </button>
            </div>

            {isTeaModeActive && (
              <div
                className={`mt-4 rounded-[1.6rem] border px-4 py-4 ${
                  isHighContrast ? "border-white bg-black text-white" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${isHighContrast ? "text-yellow-300" : "text-slate-500"}`}>
                      Passo atual
                    </p>
                    <p className="mt-2 text-lg font-black tracking-tight sm:text-xl">{currentJourneyStep.title}</p>
                    <p className={`mt-1 text-sm font-medium ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                      {currentJourneyStep.description}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                      isHighContrast ? "bg-yellow-300 text-black" : "bg-slate-900 text-white"
                    }`}
                  >
                    {currentJourneyStep.label}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    { index: 1, label: "Tipo" },
                    { index: 2, label: "Servico" },
                    { index: 3, label: "Senha" }
                  ].map((step) => {
                    const isActiveStep = currentJourneyStep.index === step.index;
                    const isCompletedStep = currentJourneyStep.index > step.index;

                    return (
                      <div
                        key={step.index}
                        className={`rounded-[1.1rem] border px-3 py-3 text-sm ${
                          isHighContrast
                            ? isActiveStep
                              ? "border-white bg-yellow-300 text-black"
                              : "border-white bg-black text-white"
                            : isActiveStep
                              ? "border-slate-900 bg-slate-900 text-white"
                              : isCompletedStep
                                ? "border-slate-300 bg-slate-100 text-slate-700"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.18em]">Passo {step.index}</p>
                        <p className="mt-1 font-bold">{step.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(selectedVoiceQueue || lastHeardCommand || voiceStep !== "idle") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                    isHighContrast ? "border border-white text-white" : isTeaModeActive ? "bg-slate-900 text-white" : voiceStatusBadge.className
                  }`}
                >
                  <VoiceIcon className="h-4 w-4" />
                  {voiceStepSummary}
                </span>

                {selectedServiceMode && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      isHighContrast ? "border border-white text-white" : isTeaModeActive ? "border border-slate-300 bg-white text-slate-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Tipo: {getServiceModeShortLabel(selectedServiceMode)}
                  </span>
                )}

                {selectedVoiceQueue && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      isHighContrast ? "border border-white text-white" : isTeaModeActive ? "border border-slate-300 bg-white text-slate-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Opcao: {selectedVoiceQueue.name}
                  </span>
                )}

                {lastHeardCommand && !isTeaModeActive && (
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

        <section
          className={`mt-4 rounded-[2rem] px-4 py-4 sm:px-6 sm:py-5 ${
            isHighContrast
              ? "border-2 border-white bg-black text-white shadow-none"
              : isTeaModeActive
                ? currentJourneyStep.index === 1
                  ? "border-2 border-slate-900 bg-white text-slate-950"
                  : "border border-slate-200 bg-slate-50/92 text-slate-950"
                : "border border-white/75 bg-white/88 text-slate-950 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.2)] backdrop-blur-xl"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${
                  isHighContrast
                    ? "bg-white text-black"
                    : isTeaModeActive && currentJourneyStep.index === 1
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                Passo 1
              </span>
              <h2 className={`mt-3 text-2xl font-black tracking-tight sm:text-[2rem] ${isHighContrast ? "text-white" : "text-slate-950"}`}>
                Normal ou prioritario?
              </h2>
              <p className={`mt-1 text-sm font-medium ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                {isTeaModeActive ? "Escolha primeiro o tipo de atendimento." : "Escolha uma opcao para liberar as filas."}
              </p>
            </div>

            {selectedServiceModeLabel && (
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                  isHighContrast ? "border border-white text-white" : isTeaModeActive ? "bg-slate-100 text-slate-700" : "bg-sky-100 text-sky-700"
                }`}
              >
                {selectedServiceModeLabel}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={selectedServiceMode === "normal"}
              aria-label="Selecionar atendimento normal"
              onClick={() => handleSelectServiceMode("normal")}
              className={`group relative flex min-h-[8.75rem] flex-col items-start justify-between overflow-hidden rounded-[1.85rem] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                isHighContrast
                  ? selectedServiceMode === "normal"
                    ? "border-white bg-yellow-300 text-black"
                    : "border-white bg-black text-white hover:bg-slate-950"
                  : selectedServiceMode === "normal"
                    ? isTeaModeActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-sky-300 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-[0_24px_55px_-28px_rgba(37,99,235,0.55)]"
                    : isTeaModeActive
                      ? "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                      : "border-slate-200 bg-white text-slate-900 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.16)] hover:border-sky-200 hover:bg-sky-50/70"
              }`}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] ${
                  isHighContrast
                    ? selectedServiceMode === "normal"
                      ? "bg-black text-yellow-300"
                      : "border border-white text-white"
                    : selectedServiceMode === "normal"
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                <TicketRequestIcon className="h-7 w-7" />
              </span>

              <div className="mt-4">
                <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${
                  isHighContrast
                    ? selectedServiceMode === "normal"
                      ? "text-black/75"
                      : "text-slate-300"
                    : selectedServiceMode === "normal"
                      ? "text-white/75"
                      : "text-slate-500"
                }`}>
                  Atendimento
                </p>
                <p className="mt-1 text-xl font-black tracking-tight sm:text-[1.55rem]">Normal</p>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={selectedServiceMode === "priority"}
              aria-label="Selecionar atendimento prioritario"
              onClick={() => handleSelectServiceMode("priority")}
              className={`group relative flex min-h-[8.75rem] flex-col items-start justify-between overflow-hidden rounded-[1.85rem] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                isHighContrast
                  ? selectedServiceMode === "priority"
                    ? "border-white bg-yellow-300 text-black"
                    : "border-white bg-black text-white hover:bg-slate-950"
                  : selectedServiceMode === "priority"
                    ? isTeaModeActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-sky-300 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-[0_26px_60px_-26px_rgba(37,99,235,0.62)]"
                    : isTeaModeActive
                      ? "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                      : "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-950 shadow-[0_20px_52px_-34px_rgba(37,99,235,0.22)] hover:border-sky-300 hover:from-sky-100 hover:to-blue-100"
              }`}
            >
              {!isHighContrast && !isTeaModeActive && (
                <div className="pointer-events-none absolute inset-x-6 top-4 h-16 rounded-full bg-gradient-to-r from-white/35 via-sky-200/35 to-blue-200/35 blur-2xl" />
              )}

              <span
                className={`relative flex h-16 w-16 items-center justify-center rounded-[1.55rem] ${
                  isHighContrast
                    ? selectedServiceMode === "priority"
                      ? "bg-black text-yellow-300"
                      : "border border-white text-white"
                    : selectedServiceMode === "priority"
                      ? "bg-white/15 text-white"
                      : "bg-sky-100 text-sky-700"
                }`}
              >
                <PriorityCareIcon className="h-8 w-8" />
              </span>

              <div className="relative mt-4">
                <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${
                  isHighContrast
                    ? selectedServiceMode === "priority"
                      ? "text-black/75"
                      : "text-slate-300"
                    : selectedServiceMode === "priority"
                      ? "text-white/75"
                      : "text-sky-700"
                }`}>
                  Atendimento
                </p>
                <p className="mt-1 text-xl font-black tracking-tight sm:text-[1.55rem]">Prioritario</p>
              </div>
            </button>
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
                : isTeaModeActive
                  ? "border border-slate-300 bg-slate-900 text-white shadow-[0_22px_60px_-38px_rgba(15,23,42,0.42)]"
                  : "bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-[0_30px_80px_-34px_rgba(37,99,235,0.55)]"
            }`}
          >
            {!isHighContrast && !isTeaModeActive && (
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
                      isHighContrast ? "bg-yellow-300 text-black" : isTeaModeActive ? "bg-white text-slate-900" : "bg-white/15 text-sky-50"
                    }`}
                  >
                    Senha gerada
                  </span>
                  {lastIssuedIsPriority && (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${
                        isHighContrast ? "bg-white text-black" : "bg-white text-sky-700"
                      }`}
                    >
                      Prioritaria
                    </span>
                  )}
                  {issuedTicketParts?.prefix && (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${
                        isHighContrast ? "border border-white text-white" : isTeaModeActive ? "border border-white/20 text-slate-100" : "bg-white/10 text-sky-50"
                      }`}
                    >
                      Prefixo {issuedTicketParts.prefix}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Sua senha esta pronta.</h2>
                <p className={`mt-3 max-w-md text-base leading-7 ${isHighContrast ? "text-slate-100" : isTeaModeActive ? "text-slate-200" : "text-blue-50"}`}>
                  {isTeaModeActive
                    ? "Guarde o numero e aguarde a chamada no painel."
                    : "A confirmacao fica em destaque para leitura rapida. Guarde o numero e acompanhe a chamada no painel."}
                </p>
              </div>

              <div
                className={`rounded-[1.9rem] px-5 py-6 text-center sm:px-7 sm:py-8 ${
                  isHighContrast ? "border-2 border-white bg-black text-white" : isTeaModeActive ? "border border-white/15 bg-black/20" : "bg-white/12 backdrop-blur-md"
                }`}
              >
                <p className={`text-sm font-black uppercase tracking-[0.22em] ${isHighContrast ? "text-yellow-300" : isTeaModeActive ? "text-slate-200" : "text-sky-100"}`}>
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
                <p className={`mt-5 text-base font-semibold leading-7 ${isHighContrast ? "text-slate-100" : isTeaModeActive ? "text-slate-100" : "text-blue-50"}`}>
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
                : isTeaModeActive
                  ? "border border-rose-200 bg-white text-rose-900"
                  : "border border-rose-200 bg-rose-50 text-rose-900 shadow-[0_20px_55px_-38px_rgba(225,29,72,0.4)]"
            }`}
          >
            <p className={`text-sm font-black uppercase tracking-[0.22em] ${isHighContrast ? "text-yellow-300" : "text-rose-700"}`}>
              Nao foi possivel concluir
            </p>
            <p className="mt-3 text-lg font-semibold">{feedback.message}</p>
          </section>
        )}

        {selectedServiceMode && (
          <section className="mt-4">
            <div
              className={`mb-4 rounded-[2rem] px-4 py-4 sm:px-6 ${
                isHighContrast
                  ? "border-2 border-white bg-black text-white shadow-none"
                  : isTeaModeActive
                    ? currentJourneyStep.index === 2
                      ? "border-2 border-slate-900 bg-white text-slate-950"
                      : "border border-slate-200 bg-slate-50/92 text-slate-950"
                    : "border border-white/75 bg-white/88 text-slate-950 shadow-[0_22px_65px_-42px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${
                      isHighContrast
                        ? "bg-white text-black"
                        : isTeaModeActive && currentJourneyStep.index === 2
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Passo 2
                  </span>
                  <h2 className={`mt-3 text-2xl font-black tracking-tight sm:text-[2rem] ${isHighContrast ? "text-white" : "text-slate-950"}`}>
                    Escolha o servico.
                  </h2>
                  {isTeaModeActive && (
                    <p className={`mt-1 text-sm font-medium ${isHighContrast ? "text-slate-100" : "text-slate-600"}`}>
                      Agora toque em um servico para emitir a senha.
                    </p>
                  )}
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                    isHighContrast
                      ? "border border-white text-white"
                      : isTeaModeActive
                        ? "bg-slate-100 text-slate-700"
                      : selectedServiceMode === "priority"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {getServiceModeLabel(selectedServiceMode)}
                </span>
              </div>
            </div>

            {isLoadingQueues && (
              <p
                className={`rounded-[2rem] px-5 py-8 text-center text-xl font-semibold ${
                  isHighContrast
                    ? "border-2 border-white bg-black text-white shadow-none"
                    : isTeaModeActive
                      ? "border border-slate-200 bg-white text-slate-700"
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
                    : isTeaModeActive
                      ? "border border-amber-200 bg-white text-amber-950"
                      : "border border-amber-200 bg-amber-50 text-amber-950 shadow-[0_20px_60px_-40px_rgba(245,158,11,0.25)]"
                }`}
              >
                <p className={`text-lg font-semibold ${isHighContrast ? "text-white" : "text-amber-900"}`}>{queueError}</p>
                <button
                  type="button"
                  className={`mt-5 inline-flex min-h-14 items-center justify-center rounded-[1.35rem] border px-6 text-lg font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                    isHighContrast
                      ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
                      : isTeaModeActive
                        ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      : "border-sky-200 bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-[0_18px_45px_-24px_rgba(37,99,235,0.55)] hover:from-sky-700 hover:to-blue-700"
                  }`}
                  onClick={() => setReloadVersion((currentValue) => currentValue + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!isLoadingQueues && !queueError && queues.length > 0 && (
              <ul className={`grid ${isTeaModeActive ? "gap-5" : "gap-4"} md:grid-cols-2 xl:grid-cols-3`} aria-label="Filas disponiveis para emissao de senha">
                {queues.map((queue) => {
                  const queueVisual = getQueueVisualConfig(queue);
                  const isIssuingCurrentQueue = issuingPrefix === queue.prefix;
                  const isInfoOpen = openQueueInfoId === queue.id;
                  const queueAssistiveTextId = `queue-assistive-${queue.id}`;
                  const queueInfoPanelId = `queue-info-panel-${queue.id}`;
                  const queueActionLabel =
                    selectedServiceMode === "priority"
                      ? `Gerar senha prioritaria para ${queue.name}`
                      : `Gerar senha para ${queue.name}`;

                  return (
                    <li key={queue.id} className="relative">
                      <button
                        type="button"
                        className={`group relative flex min-h-[12.75rem] w-full flex-col overflow-hidden rounded-[2rem] px-6 py-5 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none ${
                          isHighContrast
                            ? "border-2 border-white bg-black text-white hover:bg-slate-950 disabled:border-slate-500 disabled:bg-slate-800 disabled:text-slate-400"
                            : isTeaModeActive
                              ? "border border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                              : "border border-white/80 bg-gradient-to-b from-white via-white to-sky-50/90 text-slate-950 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.22)] hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_26px_80px_-38px_rgba(37,99,235,0.24)] disabled:border-slate-200 disabled:from-slate-100 disabled:to-slate-200 disabled:text-slate-500"
                        }`}
                        aria-label={queueActionLabel}
                        aria-describedby={queueAssistiveTextId}
                        onClick={() => void handleIssueTicket(queue)}
                        disabled={Boolean(issuingPrefix)}
                      >
                        {!isTeaModeActive && (
                          <span
                            className={`absolute inset-x-0 top-0 h-1.5 ${
                              isHighContrast ? "bg-yellow-300" : `bg-gradient-to-r ${queueVisual.accentGradient}`
                            }`}
                          />
                        )}

                        {!isHighContrast && !isTeaModeActive && (
                          <div
                            className={`pointer-events-none absolute inset-x-10 top-6 h-20 rounded-full bg-gradient-to-r ${queueVisual.accentGradient} opacity-10 blur-3xl`}
                          />
                        )}

                        <div className="relative flex h-full flex-col items-center">
                          <div
                            className={`flex h-20 w-20 items-center justify-center rounded-[1.7rem] border ${
                              isHighContrast
                                ? "border-white bg-yellow-300 text-black shadow-none"
                                : isTeaModeActive
                                  ? "border-slate-200 bg-slate-100 text-slate-700"
                                  : `${queueVisual.iconTone} border-white/70 shadow-[0_18px_42px_-28px_rgba(37,99,235,0.4)]`
                            }`}
                          >
                            {renderQueueIcon(queueVisual.icon, "h-10 w-10")}
                          </div>

                          <div className="mt-5">
                            <p
                              className={`text-[11px] font-black uppercase tracking-[0.24em] ${
                                isHighContrast ? "text-yellow-300" : isTeaModeActive ? "text-slate-500" : "text-sky-700"
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
                              {isIssuingCurrentQueue ? "Gerando senha..." : isTeaModeActive ? "Emitir senha" : "Toque para emitir senha"}
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
                            : isTeaModeActive
                              ? isInfoOpen
                                ? "border-slate-300 bg-slate-100 text-slate-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                            : isInfoOpen
                              ? "border-sky-200 bg-sky-100 text-sky-700 shadow-[0_12px_28px_-24px_rgba(2,132,199,0.45)]"
                              : "border-white/80 bg-white/90 text-slate-500 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.28)] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        }`}
                      >
                        <InfoIcon className="h-4 w-4" />
                      </button>

                      <span id={queueAssistiveTextId} className="sr-only">
                        {`${getServiceModeLabel(selectedServiceMode)} selecionado. ${queue.name}. ${queueVisual.eyebrow}. Toque no card para gerar sua senha. Use o botao de informacoes para ler detalhes adicionais.`}
                      </span>

                      {isInfoOpen && (
                        <div
                          id={queueInfoPanelId}
                          className={`mt-2 rounded-[1.35rem] px-4 py-3 ${
                            isHighContrast
                              ? "border-2 border-white bg-black text-white"
                              : isTeaModeActive
                                ? "border border-slate-200 bg-white text-slate-700"
                                : "border border-sky-100 bg-white/95 text-slate-700 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.22)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                isHighContrast ? "bg-yellow-300 text-black" : isTeaModeActive ? "bg-slate-100 text-slate-700" : "bg-sky-100 text-sky-700"
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
                    : isTeaModeActive
                      ? "border border-slate-200 bg-white text-slate-700"
                      : "border border-white/70 bg-white/86 text-slate-700 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)]"
                }`}
              >
                Nenhuma fila encontrada no banco.
              </p>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
