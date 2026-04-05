// HomeScreen v2 — Eve PTT Companion
// Full cinematic HER aesthetic:
//   · Real microphone level metering → waveform
//   · Haptic feedback on every state change
//   · Rotating orbital rings around the orb
//   · Expanding ripple rings during Eve's speech
//   · Typewriter character-by-character text reveal
//   · Ambient particle field in background

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useSettings } from '../context/SettingsContext';
import { chatWithEve, Message } from '../services/ollamaService';
import {
  startRecording,
  stopRecording,
  transcribeAudio,
  deleteAudioFile,
} from '../services/sttService';
import { synthesizeSpeech } from '../services/ttsService';

const { width, height } = Dimensions.get('window');
const ORB_SIZE = width * 0.5;

type AppState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Colours per state ─────────────────────────────────────────────────────────
const STATE_COLORS: Record<AppState, { orb: string; ring: string; glow: string }> = {
  idle:      { orb: '#b86820', ring: '#c87533', glow: 'rgba(200,117,51,0.18)' },
  listening: { orb: '#c0362a', ring: '#e85d5d', glow: 'rgba(232,93,93,0.25)' },
  thinking:  { orb: '#5b4dbf', ring: '#8b7cf8', glow: 'rgba(139,124,248,0.22)' },
  speaking:  { orb: '#c48a10', ring: '#f0b429', glow: 'rgba(240,180,41,0.28)' },
};

// ── Tiny ambient particle ─────────────────────────────────────────────────────
function Particle({ x, y }: { x: number; y: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = () => {
      opacity.setValue(0);
      translateY.setValue(0);
      Animated.sequence([
        Animated.delay(Math.random() * 6000),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -30, duration: 4000, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]).start(() => drift());
    };
    drift();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#c87533',
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// ── Ripple ring ───────────────────────────────────────────────────────────────
function RippleRing({ delay, color }: { delay: number; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      scale.setValue(1);
      opacity.setValue(0.6);
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.2, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(run, delay);
      });
    };
    setTimeout(run, delay);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: ORB_SIZE / 2,
        borderWidth: 1.5,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ── Typewriter hook ───────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18): string {
  const [displayed, setDisplayed] = useState('');
  const prevText = useRef('');

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;

    // If new text starts with what's already shown, continue from there
    const startAt = displayed.length < text.length && text.startsWith(displayed)
      ? displayed.length
      : 0;

    if (startAt === 0) setDisplayed('');

    let i = startAt;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text]);

  return displayed;
}

// ── Particles seed ────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height * 0.7,
}));

