// Settings Context
// Persists all Eve PTT configuration across app sessions

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVE_MODELS } from '../services/ollamaService';
import { MOOD_PRESETS } from '../services/ttsService';

const STORAGE_KEY = '@eve_settings';

export interface AppSettings {
  // Endpoints
  ollamaEndpoint: string;
  piperEndpoint: string;
  whisperEndpoint: string;

  // Model
  model: string;

  // LLM
  temperature: number;

  // Piper voice controls
  lengthScale: number;    // speed
  noiseScale: number;     // expressiveness
  noiseW: number;         // rhythm variation
  voiceModel: string;
  activeMood: string;

  // UI
  showTranscript: boolean;
}

const DEFAULTS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  piperEndpoint: 'http://localhost:5050',
  whisperEndpoint: 'http://localhost:5051',
  model: EVE_MODELS.EVE_3B,
  temperature: 0.65,
  lengthScale: 1.0,
  noiseScale: 0.65,
  noiseW: 0.75,
  voiceModel: 'en_US-lessac-medium',
  activeMood: 'Warm',
  showTranscript: true,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  applyMoodPreset: (mood: string) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType>({} as SettingsContextType);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored) {
        try {
          setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
        } catch {}
      }
    });
  }, []);

  const save = (next: AppSettings) => {
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    save({ ...settings, [key]: value });
  };

  const applyMoodPreset = (mood: string) => {
    const preset = MOOD_PRESETS[mood];
    if (preset) {
      save({ ...settings, ...preset, activeMood: mood });
    }
  };

  const resetToDefaults = () => save(DEFAULTS);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, applyMoodPreset, resetToDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
