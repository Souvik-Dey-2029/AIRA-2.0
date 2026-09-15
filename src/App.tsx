/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { LiveSession } from "./services/live-session";
import { WakeWordService, WakeWordStatus } from "./services/wake-word";
import { BedroomScene } from "./components/BedroomScene";
import { ConversationUI } from "./components/ConversationUI";
import { DebugPanel } from "./components/DebugPanel";
import { AudioReactiveController } from "./lib/audio-reactive";
import {
  SessionState,
  AiraEmotion,
  NoteItem,
  ToolExecutionEvent,
} from "./types";

export default function App() {
  const [state, setState] = useState<SessionState>("DISCONNECTED");
  const [emotion, setEmotion] = useState<AiraEmotion>("NEUTRAL");
  const [userVolume, setUserVolume] = useState(0);
  const [airaVolume, setAiraVolume] = useState(0);
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [isMicActive, setIsMicActive] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<{ role: "user" | "model"; text: string } | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  const [activeToolEvent, setActiveToolEvent] = useState<ToolExecutionEvent | null>(null);
  const [toolHistory, setToolHistory] = useState<ToolExecutionEvent[]>([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [airaVoice, setAiraVoice] = useState<string>(
    () => localStorage.getItem("aira_voice") || "Aoede"
  );

  // Wake-up phrase configuration state
  const [wakePhrase, setWakePhrase] = useState<string>(
    () => localStorage.getItem("aira_wake_phrase") || "Hey AIRA"
  );
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState<boolean>(
    () => localStorage.getItem("aira_wake_enabled") !== "false"
  );
  const [matchMode, setMatchMode] = useState<"contains" | "exact">(
    () => (localStorage.getItem("aira_wake_match_mode") as any) || "contains"
  );
  const [lastWakeDetected, setLastWakeDetected] = useState<number | null>(null);
  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus>("inactive");
  const [wakeAlert, setWakeAlert] = useState<string | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const wakeWordRef = useRef<WakeWordService | null>(null);
  const audioReactiveRef = useRef<AudioReactiveController>(new AudioReactiveController());
  const transcriptTimeoutRef = useRef<any>(null);
  const wakeAlertTimeoutRef = useRef<any>(null);
  const musicFrameRef = useRef<HTMLIFrameElement>(null);

  // Audio ducking control: lower background music when AIRA speaks
  useEffect(() => {
    if (musicFrameRef.current && musicFrameRef.current.contentWindow) {
      const volume = state === "SPEAKING" ? 15 : 85;
      musicFrameRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [volume] }),
        "*"
      );
    }
  }, [state]);

  // Audio reactive mouth openness loop (60 FPS)
  useEffect(() => {
    let animId: number;
    const updateAudioReactive = () => {
      const isSpeaking = state === "SPEAKING";
      const rawVolume = sessionRef.current ? sessionRef.current.getInstantAiraVolume() : airaVolume;
      const smoothMouth = audioReactiveRef.current.update(rawVolume || airaVolume, isSpeaking);
      setMouthOpenness(smoothMouth);
      animId = requestAnimationFrame(updateAudioReactive);
    };
    animId = requestAnimationFrame(updateAudioReactive);
    return () => cancelAnimationFrame(animId);
  }, [state, airaVolume]);

  // Keyboard shortcut (tilde ` or Backquote) to toggle developer debug panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "~") {
        setIsDebugOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update emotional state based on speech context & session state
  const deriveEmotionFromTranscript = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("haha") || lower.includes("lol") || lower.includes("sassy") || lower.includes("ziddi") || lower.includes("👀")) {
      setEmotion("PLAYFUL");
    } else if (lower.includes("namaste") || lower.includes("shubh") || lower.includes("achha") || lower.includes("great") || lower.includes("khush")) {
      setEmotion("HAPPY");
    } else if (lower.includes("kyun") || lower.includes("kaise") || lower.includes("why") || lower.includes("soch") || lower.includes("hmmm")) {
      setEmotion("THOUGHTFUL");
    } else if (lower.includes("sweet") || lower.includes("care") || lower.includes("relax") || lower.includes("pareshan mat ho")) {
      setEmotion("SUPPORTIVE");
    } else {
      setEmotion("NEUTRAL");
    }
  };

  const addNote = (content: string, type: NoteItem["type"]) => {
    const newNote: NoteItem = {
      id: Math.random().toString(36).substring(2, 9),
      content,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setNotes((prev) => [...prev.slice(-20), newNote]);
  };

  const handleToolCall = (name: string, args: any) => {
    console.log("App handled tool execution:", name, args);
    let summary = name;

    if (name === "playMusic") {
      summary = `Playing "${args.query}"`;
      setNowPlaying(args.query);
      setIsMusicPaused(false);
      addNote(`Music requested: ${args.query}`, "SONG");
      if (musicFrameRef.current) {
        musicFrameRef.current.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
          args.query + " audio"
        )}&autoplay=1&enablejsapi=1`;
      }
    } else if (name === "addNote") {
      summary = `Note saved`;
      addNote(args.content, args.type || "NOTE");
    } else if (name === "openWebsite") {
      summary = `Opening ${args.url}`;
    }

    const event: ToolExecutionEvent = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      args,
      timestamp: Date.now(),
      summary,
    };

    setActiveToolEvent(event);
    setToolHistory((prev) => [event, ...prev.slice(0, 15)]);
    setTimeout(() => setActiveToolEvent(null), 4000);
  };

  const handleWakeDetected = (phrase: string) => {
    console.log("Wake phrase triggered:", phrase);
    setLastWakeDetected(Date.now());
    setWakeAlert(wakePhrase);

    if (wakeAlertTimeoutRef.current) clearTimeout(wakeAlertTimeoutRef.current);
    wakeAlertTimeoutRef.current = setTimeout(() => {
      setWakeAlert(null);
    }, 4500);

    setEmotion("PLAYFUL");

    // If disconnected, connect and wake AIRA
    if (state === "DISCONNECTED") {
      const session = initializeSession();
      setReconnectCount((c) => c + 1);
      session.connect().then(() => {
        session.sendTextMessage("Wake up greeting! User called your wake phrase.");
      });
      return;
    }

    // If already connected, ensure mic is active
    const session = initializeSession();
    if (!isMicActive) {
      session.enableMic();
    }
  };

  const handleUpdateWakePhrase = (newPhrase: string) => {
    setWakePhrase(newPhrase);
    wakeWordRef.current?.setPhrase(newPhrase);
  };

  const handleToggleWakeWord = (enabled: boolean) => {
    setIsWakeWordEnabled(enabled);
    wakeWordRef.current?.setEnabled(enabled);
  };

  const handleUpdateMatchMode = (mode: "contains" | "exact") => {
    setMatchMode(mode);
    wakeWordRef.current?.setMatchMode(mode);
  };

  const handleTestWakeWord = () => {
    wakeWordRef.current?.triggerWake(wakePhrase);
  };

  const handleSelectVoice = (newVoice: string) => {
    setAiraVoice(newVoice);
    try {
      localStorage.setItem("aira_voice", newVoice);
    } catch {
      // ignore
    }
    // Reconnect session if active to apply new voice instantly
    if (sessionRef.current && state !== "DISCONNECTED") {
      sessionRef.current.disconnect();
      sessionRef.current = null;
      setTimeout(() => {
        const freshSession = initializeSession();
        freshSession.connect();
      }, 350);
    }
  };

  // Initialize continuous wake word listener
  useEffect(() => {
    const wakeService = new WakeWordService(
      {
        phrase: wakePhrase,
        enabled: isWakeWordEnabled,
        matchMode,
      },
      (detected) => {
        handleWakeDetected(detected);
      },
      (status) => {
        setWakeWordStatus(status);
      }
    );
    wakeWordRef.current = wakeService;

    return () => {
      wakeService.destroy();
    };
  }, []);

  const initializeSession = () => {
    if (sessionRef.current) return sessionRef.current;

    const session = new LiveSession(
      "", // Handled securely via server backend
      (newState) => {
        setState(newState);
        if (newState === "SPEAKING") {
          // Keep conversational emotion
        } else if (newState === "IDLE") {
          audioReactiveRef.current.reset();
        }
      },
      (uVol) => setUserVolume(uVol),
      (aVol) => setAiraVolume(aVol),
      (role, text) => {
        setLastTranscript({ role, text });
        if (role === "model") {
          deriveEmotionFromTranscript(text);
        } else if (role === "user") {
          // Check transcript against configured wake-up phrase
          wakeWordRef.current?.checkTranscript(text);
        }
        // Subtitles disappear smoothly after 7 seconds of inactivity
        if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
        transcriptTimeoutRef.current = setTimeout(() => {
          setLastTranscript(null);
        }, 7500);
      },
      (name, args) => handleToolCall(name, args),
      (error) => {
        console.warn("Live session status notice:", error);
      },
      (micActive) => {
        setIsMicActive(micActive);
      }
    );

    sessionRef.current = session;
    return session;
  };

  const handleToggleSession = async () => {
    if (state !== "DISCONNECTED") {
      sessionRef.current?.disconnect();
      audioReactiveRef.current.reset();
      setMouthOpenness(0);
      return;
    }

    const session = initializeSession();
    setReconnectCount((c) => c + 1);
    await session.connect();
  };

  const handleToggleMic = async () => {
    if (state === "DISCONNECTED") {
      await handleToggleSession();
      return;
    }
    const session = initializeSession();
    await session.toggleMic();
  };

  const handleSendMessage = async (text: string) => {
    if (wakeWordRef.current?.matchesPhrase(text)) {
      handleWakeDetected(text);
    }
    let session = sessionRef.current;
    if (!session || state === "DISCONNECTED") {
      session = initializeSession();
      await session.connect();
    }
    await session.sendTextMessage(text);
  };

  const handleInterrupt = () => {
    sessionRef.current?.interrupt();
    audioReactiveRef.current.reset();
    setMouthOpenness(0);
  };

  const handleToggleMusicPlayback = () => {
    if (musicFrameRef.current && musicFrameRef.current.contentWindow) {
      const func = isMusicPaused ? "playVideo" : "pauseVideo";
      musicFrameRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
      setIsMusicPaused(!isMusicPaused);
    }
  };

  const handleStopMusic = () => {
    setNowPlaying(null);
    if (musicFrameRef.current) {
      musicFrameRef.current.src = "";
    }
  };

  // Auto-connect once on mount so AIRA is already sitting in the bedroom ready to speak
  useEffect(() => {
    const timer = setTimeout(() => {
      const session = initializeSession();
      session.connect().catch((err) => {
        console.warn("Auto-connect notice:", err);
      });
    }, 400);

    return () => {
      clearTimeout(timer);
      if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
      if (wakeAlertTimeoutRef.current) clearTimeout(wakeAlertTimeoutRef.current);
      sessionRef.current?.disconnect();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0d14] text-white">
      {/* 3D BEDROOM SCENE WITH AIRA SEATED NATURALLY */}
      <BedroomScene
        state={state}
        emotion={emotion}
        mouthOpenness={mouthOpenness}
        userVolume={userVolume}
        airaVolume={airaVolume}
        isMicActive={isMicActive}
      />

      {/* MINIMAL CONVERSATIONAL OVERLAY */}
      <ConversationUI
        state={state}
        isMicActive={isMicActive}
        userVolume={userVolume}
        airaVolume={airaVolume}
        lastTranscript={lastTranscript}
        activeToolEvent={activeToolEvent}
        nowPlaying={nowPlaying}
        isMusicPaused={isMusicPaused}
        notes={notes}
        wakePhrase={wakePhrase}
        wakeAlert={wakeAlert}
        onToggleSession={handleToggleSession}
        onToggleMic={handleToggleMic}
        onSendMessage={handleSendMessage}
        onInterrupt={handleInterrupt}
        onToggleMusicPlayback={handleToggleMusicPlayback}
        onStopMusic={handleStopMusic}
        onToggleDebug={() => setIsDebugOpen(!isDebugOpen)}
        isDebugOpen={isDebugOpen}
      />

      {/* DEVELOPER DIAGNOSTICS PANEL (Default hidden, Section 38 of PRD) */}
      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        state={state}
        emotion={emotion}
        liveModel="gemini-3.1-flash-live-preview / gemini-3.8-flash"
        userVolume={userVolume}
        airaVolume={airaVolume}
        mouthOpenness={mouthOpenness}
        toolEvents={toolHistory}
        reconnectCount={reconnectCount}
        wakePhrase={wakePhrase}
        onUpdateWakePhrase={handleUpdateWakePhrase}
        isWakeWordEnabled={isWakeWordEnabled}
        onToggleWakeWord={handleToggleWakeWord}
        matchMode={matchMode}
        onUpdateMatchMode={handleUpdateMatchMode}
        onTestWakeWord={handleTestWakeWord}
        lastWakeDetected={lastWakeDetected}
        wakeWordStatus={wakeWordStatus}
        currentVoice={airaVoice}
        onSelectVoice={handleSelectVoice}
      />

      {/* HIDDEN MUSIC PLAYER FOR playMusic TOOL WITH DUCKING */}
      <iframe
        id="music-player-frame"
        ref={musicFrameRef}
        title="Background Lo-Fi Music"
        className="hidden pointer-events-none"
        allow="autoplay"
      />
    </main>
  );
}