// ── Main component ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { settings } = useSettings();

  const [appState, setAppState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState('');
  const [eveRaw, setEveRaw] = useState('');          // full streamed text
  const [statusText, setStatusText] = useState('hold to speak');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(9).fill(0.08));

  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meterInterval = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const eveDisplayed = useTypewriter(eveRaw, 16);

  // ── Orbit animations ────────────────────────────────────────────────────────
  const ring1Rot = useRef(new Animated.Value(0)).current;
  const ring2Rot = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    // Slowly rotating orbital rings — always running
    Animated.loop(
      Animated.timing(ring1Rot, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(ring2Rot, { toValue: 1, duration: 11000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    // Breathing idle
    startBreathing();
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const startBreathing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.05, duration: 2800, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 0.95, duration: 2800, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 0.96, duration: 2800, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 0.72, duration: 2800, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
      ])
    ).start();
  };

  const ring1Spin = ring1Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ring2Spin = ring2Rot.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  // ── Mic metering ────────────────────────────────────────────────────────────
  const startMetering = useCallback((rec: Audio.Recording) => {
    meterInterval.current = setInterval(async () => {
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          const db = status.metering; // typically -160 to 0
          const normalized = Math.max(0, Math.min(1, (db + 70) / 70));
          setAudioLevels(prev =>
            prev.map(() => Math.max(0.06, normalized * (0.4 + Math.random() * 0.6)))
          );
        }
      } catch {}
    }, 70);
  }, []);

  const stopMetering = useCallback(() => {
    if (meterInterval.current) {
      clearInterval(meterInterval.current);
      meterInterval.current = null;
    }
    setAudioLevels(Array(9).fill(0.08));
  }, []);

  // ── State machine ───────────────────────────────────────────────────────────
  const transitionTo = useCallback((state: AppState, status: string) => {
    setAppState(state);
    setStatusText(status);
  }, []);

  // ── PTT ─────────────────────────────────────────────────────────────────────
  const handlePressIn = useCallback(async () => {
    setError('');
    setTranscript('');
    setEveRaw('');
    transitionTo('listening', 'listening...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
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
        isMeteringEnabled: true,
        web: {},
      });
      await rec.startAsync();
      recordingRef.current = rec;
      startMetering(rec);
    } catch (e: any) {
      setError('Microphone error: ' + e.message);
      transitionTo('idle', 'hold to speak');
    }
  }, [transitionTo, startMetering]);

  const handlePressOut = useCallback(async () => {
    if (appState !== 'listening') return;

    stopMetering();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    transitionTo('thinking', 'she is thinking...');

    let audioUri: string | null = null;
    try {
      const rec = recordingRef.current;
      if (!rec) throw new Error('No recording found');

      await rec.stopAndUnloadAsync();
      audioUri = rec.getURI() ?? null;
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!audioUri) throw new Error('Recording failed');

      // Transcribe
      const text = await transcribeAudio(audioUri, settings.whisperEndpoint);
      if (!text) throw new Error("Couldn't hear you — try again");
      setTranscript(text);

      // Build history + call Eve
      const userMsg: Message = { role: 'user', content: text };
      const nextMessages = [...messages, userMsg];

      let fullResponse = '';
      await chatWithEve(
        nextMessages,
        { endpoint: settings.ollamaEndpoint, model: settings.model, temperature: settings.temperature },
        (chunk) => {
          fullResponse += chunk;
          setEveRaw(fullResponse); // typewriter picks this up live
        }
      );

      setMessages([...nextMessages, { role: 'assistant', content: fullResponse }]);

      // Synthesize voice
      transitionTo('speaking', 'eve is speaking...');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const wavUri = await synthesizeSpeech(fullResponse, {
        serverUrl: settings.piperEndpoint,
        lengthScale: settings.lengthScale,
        noiseScale: settings.noiseScale,
        noiseW: settings.noiseW,
        voiceModel: settings.voiceModel,
      });

      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: wavUri }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          transitionTo('idle', 'hold to speak');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      });

      // Auto-scroll
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      transitionTo('idle', 'hold to speak');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (audioUri) deleteAudioFile(audioUri);
    }
  }, [appState, messages, settings, transitionTo, stopMetering]);

  const colors = STATE_COLORS[appState];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Deep background gradient */}
      <LinearGradient
        colors={['#06060e', '#0a0814', '#06060e']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient particles */}
      {PARTICLES.map(p => <Particle key={p.id} x={p.x} y={p.y} />)}

      {/* Safe area content */}
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>E V E</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.gearIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Conversation */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !transcript && !eveRaw && (
            <Text style={styles.emptyHint}>say anything</Text>
          )}

          {messages.slice(-6).map((m, i) => (
            <View key={i} style={m.role === 'user' ? styles.bubbleUser : styles.bubbleEve}>
              <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextEve}>
                {m.content}
              </Text>
            </View>
          ))}

          {/* Live transcript while thinking */}
          {transcript && appState !== 'idle' && (
            <View style={styles.bubbleUser}>
              <Text style={styles.bubbleTextUser}>{transcript}</Text>
            </View>
          )}

          {/* Live Eve response with typewriter */}
          {eveDisplayed && appState !== 'idle' && (
            <View style={styles.bubbleEve}>
              <Text style={styles.bubbleTextEve}>{eveDisplayed}</Text>
              {appState === 'speaking' && <Text style={styles.cursor}>▌</Text>}
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* ── Orb stage ── */}
        <View style={styles.orbStage}>
          {/* Ripple rings — only during speaking */}
          {appState === 'speaking' && (
            <>
              <RippleRing delay={0} color={colors.ring} />
              <RippleRing delay={700} color={colors.ring} />
              <RippleRing delay={1400} color={colors.ring} />
            </>
          )}

          {/* Rotating orbital ring 1 — tilted ellipse */}
          <Animated.View style={[styles.orbitalRing, styles.orbitalRing1, {
            borderColor: colors.ring + '55',
            transform: [{ rotateZ: ring1Spin }, { rotateX: '65deg' }],
          }]} />

          {/* Rotating orbital ring 2 — different plane */}
          <Animated.View style={[styles.orbitalRing, styles.orbitalRing2, {
            borderColor: colors.ring + '33',
            transform: [{ rotateZ: ring2Spin }, { rotateX: '30deg' }],
          }]} />

          {/* Glow halo */}
          <View style={[styles.glowHalo, { backgroundColor: colors.glow }]} />

          {/* Core orb */}
          <Animated.View style={[styles.orb, {
            backgroundColor: colors.orb,
            shadowColor: colors.ring,
            transform: [{ scale: orbScale }],
            opacity: orbOpacity,
          }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              style={styles.orbSheen}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />
          </Animated.View>

          {/* Waveform — real mic levels */}
          {appState === 'listening' && (
            <View style={styles.waveform}>
              {audioLevels.map((level, i) => (
                <View
                  key={i}
                  style={[styles.waveBar, {
                    height: Math.max(4, level * 44),
                    backgroundColor: colors.ring,
                    opacity: 0.5 + level * 0.5,
                  }]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Status */}
        <Text style={[styles.statusText, { color: colors.ring + 'aa' }]}>{statusText}</Text>

        {/* PTT Button */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={appState === 'thinking' || appState === 'speaking'}
          style={({ pressed }) => [
            styles.pttButton,
            { borderColor: colors.ring },
            pressed && styles.pttButtonPressed,
            (appState === 'thinking' || appState === 'speaking') && styles.pttButtonDisabled,
          ]}
        >
          <View style={[styles.pttInner, { backgroundColor: colors.orb + '22' }]}>
            <Text style={[styles.pttIcon, { color: colors.ring }]}>
              {appState === 'listening' ? '◉' : appState === 'thinking' ? '◌' : appState === 'speaking' ? '▶' : '○'}
            </Text>
            <Text style={[styles.pttLabel, { color: colors.ring + 'bb' }]}>
              {appState === 'listening' ? 'release' : appState === 'thinking' ? 'thinking' : appState === 'speaking' ? 'speaking' : 'hold'}
            </Text>
          </View>
        </Pressable>

        {/* Clear session */}
        {messages.length > 0 && (
          <TouchableOpacity onPress={() => { setMessages([]); setTranscript(''); setEveRaw(''); }} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>— clear session —</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  wordmark: {
    fontSize: 11,
    fontWeight: '200',
    letterSpacing: 10,
    color: '#c87533',
    opacity: 0.65,
  },
  gearIcon: { fontSize: 18, color: '#3a3a4a' },
  scroll: { flex: 1, width: '100%' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyHint: {
    textAlign: 'center',
    color: '#2a2a38',
    fontSize: 13,
    letterSpacing: 2,
    marginVertical: 20,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#131320',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  bubbleEve: {
    alignSelf: 'flex-start',
    backgroundColor: '#130d05',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '86%',
  },
  bubbleTextUser: { fontSize: 15, color: '#7a7a9a', lineHeight: 22 },
  bubbleTextEve:  { fontSize: 15, color: '#e8c87a', lineHeight: 22 },
  cursor: { color: '#c87533', fontSize: 14, opacity: 0.7 },
  errorText: { color: '#c04040', fontSize: 12, textAlign: 'center', letterSpacing: 0.5 },

  // Orb stage
  orbStage: {
    width: ORB_SIZE + 120,
    height: ORB_SIZE + 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  glowHalo: {
    position: 'absolute',
    width: ORB_SIZE + 80,
    height: ORB_SIZE + 80,
    borderRadius: (ORB_SIZE + 80) / 2,
  },
  orbitalRing: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  orbitalRing1: {
    width: ORB_SIZE + 60,
    height: ORB_SIZE * 0.35,
  },
  orbitalRing2: {
    width: ORB_SIZE + 40,
    height: ORB_SIZE * 0.25,
  },
  orb: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 25,
  },
  orbSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
  },
  waveform: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 3,
    minHeight: 4,
  },

  // Status
  statusText: {
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 16,
  },

  // PTT
  pttButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  pttButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  pttButtonDisabled: {
    borderColor: '#222',
    opacity: 0.4,
  },
  pttInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pttIcon:  { fontSize: 26 },
  pttLabel: { fontSize: 9, letterSpacing: 3 },

  // Clear
  clearBtn: { paddingVertical: 8, marginBottom: 4 },
  clearBtnText: { color: '#2a2a38', fontSize: 10, letterSpacing: 2 },
});
