import { RecordingPresets, type RecordingOptions } from 'expo-audio';

/**
 * Speech-optimised recording: mono, 22.05 kHz, ~32 kbps AAC.
 * ≈ 0.25 MB per minute (the HIGH_QUALITY preset is roughly 1 MB per minute),
 * so a full 7-minute memory is ~2 MB and a whole year stays in the hundreds of MB.
 */
export const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
};