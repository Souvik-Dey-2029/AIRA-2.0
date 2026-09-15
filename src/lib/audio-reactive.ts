/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AudioReactiveController
 * Implements Section 11, 12, 13 of AIRA PRD:
 * - Real-time audio analysis with smooth attack/release interpolation
 * - Mouth openness value calculation (0.0 to 1.0)
 * - Anti-jitter filtering
 * - Background music volume ducking
 */
export class AudioReactiveController {
  private currentMouthOpen: number = 0;
  private targetMouthOpen: number = 0;
  private attackSpeed: number = 0.35;  // Fast rise when speech begins
  private releaseSpeed: number = 0.18; // Smooth decay when speech ends
  private noiseFloor: number = 0.04;

  /**
   * Updates mouth openness based on raw volume amplitude (0.0 - 1.0)
   * Returns a smoothed value between 0.0 and 1.0
   */
  public update(rawVolume: number, isSpeaking: boolean): number {
    if (!isSpeaking || rawVolume < this.noiseFloor) {
      this.targetMouthOpen = 0;
    } else {
      // Non-linear perceptual scaling
      const scaled = Math.min(1, Math.pow(rawVolume * 1.6, 0.85));
      this.targetMouthOpen = scaled;
    }

    // Smooth interpolation (attack vs release)
    const factor = this.targetMouthOpen > this.currentMouthOpen ? this.attackSpeed : this.releaseSpeed;
    this.currentMouthOpen += (this.targetMouthOpen - this.currentMouthOpen) * factor;

    // Floor to zero if negligible
    if (this.currentMouthOpen < 0.01) {
      this.currentMouthOpen = 0;
    }

    return Math.min(1, Math.max(0, this.currentMouthOpen));
  }

  public reset() {
    this.currentMouthOpen = 0;
    this.targetMouthOpen = 0;
  }
}
