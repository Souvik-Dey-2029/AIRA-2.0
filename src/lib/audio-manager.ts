/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { base64EncodeAudio, base64ToFloat32, floatTo16BitPCM, resample } from "./audio-utils";

export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;

  constructor(
    public onAudioData: (base64: string) => void,
    public onVolume?: (volume: number) => void
  ) {}

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone access is not supported in this browser context.");
    }

    // Clean up any stale state first
    this.stop();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err: any) {
      console.warn("Microphone getUserMedia request returned:", err?.name || err?.message || err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError" || err?.message?.includes("Permission denied")) {
        throw new Error("Microphone permission was denied. Please allow microphone access in your browser or address bar icon.");
      }
      if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        throw new Error("No microphone was detected on your device. Please connect a microphone and try again.");
      }
      if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        throw new Error("Your microphone is currently in use by another application.");
      }
      throw new Error(err?.message || "Could not access microphone.");
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error("Web Audio API is not supported in this browser.");
    }

    try {
      this.context = new AudioCtx({ sampleRate: 16000 });
    } catch {
      this.context = new AudioCtx();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.stream = stream;
    this.source = this.context.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessorNode for simplicity in this environment
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (!this.context) return;
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Check if there is any actual sound
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const volume = Math.min(1, rms * 10); // scale slightly for visibility
      if (this.onVolume) this.onVolume(volume);

      // Data is resampled to 16000Hz if context sample rate differs
      const targetSampleRate = 16000;
      const currentSampleRate = this.context.sampleRate;
      const resampledData = (currentSampleRate === targetSampleRate)
        ? inputData
        : resample(inputData, currentSampleRate, targetSampleRate);

      const pcm16 = floatTo16BitPCM(resampledData);
      const base64 = base64EncodeAudio(pcm16);
      this.onAudioData(base64);
    };

    // Route processor through a muted gain node to avoid mic feedback into local speakers
    this.muteGain = this.context.createGain();
    this.muteGain.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.context.destination);
  }

  stop() {
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      this.muteGain?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      if (this.context && this.context.state !== "closed") {
        this.context.close();
      }
    } catch (e) {
      console.warn("Error during audio capture cleanup:", e);
    }
    
    this.processor = null;
    this.source = null;
    this.muteGain = null;
    this.stream = null;
    this.context = null;
  }
}

export class AudioStreamer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private volumeData: Uint8Array | null = null;
  private nextStartTime: number = 0;
  private sources: AudioBufferSourceNode[] = [];
  private volumeInterval: any = null;
  public onVolume?: (volume: number) => void;

  constructor() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.context = new AudioCtx({ sampleRate: 24000 });
    } catch {
      this.context = new AudioCtx();
    }
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.volumeData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.connect(this.context.destination);

    // Periodically update volume
    this.volumeInterval = setInterval(() => {
      if (this.analyser && this.onVolume && this.volumeData) {
        this.analyser.getByteFrequencyData(this.volumeData);
        let sum = 0;
        for (let i = 0; i < this.volumeData.length; i++) {
          sum += this.volumeData[i];
        }
        const average = sum / this.volumeData.length;
        this.onVolume(average / 128); // normalize 0-1 (roughly)
      }
    }, 50);
  }

  async resume() {
    if (this.context?.state === "suspended") {
      await this.context.resume();
    }
  }

  async playChunk(base64: string) {
    if (!this.context || !this.analyser) return;

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const float32 = base64ToFloat32(base64);
    const audioBuffer = this.context.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.context.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter(s => s !== source);
    };
  }

  interrupt() {
    this.sources.forEach(s => {
      try {
        s.stop();
        s.disconnect();
      } catch (e) {
        // Source might have already stopped
      }
    });
    this.sources = [];
    this.nextStartTime = 0;
  }

  stop() {
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    this.interrupt();
    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }
    this.context = null;
    this.analyser = null;
  }
}
