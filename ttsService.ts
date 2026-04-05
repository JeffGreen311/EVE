// Piper TTS Service
// Calls your Piper FastAPI server and returns a local audio URI for expo-av

import * as FileSystem from 'expo-file-system';

export interface PiperConfig {
  serverUrl: string;       // e.g. http://your-railway-app.up.railway.app
  lengthScale: number;     // Speed: 0.5 (fast) → 2.0 (slow). Default 1.0
  noiseScale: number;      // Expressiveness: 0.0 (flat) → 1.0 (wild). Default 0.667
  noiseW: number;          // Phoneme/rhythm variation: 0.0 → 1.0. Default 0.8
  voiceModel: string;      // Piper voice model name on server
}

// Mood presets — tune these to match Eve's character
export const MOOD_PRESETS: Record<string, Partial<PiperConfig>> = {
  Calm: {
    lengthScale: 1.25,
    noiseScale: 0.3,
    noiseW: 0.5,
  },
  Warm: {
    lengthScale: 1.0,
    noiseScale: 0.65,
    noiseW: 0.75,
  },
  Assertive: {
    lengthScale: 0.85,
    noiseScale: 0.8,
    noiseW: 0.6,
  },
  Dreamy: {
    lengthScale: 1.45,
    noiseScale: 0.5,
    noiseW: 0.95,
  },
};

export async function synthesizeSpeech(
  text: string,
  config: PiperConfig
): Promise<string> {
  // Build query string
  const params = new URLSearchParams({
    text,
    length_scale: config.lengthScale.toFixed(2),
    noise_scale: config.noiseScale.toFixed(2),
    noise_w: config.noiseW.toFixed(2),
    voice: config.voiceModel || 'en_US-lessac-medium',
  });

  const url = `${config.serverUrl}/tts?${params.toString()}`;

  // Download audio to local cache
  const localUri = `${FileSystem.cacheDirectory}eve_response_${Date.now()}.wav`;

  const downloadResult = await FileSystem.downloadAsync(url, localUri);

  if (downloadResult.status !== 200) {
    throw new Error(`Piper TTS error: ${downloadResult.status}`);
  }

  return downloadResult.uri;
}

// Clean up old cached audio files
export async function clearAudioCache(): Promise<void> {
  try {
    const cacheDir = FileSystem.cacheDirectory ?? '';
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const audioFiles = files.filter(f => f.startsWith('eve_response_'));
    await Promise.all(
      audioFiles.map(f => FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true }))
    );
  } catch {}
}
