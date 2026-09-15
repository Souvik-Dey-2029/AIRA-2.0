/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resamples a Float32Array from one sample rate to another.
 * Simple linear interpolation.
 */
export function resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return data;
  const ratio = fromRate / toRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    
    if (index + 1 < data.length) {
      result[i] = data[index] * (1 - fraction) + data[index + 1] * fraction;
    } else {
      result[i] = data[index];
    }
  }
  return result;
}

export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

/**
 * Converts Int16Array PCM data to Base64 string.
 */
export function base64EncodeAudio(pcm16Data: Int16Array): string {
  const uint8Array = new Uint8Array(pcm16Data.buffer);
  let binary = "";
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Decodes Base64 string to Float32Array for AudioContext playback.
 * Assumes input is PCM16 (signed 16-bit integer).
 */
export function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }
  return float32;
}
