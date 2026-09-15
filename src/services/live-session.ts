/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AudioCapture, AudioStreamer } from "../lib/audio-manager";
import { SessionState } from "../types";

export class LiveSession {
  private ws: WebSocket | null = null;
  private audioCapture: AudioCapture | null = null;
  private audioStreamer: AudioStreamer | null = null;
  private stateChangeCallback: (state: SessionState) => void;
  private transcriptCallback?: (role: "user" | "model", text: string) => void;
  private toolCallCallback?: (name: string, args: any) => void;
  private errorCallback?: (errorMessage: string) => void;
  private micStatusCallback?: (active: boolean, message?: string) => void;
  private onUserVolumeCallback?: (volume: number) => void;
  
  public isMicActive: boolean = false;
  private isConnecting: boolean = false;
  private isFallbackMode: boolean = false;
  private history: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  private userName: string = "";
  private speechInterval: any = null;

  constructor(
    _apiKey: string, // Kept for interface backward-compatibility; backend uses secure server-side key
    onStateChange: (state: SessionState) => void,
    onUserVolume?: (volume: number) => void,
    onAiraVolume?: (volume: number) => void,
    onTranscript?: (role: "user" | "model", text: string) => void,
    onToolCall?: (name: string, args: any) => void,
    onError?: (errorMessage: string) => void,
    onMicStatus?: (active: boolean, message?: string) => void
  ) {
    this.stateChangeCallback = onStateChange;
    this.transcriptCallback = onTranscript;
    this.toolCallCallback = onToolCall;
    this.errorCallback = onError;
    this.micStatusCallback = onMicStatus;
    this.onUserVolumeCallback = onUserVolume;

    this.audioStreamer = new AudioStreamer();
    if (onAiraVolume) this.audioStreamer.onVolume = onAiraVolume;

    // Load persisted user name memory if previously learned
    try {
      this.userName = localStorage.getItem("aira_user_name") || "";
    } catch {
      this.userName = "";
    }

    this.setupAudioCapture();
  }

