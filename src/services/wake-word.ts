/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WakeWordConfig } from "../types";

export type WakeWordStatus = "active" | "listening" | "inactive" | "unsupported";

export class WakeWordService {
  private config: WakeWordConfig;
  private recognition: any = null;
  private isRunning: boolean = false;
  private onWakeCallback?: (phrase: string) => void;
  private onStatusChangeCallback?: (status: WakeWordStatus) => void;
  private lastTriggerTime: number = 0;
  private restartTimeout: any = null;

  constructor(
    initialConfig?: Partial<WakeWordConfig>,
    onWake?: (phrase: string) => void,
    onStatusChange?: (status: WakeWordStatus) => void
  ) {
    this.config = {
      phrase: initialConfig?.phrase || localStorage.getItem("aira_wake_phrase") || "Hey AIRA",
      enabled: initialConfig?.enabled ?? (localStorage.getItem("aira_wake_enabled") !== "false"),
      matchMode: initialConfig?.matchMode || (localStorage.getItem("aira_wake_match_mode") as any) || "contains",
      lastDetected: undefined,
    };

    this.onWakeCallback = onWake;
    this.onStatusChangeCallback = onStatusChange;

    this.initSpeechRecognition();
  }

  public getConfig(): WakeWordConfig {
    return { ...this.config };
  }

  public setPhrase(phrase: string) {
    const trimmed = phrase.trim() || "Hey AIRA";
    this.config.phrase = trimmed;
    try {
      localStorage.setItem("aira_wake_phrase", trimmed);
    } catch {
      // ignore
    }
  }

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    try {
      localStorage.setItem("aira_wake_enabled", enabled ? "true" : "false");
    } catch {
      // ignore
    }

    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public setMatchMode(matchMode: "contains" | "exact") {
    this.config.matchMode = matchMode;
    try {
      localStorage.setItem("aira_wake_match_mode", matchMode);
    } catch {
      // ignore
    }
  }

  /**
   * Normalizes text by removing punctuation, extra spaces,
   * and normalizing common phonetic spellings of AIRA.
   */
  public normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Normalize common speech-to-text variations of AIRA
      .replace(/\b(ayra|eyra|aera|iera|ira|era|i-ra)\b/g, "aira");
  }

  /**
   * Checks if an utterance matches the configured wake-up phrase.
   */
  public matchesPhrase(utterance: string): boolean {
    if (!this.config.phrase.trim()) return false;
    const normUtterance = this.normalize(utterance);
    const normTarget = this.normalize(this.config.phrase);

    if (!normTarget) return false;

    if (this.config.matchMode === "exact") {
      return normUtterance === normTarget;
    }

    // Default "contains" mode
    return normUtterance.includes(normTarget);
  }

  /**
   * Evaluates text transcript (from Web Speech API or chat input)
   * and triggers wake-up if matching.
   */
  public checkTranscript(text: string): boolean {
    if (!this.config.enabled) return false;
    if (this.matchesPhrase(text)) {
      this.triggerWake(text);
      return true;
    }
    return false;
  }

  /**
   * Triggers the wake-up sequence with acoustic feedback and callbacks.
   */
  public triggerWake(detectedPhrase?: string) {
    const now = Date.now();
    // 2-second cooldown to prevent double firing
    if (now - this.lastTriggerTime < 2000) return;
    this.lastTriggerTime = now;
    this.config.lastDetected = now;

    // Play cheerful electronic chime
    this.playWakeChime();

    if (this.onWakeCallback) {
      this.onWakeCallback(detectedPhrase || this.config.phrase);
    }
  }

  /**
   * Plays a pleasant 2-tone melodic wake chime via Web Audio API.
   */
  public playWakeChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // Note 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.56);

      // Cleanup
      setTimeout(() => {
        try {
          ctx.close();
        } catch {
          // ignore
        }
      }, 700);
    } catch (e) {
      console.warn("Could not play wake chime:", e);
    }
  }

  /**
   * Initializes browser SpeechRecognition if available.
   */
  private initSpeechRecognition() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback("unsupported");
      }
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      // Multi-lingual support: English & Hindi
      this.recognition.lang = "en-IN";

      this.recognition.onstart = () => {
        this.isRunning = true;
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback("listening");
        }
      };

      this.recognition.onresult = (event: any) => {
        if (!this.config.enabled) return;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (this.matchesPhrase(transcript)) {
            console.log("Wake phrase recognized by SpeechRecognition:", transcript);
            this.triggerWake(this.config.phrase);
            break;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // Non-critical errors like 'no-speech' or 'aborted' are expected during silence
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        // Auto-restart if wake detection is enabled
        if (this.config.enabled) {
          if (this.restartTimeout) clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.config.enabled && !this.isRunning) {
              this.start();
            }
          }, 800);
        } else {
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback("inactive");
          }
        }
      };

      if (this.config.enabled) {
        this.start();
      }
    } catch (err) {
      console.warn("Speech recognition setup notice:", err);
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback("unsupported");
      }
    }
  }

  public start() {
    if (!this.recognition || this.isRunning) return;
    try {
      this.recognition.start();
      this.isRunning = true;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback("listening");
      }
    } catch (err: any) {
      // If already started, ignore
      if (err?.name !== "InvalidStateError") {
        console.warn("Wake word listener start notice:", err?.message || err);
      }
    }
  }

  public stop() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isRunning = false;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback("inactive");
    }
  }

  public destroy() {
    this.stop();
    this.recognition = null;
  }
}
