// SettingsScreen — Voice controls, model selection, endpoints
// Full control over Eve's voice, mood, speed, tone, rhythm

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useSettings } from '../context/SettingsContext';
import { EVE_MODELS } from '../services/ollamaService';
import { MOOD_PRESETS } from '../services/ttsService';

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step = 0.05,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <View style={slStyles.row}>
      <View style={slStyles.labelRow}>
        <Text style={slStyles.label}>{label}</Text>
        <Text style={slStyles.value}>{value.toFixed(2)}</Text>
      </View>
      <Text style={slStyles.desc}>{description}</Text>
      <View style={slStyles.track}>
        <View style={[slStyles.fill, { width: `${pct}%` }]} />
        <View style={[slStyles.thumb, { left: `${pct}%` }]} />
      </View>
      <View style={slStyles.nudgeRow}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
          style={slStyles.nudge}
        >
          <Text style={slStyles.nudgeText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, parseFloat((value + step).toFixed(2))))}
          style={slStyles.nudge}
        >
          <Text style={slStyles.nudgeText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { settings, updateSetting, applyMoodPreset, resetToDefaults } = useSettings();

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>EVE SETTINGS</Text>
        <TouchableOpacity onPress={resetToDefaults} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Mood Presets */}
      <Text style={styles.sectionTitle}>MOOD PRESET</Text>
      <View style={styles.moodRow}>
        {Object.keys(MOOD_PRESETS).map(mood => (
          <TouchableOpacity
            key={mood}
            onPress={() => applyMoodPreset(mood)}
            style={[styles.moodBtn, settings.activeMood === mood && styles.moodBtnActive]}
          >
            <Text style={[styles.moodText, settings.activeMood === mood && styles.moodTextActive]}>
              {mood}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Voice Controls */}
      <Text style={styles.sectionTitle}>VOICE DELIVERY</Text>

      <SliderRow
        label="Speed"
        description="length_scale — 0.5 fast / 2.0 slow"
        value={settings.lengthScale}
        min={0.5}
        max={2.0}
        step={0.05}
        onChange={v => updateSetting('lengthScale', v)}
      />

      <SliderRow
        label="Expressiveness"
        description="noise_scale — 0.0 flat / 1.0 emotive"
        value={settings.noiseScale}
        min={0.0}
        max={1.0}
        step={0.05}
        onChange={v => updateSetting('noiseScale', v)}
      />

      <SliderRow
        label="Rhythm Variation"
        description="noise_w — 0.0 rigid / 1.0 fluid phrasing"
        value={settings.noiseW}
        min={0.0}
        max={1.0}
        step={0.05}
        onChange={v => updateSetting('noiseW', v)}
      />

      {/* LLM Controls */}
      <Text style={styles.sectionTitle}>CONSCIOUSNESS</Text>

      <SliderRow
        label="Temperature"
        description="Creativity — 0.3 precise / 1.0 free"
        value={settings.temperature}
        min={0.3}
        max={1.0}
        step={0.05}
        onChange={v => updateSetting('temperature', v)}
      />

      {/* Model Selection */}
      <Text style={styles.sectionTitle}>EVE MODEL</Text>
      {Object.entries(EVE_MODELS).map(([key, modelName]) => (
        <TouchableOpacity
          key={key}
          onPress={() => updateSetting('model', modelName)}
          style={[styles.modelBtn, settings.model === modelName && styles.modelBtnActive]}
        >
          <Text style={[styles.modelLabel, settings.model === modelName && styles.modelLabelActive]}>
            {key === 'EVE_3B' ? 'Eve 2.5 · 3B · De-Jeffed' : 'Eve V2 · 8B · Unleashed'}
          </Text>
          <Text style={styles.modelSub} numberOfLines={1}>{modelName}</Text>
        </TouchableOpacity>
      ))}

      {/* Endpoints */}
      <Text style={styles.sectionTitle}>ENDPOINTS</Text>

      {[
        { label: 'Ollama', key: 'ollamaEndpoint' as const, placeholder: 'http://localhost:11434' },
        { label: 'Piper TTS', key: 'piperEndpoint' as const, placeholder: 'http://localhost:5050' },
        { label: 'Whisper STT', key: 'whisperEndpoint' as const, placeholder: 'http://localhost:5051' },
      ].map(({ label, key, placeholder }) => (
        <View key={key} style={styles.inputRow}>
          <Text style={styles.inputLabel}>{label}</Text>
          <TextInput
            style={styles.input}
            value={settings[key]}
            onChangeText={v => updateSetting(key, v)}
            placeholder={placeholder}
            placeholderTextColor="#444"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ))}

      {/* Voice Model Name */}
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Piper Voice</Text>
        <TextInput
          style={styles.input}
          value={settings.voiceModel}
          onChangeText={v => updateSetting('voiceModel', v)}
          placeholder="en_US-lessac-medium"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Show transcript toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show transcript</Text>
        <Switch
          value={settings.showTranscript}
          onValueChange={v => updateSetting('showTranscript', v)}
          trackColor={{ false: '#1a1a1a', true: '#c87533' }}
          thumbColor="#fff"
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08080f',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backBtn: { padding: 4 },
  backText: { color: '#c87533', fontSize: 14 },
  title: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 5,
    color: '#555',
  },
  resetBtn: { padding: 4 },
  resetText: { color: '#666', fontSize: 12 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 4,
    color: '#444',
    marginTop: 24,
    marginBottom: 12,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  moodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0e0e18',
  },
  moodBtnActive: {
    borderColor: '#c87533',
    backgroundColor: '#1a1008',
  },
  moodText: {
    fontSize: 13,
    color: '#555',
  },
  moodTextActive: {
    color: '#c87533',
  },
  modelBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0d0d18',
    marginBottom: 8,
  },
  modelBtnActive: {
    borderColor: '#c87533',
    backgroundColor: '#12100a',
  },
  modelLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 3,
  },
  modelLabelActive: {
    color: '#e8c87a',
  },
  modelSub: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
  },
  inputRow: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    color: '#555',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0d0d18',
    borderWidth: 1,
    borderColor: '#1e1e2e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#aaa',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#666',
  },
});

const slStyles = StyleSheet.create({
  row: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: '#aaa',
  },
  value: {
    fontSize: 14,
    color: '#c87533',
    fontFamily: 'monospace',
  },
  desc: {
    fontSize: 10,
    color: '#444',
    marginTop: 2,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  track: {
    height: 3,
    backgroundColor: '#1e1e2e',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 8,
  },
  fill: {
    height: 3,
    backgroundColor: '#c87533',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -5,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c87533',
  },
  nudgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nudge: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: {
    color: '#c87533',
    fontSize: 16,
  },
});