  private setupAudioCapture() {
    this.audioCapture = new AudioCapture(
      (base64) => {
        if (this.isMicActive) {
          if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isFallbackMode) {
            this.ws.send(JSON.stringify({ type: "audio", data: base64 }));
          }
        }
      },
      (vol) => {
        if (this.isMicActive && this.onUserVolumeCallback) {
          this.onUserVolumeCallback(vol);
        }
      }
    );
  }

  private async resumeContexts() {
    if (this.audioStreamer) {
      await this.audioStreamer.resume();
    }
  }

  public getInstantAiraVolume(): number {
    return this.audioStreamer?.getInstantVolume() || 0;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.stateChangeCallback("CONNECTING");
    await this.resumeContexts();

    // 1. Microphone capture initialization with graceful permission denial handling
    try {
      if (!this.audioCapture) {
        this.setupAudioCapture();
      }
      await this.audioCapture?.start();
      this.isMicActive = true;
      if (this.micStatusCallback) this.micStatusCallback(true);
    } catch (micErr: any) {
      this.isMicActive = false;
      const msg = micErr?.message || "Microphone not active; text interaction enabled.";
      console.warn("Microphone startup notice:", msg);
      if (this.micStatusCallback) this.micStatusCallback(false, msg);
    }

    // 2. Establish server WebSocket bridge
    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const savedVoice = localStorage.getItem("aira_voice") || "Aoede";
        const wsUrl = `${protocol}//${window.location.host}/ws/live?voice=${encodeURIComponent(savedVoice)}`;
        console.log("Connecting to AIRA WebSocket bridge:", wsUrl);

        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        const connectionTimeout = setTimeout(() => {
          if (this.isConnecting) {
            console.warn("WebSocket handshake timed out; activating resilient conversation mode.");
            this.activateFallbackMode();
            resolve();
          }
        }, 4000);

        socket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          console.log("Live session WebSocket connected");
          this.stateChangeCallback("IDLE");
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "ready") {
              this.stateChangeCallback("IDLE");
            } else if (msg.type === "fallback_mode") {
              console.warn("Live bridge switched to conversational fallback:", msg.message);
              this.activateFallbackMode();
            } else if (msg.type === "audio" && msg.data) {
              this.stateChangeCallback("SPEAKING");
              this.audioStreamer?.playChunk(msg.data);
            } else if (msg.type === "toolCall") {
              console.log("AIRA tool call received:", msg.name, msg.args);
              if (msg.name === "openWebsite" && msg.args?.url) {
                window.open(msg.args.url, "_blank");
              }
              if (this.toolCallCallback) {
                this.toolCallCallback(msg.name, msg.args);
              }
              this.sendToolResponse(msg.name, { success: true }, msg.id);
            } else if (msg.type === "transcript") {
              if (this.transcriptCallback && msg.text) {
                this.detectAndRememberName(msg.text, msg.role);
                this.transcriptCallback(msg.role, msg.text);
              }
            } else if (msg.type === "interrupted") {
              this.interrupt();
            } else if (msg.type === "turnComplete") {
              this.stateChangeCallback("IDLE");
            } else if (msg.type === "closed") {
              this.activateFallbackMode();
            }
          } catch (parseErr) {
            console.warn("Notice parsing live message:", parseErr);
          }
        };

        socket.onclose = () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          console.log("AIRA WebSocket connection closed; retaining fallback conversation state.");
          this.activateFallbackMode();
          resolve();
        };

        socket.onerror = () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          // Gracefully fallback without throwing console.error
          console.warn("AIRA WebSocket bridge notice: shifting to conversational voice fallback.");
          this.activateFallbackMode();
          resolve();
        };
      } catch (e) {
        this.isConnecting = false;
        console.warn("WebSocket bridge initialization notice:", e);
        this.activateFallbackMode();
        resolve();
      }
    });
  }

  private activateFallbackMode() {
    this.isFallbackMode = true;
    this.isConnecting = false;
    this.stateChangeCallback("IDLE");
  }

  /**
   * Memory & Name Recognition
   */
  private detectAndRememberName(text: string, role: "user" | "model") {
    if (role === "user") {
      const lower = text.toLowerCase();
      const match =
        text.match(/(?:mera naam|my name is|i am|call me|naam hai)\s+([A-Za-z\u0900-\u097F]+)/i) ||
        (lower.startsWith("i'm ") ? text.match(/i'm\s+([A-Za-z]+)/i) : null);
      if (match && match[1]) {
        const name = match[1].trim();
        this.userName = name.charAt(0).toUpperCase() + name.slice(1);
        try {
          localStorage.setItem("aira_user_name", this.userName);
        } catch {
          // ignore
        }
        console.log("AIRA remembered user name:", this.userName);
      }
    }
  }

  sendToolResponse(name: string, response: any, id?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isFallbackMode) {
      this.ws.send(
        JSON.stringify({
          type: "toolResponse",
          name,
          response,
          id,
        })
      );
    }
  }

  async sendTextMessage(text: string): Promise<string> {
    await this.resumeContexts();
    this.detectAndRememberName(text, "user");

    if (this.transcriptCallback) {
      this.transcriptCallback("user", text);
    }

    // If WebSocket Live session is active
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isFallbackMode) {
      this.ws.send(JSON.stringify({ type: "text", text }));
      this.stateChangeCallback("THINKING");
      return "";
    }

    // Resilient Fallback: Use server /api/chat with Gemini 3.8 Flash
    this.stateChangeCallback("THINKING");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: this.history,
          userName: this.userName,
        }),
      });

      const data = await res.json();
      const reply = data.text || "Main sun rahi hoon! Kuch aur poochna hai?";

      // Execute tool calls if returned
      if (data.functionCalls && Array.isArray(data.functionCalls)) {
        for (const call of data.functionCalls) {
          if (call.name === "openWebsite" && call.args?.url) {
            window.open(call.args.url, "_blank");
          }
          if (this.toolCallCallback) {
            this.toolCallCallback(call.name, call.args);
          }
        }
      }

      // Update conversational history
      this.history.push({ role: "user", parts: [{ text }] });
      this.history.push({ role: "model", parts: [{ text: reply }] });
      if (this.history.length > 20) {
        this.history = this.history.slice(-20);
      }

      if (this.transcriptCallback) {
        this.transcriptCallback("model", reply);
      }

      // Synthesize speech and drive character mouth animation
      this.speakFallbackAudio(reply);
      return reply;
    } catch (err: any) {
      console.warn("Fallback chat notice:", err?.message || err);
      this.stateChangeCallback("IDLE");
      const fallbackReply = "Arey re, internet thoda slow hai! Phir se bolo na? ✨";
      if (this.transcriptCallback) {
        this.transcriptCallback("model", fallbackReply);
      }
      return fallbackReply;
    }
  }

  /**
   * Plays spoken response in fallback mode and animates AIRA's mouth
   */
  private speakFallbackAudio(text: string) {
    if (!("speechSynthesis" in window)) {
      this.stateChangeCallback("IDLE");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Pick a warm, mature female Hindi or English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => (v.lang.startsWith("hi") || v.lang.startsWith("en-IN")) && (v.name.includes("Female") || v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Aditi"))) ||
      voices.find((v) => v.name.toLowerCase().includes("aoede") || v.name.toLowerCase().includes("kore")) ||
      voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Samantha") || v.name.includes("Victoria") || v.name.includes("Google UK English Female") || v.name.includes("Natural") || v.name.includes("Female") || v.name.includes("Serena") || v.name.includes("Karen"))) ||
      voices.find((v) => v.lang.startsWith("hi") || v.name.includes("India")) ||
      voices.find((v) => v.name.includes("Female")) ||
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.pitch = 0.97; // Mature, warm, velvety female girlfriend pitch
    utterance.rate = 1.0;   // Relaxed, natural, intimate tempo

    utterance.onstart = () => {
      this.stateChangeCallback("SPEAKING");
      // Simulate rhythmic vocal wave for mouth animation during speech
      if (this.speechInterval) clearInterval(this.speechInterval);
      let step = 0;
      this.speechInterval = setInterval(() => {
        step++;
        const volume = 0.2 + Math.abs(Math.sin(step * 0.45)) * 0.6;
        if (this.audioStreamer?.onVolume) {
          this.audioStreamer.onVolume(volume);
        }
      }, 50);
    };

    utterance.onend = () => {
      if (this.speechInterval) {
        clearInterval(this.speechInterval);
        this.speechInterval = null;
      }
      if (this.audioStreamer?.onVolume) {
        this.audioStreamer.onVolume(0);
      }
      this.stateChangeCallback("IDLE");
    };

    utterance.onerror = () => {
      if (this.speechInterval) {
        clearInterval(this.speechInterval);
        this.speechInterval = null;
      }
      if (this.audioStreamer?.onVolume) {
        this.audioStreamer.onVolume(0);
      }
      this.stateChangeCallback("IDLE");
    };

    window.speechSynthesis.speak(utterance);
  }

  public interrupt() {
    if (this.speechInterval) {
      clearInterval(this.speechInterval);
      this.speechInterval = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.audioStreamer?.interrupt();
    this.stateChangeCallback("LISTENING");
  }

  async enableMic(): Promise<boolean> {
    try {
      if (!this.audioCapture) {
        this.setupAudioCapture();
      }
      await this.audioCapture?.start();
      this.isMicActive = true;
      if (this.micStatusCallback) this.micStatusCallback(true);
      return true;
    } catch (err: any) {
      this.isMicActive = false;
      const msg = err?.message || "Microphone permission denied.";
      console.warn("Manual microphone activation notice:", msg);
      if (this.micStatusCallback) this.micStatusCallback(false, msg);
      return false;
    }
  }

  disableMic() {
    this.audioCapture?.stop();
    this.isMicActive = false;
    if (this.onUserVolumeCallback) this.onUserVolumeCallback(0);
    if (this.micStatusCallback) this.micStatusCallback(false);
  }

  async toggleMic(): Promise<boolean> {
    if (this.isMicActive) {
      this.disableMic();
      return false;
    } else {
      return await this.enableMic();
    }
  }

  disconnect() {
    this.isMicActive = false;
    if (this.speechInterval) {
      clearInterval(this.speechInterval);
      this.speechInterval = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.cleanup();
    this.stateChangeCallback("DISCONNECTED");
  }

  private cleanup() {
    this.isMicActive = false;
    try {
      this.audioCapture?.stop();
      this.audioStreamer?.stop();
    } catch {
      // ignore
    }
  }
}
