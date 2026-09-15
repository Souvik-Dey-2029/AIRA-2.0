/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SessionState = 
  | "DISCONNECTED" 
  | "CONNECTING" 
  | "IDLE" 
  | "LISTENING" 
  | "THINKING" 
  | "SPEAKING" 
  | "INTERRUPTED" 
  | "ERROR" 
  | "RECONNECTING";

export type AiraEmotion = 
  | "NEUTRAL" 
  | "HAPPY" 
  | "AMUSED" 
  | "PLAYFUL" 
  | "THOUGHTFUL" 
  | "CURIOUS" 
  | "SUPPORTIVE";

export interface NoteItem {
  id: string;
  content: string;
  type: 'SONG' | 'NOTE' | 'REMINDER' | 'STATUS' | 'FUNNY';
  timestamp: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  timestamp: number;
}

export interface AudioMetrics {
  userVolume: number;
  airaVolume: number;
  mouthOpenness: number;
  isMicActive: boolean;
}

export interface ToolExecutionEvent {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: number;
  summary?: string;
}

export interface WakeWordConfig {
  phrase: string;
  enabled: boolean;
  matchMode: "contains" | "exact";
  lastDetected?: number;
}
