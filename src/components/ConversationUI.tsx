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
import { SessionState, NoteItem, ToolExecutionEvent } from "../types";

interface ConversationUIProps {
  state: SessionState;
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
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6 select-none">
      {/* --- TOP BAR (Minimal & Elegant) --- */}
      <header className="w-full flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
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
            <span className="text-[10px] text-white/50 tracking-tight font-medium">
              • {getStatusLabel()}
            </span>
          </div>

          {/* Active Tool Confirmation Pill */}
          <AnimatePresence>
            {activeToolEvent && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-200 backdrop-blur-md"
              >
                <Sparkles className="w-3 h-3 text-rose-300 animate-spin" />
                <span>{activeToolEvent.summary || activeToolEvent.name}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wake Alert Pill */}
          <AnimatePresence>
            {wakeAlert && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[11px] text-emerald-200 backdrop-blur-md shadow-lg"
              >
                <Sparkles className="w-3 h-3 text-emerald-300 animate-spin" />
                <span>Wake phrase &ldquo;{wakeAlert}&rdquo; recognized!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          {/* Notes / Memory Drawer Toggle */}
          <button
            onClick={() => setIsNotesOpen(!isNotesOpen)}
            title="Saved Notes & Reminders"
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-md"
          >
            <BookOpen className="w-4 h-4" />
            {notes.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Debug Panel Toggle */}
          <button
            onClick={onToggleDebug}
            title="Developer Diagnostics"
            className={`p-2 rounded-full border transition-all cursor-pointer backdrop-blur-md ${
              isDebugOpen
                ? "bg-rose-600/30 border-rose-500 text-rose-300"
                : "bg-black/40 hover:bg-black/60 border-white/10 text-white/50 hover:text-white"
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- NOW PLAYING MUSIC WIDGET (Minimal Floater) --- */}
      <AnimatePresence>
        {nowPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-auto self-start mt-3 flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/60 border border-rose-500/30 backdrop-blur-xl shadow-xl max-w-sm"
          >
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <Music className={`w-4 h-4 ${!isMusicPaused ? "animate-bounce" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Now Playing
              </p>
              <p className="text-xs text-white/90 truncate font-medium">{nowPlaying}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleMusicPlayback}
                title={isMusicPaused ? "Resume" : "Pause"}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                {isMusicPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onStopMusic}
                title="Stop Music"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors cursor-pointer"
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
      <div className="w-full flex flex-col items-center gap-3 pointer-events-auto pb-2">
        {/* Conversational Subtitle Pill (Discreet, Never Blocks Face) */}
        <AnimatePresence mode="wait">
          {lastTranscript && (
            <motion.div
              key={lastTranscript.text}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5 }}
              className={`max-w-xl px-5 py-2.5 rounded-2xl backdrop-blur-xl border text-center shadow-2xl ${
                lastTranscript.role === "user"
                  ? "bg-black/60 border-white/15 text-white/90"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-100"
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold block mb-0.5 opacity-60">
                {lastTranscript.role === "user" ? "You" : "AIRA"}
              </span>
              <p className="text-sm md:text-base font-medium leading-snug">
                "{lastTranscript.text}"
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
            className="px-3.5 py-1 rounded-full bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400/40 text-[11px] text-rose-200 font-medium backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            Tap to interrupt AIRA
          </motion.button>
        )}

        {/* Conversation Input & Control Bar */}
        <div className="w-full max-w-xl flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-black/65 border border-white/15 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
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
            className={`relative p-3 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
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
                className="absolute inset-0 rounded-xl bg-rose-400 animate-ping opacity-30"
                style={{ transform: `scale(${1 + userVolume * 0.8})` }}
              />
            )}
            {isMicActive ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          {/* Text Input for Quiet / Natural Typing */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                state === "DISCONNECTED"
                  ? `Say "${wakePhrase}" or type to wake up...`
                  : isMicActive
                  ? `Say "${wakePhrase}" or speak naturally...`
                  : `Type or say "${wakePhrase}"...`
              }
              className="w-full bg-transparent border-none outline-none text-xs md:text-sm text-white placeholder-white/40 font-medium px-2"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-600 disabled:opacity-20 disabled:hover:bg-white/10 text-white transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* --- SIDE NOTES & MEMORY DRAWER --- */}
      <AnimatePresence>
        {isNotesOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="pointer-events-auto fixed top-0 right-0 h-full w-80 bg-[#0e0f18]/90 border-l border-white/10 backdrop-blur-2xl p-5 flex flex-col z-50 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">AIRA's Memory & Notes</h3>
              </div>
              <button
                onClick={() => setIsNotesOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
              {notes.length === 0 ? (
                <p className="text-xs text-white/40 italic text-center py-12">
                  No notes or reminders saved yet. Tell AIRA: "Remember to call mom" or "Take a note".
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
        )}
      </AnimatePresence>
    </div>
  );
};
