/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  Send,
  Music,
  Pause,
  Play,
  X,
  Sparkles,
  BookOpen,
  Settings2,
  Volume2,
  VolumeX,
  ExternalLink,
} from "lucide-react";
import { SessionState, NoteItem, ToolExecutionEvent, AiraEmotion, RememberedPerson } from "../types";

interface ConversationUIProps {
  state: SessionState;
  emotion?: AiraEmotion;
  userName?: string;
  rememberedPerson?: RememberedPerson | null;
  isMicActive: boolean;
  userVolume: number;
  airaVolume: number;
  lastTranscript: { role: "user" | "model"; text: string } | null;
  activeToolEvent: ToolExecutionEvent | null;
  nowPlaying: string | null;
  isMusicPaused: boolean;
  notes: NoteItem[];
  wakePhrase?: string;
  wakeAlert?: string | null;
  onToggleSession: () => void;
  onToggleMic: () => void;
  onSendMessage: (text: string) => void;
  onInterrupt: () => void;
  onToggleMusicPlayback: () => void;
  onStopMusic: () => void;
  onToggleDebug: () => void;
  isDebugOpen: boolean;
}

export const ConversationUI: React.FC<ConversationUIProps> = ({
  state,
  emotion = "NEUTRAL",
  userName,
  rememberedPerson,
  isMicActive,
  userVolume,
  airaVolume,
  lastTranscript,
  activeToolEvent,
  nowPlaying,
  isMusicPaused,
  notes,
  wakePhrase = "Hey AIRA",
  wakeAlert,
  onToggleSession,
  onToggleMic,
  onSendMessage,
  onInterrupt,
  onToggleMusicPlayback,
  onStopMusic,
  onToggleDebug,
  isDebugOpen,
}) => {
  const [inputText, setInputText] = useState("");
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const getStatusLabel = () => {
    switch (state) {
      case "CONNECTING":
        return "Connecting to AIRA...";
      case "LISTENING":
        return "Listening...";
      case "THINKING":
        return "Thinking...";
      case "SPEAKING":
        return "AIRA speaking";
      case "INTERRUPTED":
        return "Interrupted";
      case "IDLE":
        return "Listening quietly";
      default:
        return "Offline";
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] px-[calc(0.75rem+env(safe-area-inset-left))] md:p-6 select-none">
      {/* --- TOP BAR (Minimal & Elegant) --- */}
      <header className="w-full flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-lg shrink-0">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                state === "SPEAKING"
                  ? "bg-rose-400 animate-pulse"
                  : state === "LISTENING"
                  ? "bg-amber-400 animate-ping"
                  : state === "IDLE"
                  ? "bg-emerald-400"
                  : "bg-white/30"
              }`}
            />
            <span className="text-xs font-semibold tracking-wider text-white/90">AIRA</span>
            <span className="text-[10px] text-white/50 tracking-tight font-medium hidden sm:inline">
              • {getStatusLabel()}
            </span>
            {emotion && emotion !== "NEUTRAL" && (
              <span className="text-[10px] text-rose-300 font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30">
                {emotion === "LAUGHING" ? "Laughing 😆" :
                 emotion === "CRYING" ? "Emotional 🥺" :
                 emotion === "EGO" ? "Sassy / Ego 💅" :
                 emotion === "POUTING" ? "Pouting 😤" :
                 emotion === "SINGING" ? "Singing 🎵" :
                 emotion === "ROMANTIC" ? "Romantic 💕" :
                 emotion === "FLIRTY" ? "Flirty 😘" :
                 emotion === "PLAYFUL" ? "Playful 😉" :
                 emotion}
              </span>
            )}
          </div>

          {userName && (
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/25 text-[11px] text-rose-200 backdrop-blur-md">
              <span>💕</span>
              <span className="font-medium">{userName}</span>
            </div>
          )}

          {/* Active Tool Confirmation Pill (Desktop) */}
          <AnimatePresence>
            {activeToolEvent && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-200 backdrop-blur-md truncate"
              >
                <Sparkles className="w-3 h-3 text-rose-300 animate-spin shrink-0" />
                <span className="truncate">{activeToolEvent.summary || activeToolEvent.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Notes / Memory Drawer Toggle */}
          <button
            onClick={() => setIsNotesOpen(!isNotesOpen)}
            title="Saved Notes & Reminders"
            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 active:scale-95 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-md touch-manipulation"
          >
            <BookOpen className="w-4 h-4" />
            {notes.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Debug Panel Toggle */}
          <button
            onClick={onToggleDebug}
            title="Developer Diagnostics"
            className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all cursor-pointer backdrop-blur-md active:scale-95 touch-manipulation ${
              isDebugOpen
                ? "bg-rose-600/40 border-rose-500 text-rose-200 shadow-lg shadow-rose-600/30"
                : "bg-black/50 hover:bg-black/70 border-white/10 text-white/60 hover:text-white"
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Floating Center Banners: Wake Alert & Active Tool on Mobile */}
      <div className="w-full flex flex-col items-center gap-1.5 pointer-events-none mt-2 z-20">
        <AnimatePresence>
          {wakeAlert && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[11px] sm:text-xs text-emerald-200 backdrop-blur-md shadow-lg"
            >
              <Sparkles className="w-3 h-3 text-emerald-300 animate-spin shrink-0" />
              <span>Wake phrase &ldquo;{wakeAlert}&rdquo; recognized!</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeToolEvent && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="md:hidden pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/25 border border-rose-500/30 text-[11px] text-rose-200 backdrop-blur-md shadow-lg"
            >
              <Sparkles className="w-3 h-3 text-rose-300 animate-spin shrink-0" />
              <span className="truncate max-w-[240px]">{activeToolEvent.summary || activeToolEvent.name}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- NOW PLAYING MUSIC WIDGET (Minimal Floater) --- */}
      <AnimatePresence>
        {nowPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-auto self-start mt-2 sm:mt-3 flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2 rounded-2xl bg-black/70 border border-rose-500/30 backdrop-blur-xl shadow-xl max-w-[calc(100vw-2rem)] sm:max-w-sm"
          >
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <Music className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${!isMusicPaused ? "animate-bounce" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Now Playing
              </p>
              <p className="text-xs text-white/90 truncate font-medium">{nowPlaying}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleMusicPlayback}
                title={isMusicPaused ? "Resume" : "Pause"}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 transition-colors cursor-pointer touch-manipulation"
              >
                {isMusicPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onStopMusic}
                title="Stop Music"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/50 hover:text-white transition-colors cursor-pointer touch-manipulation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MIDDLE EMPTY SPACE (AIRA SITS HERE UNOBSTRUCTED) --- */}
      <div className="flex-1" />

      {/* --- BOTTOM CONVERSATION AREA --- */}
      <div className="w-full flex flex-col items-center gap-2 sm:gap-3 pointer-events-auto pb-1 sm:pb-2">
        {/* Conversational Subtitle Pill (Discreet, Never Blocks Face) */}
        <AnimatePresence mode="wait">
          {lastTranscript && (
            <motion.div
              key={lastTranscript.text}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5 }}
              className={`w-full max-w-lg px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl backdrop-blur-xl border text-center shadow-2xl max-h-24 sm:max-h-28 overflow-y-auto ${
                lastTranscript.role === "user"
                  ? "bg-black/70 border-white/15 text-white/90"
                  : "bg-rose-950/50 border-rose-500/30 text-rose-100"
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold block mb-0.5 opacity-60">
                {lastTranscript.role === "user" ? "You" : "AIRA"}
              </span>
              <p className="text-xs sm:text-sm md:text-base font-medium leading-snug">
                &ldquo;{lastTranscript.text}&rdquo;
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Interruption Pill when AIRA is speaking */}
        {state === "SPEAKING" && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={onInterrupt}
            className="px-4 py-1.5 rounded-full bg-rose-600/40 hover:bg-rose-600/60 active:scale-95 border border-rose-400/40 text-[11px] text-rose-200 font-medium backdrop-blur-md cursor-pointer transition-colors shadow-md touch-manipulation min-h-[32px] flex items-center justify-center"
          >
            Tap to interrupt AIRA
          </motion.button>
        )}

        {/* Conversation Input & Control Bar */}
        <div className="w-full max-w-xl flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
          {/* Microphone Main Action Button */}
          <button
            onClick={onToggleMic}
            title={
              state === "DISCONNECTED"
                ? "Connect to AIRA"
                : isMicActive
                ? "Mute Microphone"
                : "Enable Microphone"
            }
            className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation ${
              state === "DISCONNECTED"
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                : isMicActive
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40"
                : "bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"
            }`}
          >
            {/* Visual audio ripple ring when user speaks */}
            {isMicActive && userVolume > 0.05 && (
              <span
                className="absolute inset-0 rounded-xl bg-rose-400 animate-ping opacity-30 pointer-events-none"
                style={{ transform: `scale(${1 + userVolume * 0.8})` }}
              />
            )}
            {isMicActive ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5 text-white/60" />
            )}
          </button>

          {/* Text Input for Quiet / Natural Typing */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                state === "DISCONNECTED"
                  ? `Say "${wakePhrase}" or type...`
                  : isMicActive
                  ? `Say "${wakePhrase}" or speak...`
                  : `Type or say "${wakePhrase}"...`
              }
              className="w-full bg-transparent border-none outline-none text-base sm:text-xs md:text-sm text-white placeholder-white/40 font-medium px-2 min-w-0"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-10 h-10 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-rose-600 disabled:opacity-20 disabled:hover:bg-white/10 text-white transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* --- SIDE NOTES & MEMORY DRAWER --- */}
      <AnimatePresence>
        {isNotesOpen && (
          <>
            {/* Backdrop overlay for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotesOpen(false)}
              className="pointer-events-auto fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="pointer-events-auto fixed top-0 right-0 h-full w-full sm:w-85 max-w-[85vw] sm:max-w-none bg-[#0e0f18]/95 border-l border-white/10 backdrop-blur-2xl p-4 sm:p-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col z-50 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-white">AIRA's Memory & Notes</h3>
                </div>
                <button
                  onClick={() => setIsNotesOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 text-white/50 hover:text-white transition-colors cursor-pointer touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 scrollbar-thin">
                {rememberedPerson && (
                  <div className="p-3 rounded-xl bg-gradient-to-br from-rose-950/50 to-black/60 border border-rose-500/30 text-xs shadow-md">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                        <span>❤️</span>
                        <span>{rememberedPerson.name}</span>
                        {rememberedPerson.nickname && (
                          <span className="text-white/40 font-normal">({rememberedPerson.nickname})</span>
                        )}
                      </div>
                      <span className="text-[9px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        {rememberedPerson.relation || "Boyfriend"}
                      </span>
                    </div>
                    {rememberedPerson.memory && (
                      <p className="text-white/80 text-[11px] leading-relaxed italic mb-1.5">
                        &ldquo;{rememberedPerson.memory}&rdquo;
                      </p>
                    )}
                    {rememberedPerson.favoriteThings && rememberedPerson.favoriteThings.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rememberedPerson.favoriteThings.map((fav, idx) => (
                          <span key={idx} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                            ★ {fav}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {notes.length === 0 && !rememberedPerson ? (
                  <p className="text-xs text-white/40 italic text-center py-12 px-4">
                    No notes or memories saved yet. Tell AIRA: &ldquo;My name is Rahul&rdquo; or &ldquo;Remember to wake me up&rdquo;.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-rose-500/20 transition-all text-xs"
                    >
                      <div className="flex justify-between items-center text-[10px] text-rose-300 font-semibold mb-1">
                        <span>{note.type}</span>
                        <span className="text-white/30 font-normal">{note.timestamp}</span>
                      </div>
                      <p className="text-white/80 leading-relaxed">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
