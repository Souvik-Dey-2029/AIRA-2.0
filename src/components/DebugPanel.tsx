/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Volume2,
  Terminal,
  Radio,
  Check,
  RotateCcw,
  PlayCircle,
  Mic,
  Sliders,
} from "lucide-react";
import { SessionState, AiraEmotion, ToolExecutionEvent } from "../types";
import { WakeWordStatus } from "../services/wake-word";

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  state: SessionState;
  emotion: AiraEmotion;
  liveModel: string;
  userVolume: number;
  airaVolume: number;
  mouthOpenness: number;
  toolEvents: ToolExecutionEvent[];
  reconnectCount: number;
  wakePhrase: string;
  onUpdateWakePhrase: (phrase: string) => void;
  isWakeWordEnabled: boolean;
  onToggleWakeWord: (enabled: boolean) => void;
  matchMode: "contains" | "exact";
  onUpdateMatchMode: (mode: "contains" | "exact") => void;
  onTestWakeWord: () => void;
  lastWakeDetected: number | null;
  wakeWordStatus: WakeWordStatus;
  currentVoice?: string;
  onSelectVoice?: (voice: string) => void;
}

const PRESET_WAKE_PHRASES = [
  "Hey AIRA",
  "Suno AIRA",
  "Wake up AIRA",
  "Namaste AIRA",
];

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  state,
  emotion,
  liveModel,
  userVolume,
  airaVolume,
  mouthOpenness,
  toolEvents,
  reconnectCount,
  wakePhrase,
  onUpdateWakePhrase,
  isWakeWordEnabled,
  onToggleWakeWord,
  matchMode,
  onUpdateMatchMode,
  onTestWakeWord,
  lastWakeDetected,
  wakeWordStatus,
  currentVoice = "Aoede",
  onSelectVoice,
}) => {
  const [localPhrase, setLocalPhrase] = useState(wakePhrase);
  const [isSaved, setIsSaved] = useState(false);
  const [isTestTriggered, setIsTestTriggered] = useState(false);

  useEffect(() => {
    setLocalPhrase(wakePhrase);
  }, [wakePhrase]);

  if (!isOpen) return null;

  const handleSavePhrase = (phraseToSave?: string) => {
    const val = (phraseToSave !== undefined ? phraseToSave : localPhrase).trim();
    if (!val) return;
    onUpdateWakePhrase(val);
    setLocalPhrase(val);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  const handleSelectPreset = (preset: string) => {
    setLocalPhrase(preset);
    handleSavePhrase(preset);
  };

  const handleResetDefault = () => {
    const defaultPhrase = "Hey AIRA";
    setLocalPhrase(defaultPhrase);
    handleSavePhrase(defaultPhrase);
  };

  const handleTriggerTest = () => {
    setIsTestTriggered(true);
    onTestWakeWord();
    setTimeout(() => setIsTestTriggered(false), 1200);
  };

  return (
    <div
      id="aira-debug-panel"
      className="fixed top-16 right-4 w-84 max-h-[88vh] overflow-y-auto bg-black/92 border border-white/15 rounded-2xl p-4 text-xs font-mono text-white/80 z-50 backdrop-blur-2xl shadow-2xl space-y-3 scrollbar-thin"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-rose-400 font-bold">
          <Terminal className="w-3.5 h-3.5" />
          <span>AIRA Dev Diagnostics</span>
        </div>
        <button
          id="debug-panel-close-btn"
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
          title="Close Diagnostics (or press `)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* --- WAKE-UP PHRASE CONFIGURATION SECTION --- */}
      <div
        id="debug-wake-word-section"
        className="space-y-2.5 bg-gradient-to-b from-rose-950/30 to-white/5 p-3 rounded-xl border border-rose-500/25 shadow-inner"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-[11px]">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Wake-Up Phrase Setting</span>
          </div>

          {/* Enable / Disable Toggle */}
          <button
            id="wake-word-toggle-btn"
            onClick={() => onToggleWakeWord(!isWakeWordEnabled)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors flex items-center gap-1 ${
              isWakeWordEnabled
                ? "bg-rose-500/30 text-rose-300 border border-rose-400/40"
                : "bg-white/10 text-white/40 border border-white/10"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWakeWordEnabled ? "bg-emerald-400 animate-ping" : "bg-white/30"
              }`}
            />
            {isWakeWordEnabled ? "Active" : "Disabled"}
          </button>
        </div>

        {/* Phrase Input & Save Controls */}
        <div className="space-y-1.5">
          <label
            htmlFor="custom-wake-phrase-input"
            className="text-[10px] text-white/50 flex justify-between"
          >
            <span>Custom Trigger Phrase:</span>
            {isSaved && (
              <span className="text-emerald-400 flex items-center gap-0.5 text-[9px]">
                <Check className="w-2.5 h-2.5" /> Saved
              </span>
            )}
          </label>

          <div className="flex items-center gap-1.5">
            <input
              id="custom-wake-phrase-input"
              type="text"
              value={localPhrase}
              onChange={(e) => setLocalPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePhrase();
              }}
              placeholder="e.g. Hey AIRA, Suno AIRA"
              className="flex-1 bg-black/60 border border-white/15 focus:border-rose-400 rounded-lg px-2.5 py-1.5 text-white text-[11px] outline-none transition-colors"
            />
            <button
              id="save-wake-phrase-btn"
              onClick={() => handleSavePhrase()}
              disabled={localPhrase.trim() === wakePhrase && !isSaved}
              title="Apply & Save Wake-Up Phrase"
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-semibold text-[10px] transition-all cursor-pointer shrink-0"
            >
              Save
            </button>
            <button
              id="reset-wake-phrase-btn"
              onClick={handleResetDefault}
              title="Reset to default (Hey AIRA)"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Quick Presets:</span>
          <div className="flex flex-wrap gap-1">
            {PRESET_WAKE_PHRASES.map((preset) => {
              const isSelected = wakePhrase.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-all cursor-pointer ${
                    isSelected
                      ? "bg-rose-500/30 text-rose-200 border border-rose-400/40 font-semibold"
                      : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Matching Mode Selector */}
        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
          <span className="text-white/40">Matching Rule:</span>
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/10">
            <button
              onClick={() => onUpdateMatchMode("contains")}
              className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                matchMode === "contains"
                  ? "bg-rose-500/40 text-rose-200 font-semibold"
                  : "text-white/40 hover:text-white"
              }`}
            >
              Contains
            </button>
            <button
              onClick={() => onUpdateMatchMode("exact")}
              className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                matchMode === "exact"
                  ? "bg-rose-500/40 text-rose-200 font-semibold"
                  : "text-white/40 hover:text-white"
              }`}
            >
              Exact
            </button>
          </div>
        </div>

        {/* Status & Last Triggered */}
        <div className="space-y-1 bg-black/40 p-2 rounded-lg border border-white/5 text-[10px]">
          <div className="flex justify-between items-center">
            <span className="text-white/40">Detector Status:</span>
            <span
              className={`font-semibold ${
                !isWakeWordEnabled
                  ? "text-white/40"
                  : wakeWordStatus === "listening" || wakeWordStatus === "active"
                  ? "text-emerald-400"
                  : "text-amber-300"
              }`}
            >
              {!isWakeWordEnabled
                ? "Disabled"
                : wakeWordStatus === "listening"
                ? "Listening on mic"
                : "Active (Voice / Text)"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/40">Last Detected:</span>
            <span className="text-white/70">
              {lastWakeDetected
                ? new Date(lastWakeDetected).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "None yet"}
            </span>
          </div>
        </div>

        {/* Test Trigger Button */}
        <button
          id="test-wake-up-btn"
          onClick={handleTriggerTest}
          className={`w-full py-1.5 px-2 rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isTestTriggered
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-white/10 hover:bg-rose-600/40 text-white border border-white/10 hover:border-rose-400/40"
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>{isTestTriggered ? "Waking AIRA..." : "Test Wake-Up Trigger"}</span>
        </button>
      </div>

      {/* Model & State Info */}
      <div className="space-y-1.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
        <div className="flex justify-between">
          <span className="text-white/40">State:</span>
          <span className="text-emerald-400 font-bold">{state}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Emotion:</span>
          <span className="text-amber-300 font-semibold">{emotion}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Live Model:</span>
          <span className="text-rose-300 text-[10px] truncate max-w-[150px]">{liveModel}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/40">Voice Profile:</span>
          <span className="text-rose-300 font-semibold text-[10px] flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-rose-400" />
            {currentVoice === "Aoede" ? "Aoede (Mature Girlfriend)" : currentVoice}
          </span>
        </div>
        {onSelectVoice && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[9px] text-white/40">Voice Switch:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onSelectVoice("Aoede")}
                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                  currentVoice === "Aoede"
                    ? "bg-rose-500/40 text-rose-200 font-semibold border border-rose-400/30"
                    : "text-white/40 hover:text-white bg-white/5"
                }`}
                title="Aoede - Female Mature Girlfriend Voice"
              >
                Aoede (GF)
              </button>
              <button
                onClick={() => onSelectVoice("Kore")}
                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                  currentVoice === "Kore"
                    ? "bg-rose-500/40 text-rose-200 font-semibold border border-rose-400/30"
                    : "text-white/40 hover:text-white bg-white/5"
                }`}
                title="Kore - Female Calm Voice"
              >
                Kore
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/40">Reconnects:</span>
          <span>{reconnectCount}</span>
        </div>
      </div>

      {/* Audio Reactive Realtime Telemetry */}
      <div className="space-y-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-rose-400" />
            <span>Audio & Lip Sync</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-white/40">User In:</span>
            <span>{(userVolume * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${Math.min(100, userVolume * 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-white/40">AIRA Out:</span>
            <span>{(airaVolume * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-75"
              style={{ width: `${Math.min(100, airaVolume * 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-white/40">Mouth Openness:</span>
            <span>{(mouthOpenness * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.min(100, mouthOpenness * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tool Calls Log */}
      <div className="space-y-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Recent Tools</span>
        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[10px]">
          {toolEvents.length === 0 ? (
            <span className="text-white/20 italic">No tools invoked yet</span>
          ) : (
            toolEvents.slice(-4).map((t) => (
              <div key={t.id} className="flex justify-between text-white/70 bg-white/5 px-2 py-1 rounded">
                <span className="text-rose-300 font-semibold">{t.name}</span>
                <span className="text-white/30 text-[9px]">
                  {new Date(t.timestamp).toLocaleTimeString([], { second: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

