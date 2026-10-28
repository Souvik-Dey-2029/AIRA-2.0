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
  BedroomMood,
  RememberedPerson,
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
  const [bedroomMood, setBedroomMood] = useState<BedroomMood>("cozy_candle");
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem("aira_user_name") || ""
  );
  const [rememberedPerson, setRememberedPerson] = useState<RememberedPerson | null>(() => {
    try {
      const raw = localStorage.getItem("aira_remembered_person");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
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
    if (lower.includes("haha") || lower.includes("hehe") || lower.includes("lol") || lower.includes("lmao") || lower.includes("hans rahi")) {
      setEmotion("LAUGHING");
    } else if (lower.includes("cry") || lower.includes("rona") || lower.includes("sad") || lower.includes("rote") || lower.includes("aansoo") || lower.includes("dard") || lower.includes("heartbreak")) {
      setEmotion("CRYING");
    } else if (lower.includes("queen") || lower.includes("attitude") || lower.includes("nakhre") || lower.includes("ego") || lower.includes("meri marzi") || lower.includes("smartest") || lower.includes("best girlfriend")) {
      setEmotion("EGO");
    } else if (lower.includes("naraz") || lower.includes("pout") || lower.includes("gussa") || lower.includes("chup") || lower.includes("baat nahi karungi")) {
      setEmotion("POUTING");
    } else if (lower.includes("gaana") || lower.includes("song") || lower.includes("sing") || lower.includes("sur") || lower.includes("la la la") || lower.includes("tujhe dekha") || lower.includes("tum hi ho")) {
      setEmotion("SINGING");
    } else if (lower.includes("love") || lower.includes("pyar") || lower.includes("jaan") || lower.includes("babe") || lower.includes("sweetheart") || lower.includes("dil") || lower.includes("romantic")) {
      setEmotion("ROMANTIC");
    } else if (lower.includes("flirt") || lower.includes("sassy") || lower.includes("ziddi") || lower.includes("chhed")) {
      setEmotion("FLIRTY");
    } else if (lower.includes("namaste") || lower.includes("shubh") || lower.includes("achha") || lower.includes("great") || lower.includes("khush")) {
      setEmotion("HAPPY");
    } else if (lower.includes("kyun") || lower.includes("kaise") || lower.includes("why") || lower.includes("soch") || lower.includes("hmmm")) {
      setEmotion("THOUGHTFUL");
    } else if (lower.includes("relax") || lower.includes("care") || lower.includes("pareshan mat ho")) {
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
    setNotes((prev) => [...prev.slice(-25), newNote]);
  };

  const handleToolCall = (name: string, args: any) => {
    console.log("App handled tool execution:", name, args);
    let summary = name;

    if (name === "rememberPerson") {
      const person: RememberedPerson = {
        name: args.name || "Beloved User",
        nickname: args.nickname,
        relation: args.relation || "Partner",
        favoriteThings: Array.isArray(args.favoriteThings)
          ? args.favoriteThings
          : args.favoriteThings
          ? [args.favoriteThings]
          : [],
        memory: args.memory,
        lastUpdated: new Date().toLocaleDateString(),
      };
      setRememberedPerson(person);
      setUserName(person.name);
      try {
        localStorage.setItem("aira_remembered_person", JSON.stringify(person));
        localStorage.setItem("aira_user_name", person.name);
      } catch {
        // ignore
      }
      sessionRef.current?.setUserName(person.name);
      addNote(
        `Remembered: ${person.name}${person.relation ? ` (${person.relation})` : ""}${
          person.memory ? ` - ${person.memory}` : ""
        }`,
        "PERSON_MEMORY"
      );
      setEmotion("ROMANTIC");
      summary = `Remembered ${person.name} 💕`;
    } else if (name === "singSong") {
      setEmotion("SINGING");
      addNote(
        `AIRA sang: "${args.songTitle || "Romantic melody"}"${
          args.lyricsSnippet ? ` ("${args.lyricsSnippet}")` : ""
        }`,
        "SONG"
      );
      summary = `AIRA is singing: "${args.songTitle || "Melody"}" 🎵`;
    } else if (name === "expressEmotion") {
      if (args.emotion) {
        setEmotion(args.emotion as AiraEmotion);
      }
      addNote(`Emotion: ${args.emotion} - ${args.reason || ""}`, "EMOTION");
      summary = `Expressed ${args.emotion} ${args.reason ? `(${args.reason})` : ""}`;
    } else if (name === "setBedroomMood") {
      if (args.mood) {
        setBedroomMood(args.mood as BedroomMood);
        addNote(`Bedroom atmosphere changed to ${args.mood.replace("_", " ")}`, "NOTE");
        summary = `Atmosphere: ${args.mood.replace("_", " ")} 🕯️`;
      }
    } else if (name === "controlMusic") {
      if (args.action === "pause") {
        setIsMusicPaused(true);
        if (musicFrameRef.current?.contentWindow) {
          musicFrameRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*"
          );
        }
      } else if (args.action === "resume") {
        setIsMusicPaused(false);
        if (musicFrameRef.current?.contentWindow) {
          musicFrameRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "*"
          );
        }
      } else if (args.action === "stop") {
        handleStopMusic();
      } else if (args.action === "setVolume" && typeof args.volume === "number") {
        if (musicFrameRef.current?.contentWindow) {
          musicFrameRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "setVolume", args: [args.volume] }),
            "*"
          );
        }
      }
      summary = `Music ${args.action}`;
    } else if (name === "setReminder") {
      addNote(`Reminder: ${args.reminderText || "Task"} (${args.timeOrDelay || "Scheduled"})`, "REMINDER");
      summary = `Reminder set: "${args.reminderText}"`;
    } else if (name === "getSystemTimeAndWeather") {
      summary = `Time & climate checked`;
      addNote(`System check: ${new Date().toLocaleTimeString()} - Cozy bedroom climate`, "NOTE");
    } else if (name === "playMusic") {
      summary = `Playing "${args.query}"`;
      setNowPlaying(args.query);
      setIsMusicPaused(false);
      setEmotion("ROMANTIC");
      addNote(`Music requested: ${args.query}`, "SONG");
      if (musicFrameRef.current) {
        musicFrameRef.current.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
          args.query + " audio"
        )}&autoplay=1&enablejsapi=1`;
      }
    } else if (name === "addNote") {
      summary = `Note saved to memory`;
      addNote(args.content, args.type || "NOTE");
    } else if (name === "openWebsite") {
      summary = `Opening ${args.label || args.url}`;
      try {
        window.open(args.url, "_blank");
      } catch {
        // ignore
      }
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

    if (userName) {
      session.setUserName(userName);
    }

    sessionRef.current = session;
    return session;
  };

  const handleClearIdentity = () => {
    setUserName("");
    setRememberedPerson(null);
    try {
      localStorage.removeItem("aira_user_name");
      localStorage.removeItem("aira_remembered_person");
    } catch {
      // ignore
    }
    sessionRef.current?.clearUserName();
    addNote("User memory reset. AIRA will ask who you are on next meeting.", "NOTE");
    setEmotion("THOUGHTFUL");
  };

  const handleTriggerEmotion = (emo: AiraEmotion) => {
    setEmotion(emo);
    addNote(`Emote triggered: ${emo}`, "EMOTION");
  };

  const handleSelectBedroomMood = (mood: BedroomMood) => {
    setBedroomMood(mood);
    addNote(`Lighting adjusted to ${mood.replace("_", " ")}`, "NOTE");
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
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0c0d14] text-white select-none">
      {/* 3D BEDROOM SCENE WITH AIRA SEATED NATURALLY */}
      <BedroomScene
        state={state}
        emotion={emotion}
        mouthOpenness={mouthOpenness}
        userVolume={userVolume}
        airaVolume={airaVolume}
        isMicActive={isMicActive}
        bedroomMood={bedroomMood}
      />

      {/* MINIMAL CONVERSATIONAL OVERLAY */}
      <ConversationUI
        state={state}
        emotion={emotion}
        userName={userName}
        rememberedPerson={rememberedPerson}
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
        userName={userName}
        rememberedPerson={rememberedPerson}
        bedroomMood={bedroomMood}
        onSelectBedroomMood={handleSelectBedroomMood}
        onTriggerEmotion={handleTriggerEmotion}
        onClearIdentity={handleClearIdentity}
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
