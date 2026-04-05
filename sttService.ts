// STT (Speech-to-Text) Service
// Records via expo-av, sends audio to a Whisper endpoint (or your Ollama/Qwen Audio)

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: '.wav',
      outputFormat: Audio.AndroidOutputFormat.DEFAULT,
      audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.wav',
      outputFormat: Audio.IOSOutputFormat.LINEARPCM,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {},
  });

  await recording.startAsync();
}

export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  return uri ?? null;
}

export async function transcribeAudio(
  audioUri: string,
  whisperEndpoint: string  // e.g. http://your-server/transcribe  OR leave empty for device STT fallback
): Promise<string> {
  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(`${whisperEndpoint}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_base64: base64,
      language: 'en',
    }),
  });

  if (!response.ok) {
    throw new Error(`STT error: ${response.status}`);
  }

  const data = await response.json();
  return (data.text ?? '').trim();
}

// Cleanup
export async function deleteAudioFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}
