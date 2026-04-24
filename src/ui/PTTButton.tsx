import { useRef, useState, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useConfig } from '../state/useConfig';
import { createRecognizer, type Recognizer, sttAvailable } from '../stt';

export function PTTButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const cfg = useConfig((s) => s.config);
  const recogRef = useRef<Recognizer | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const available = sttAvailable();

  useEffect(() => {
    return () => {
      recogRef.current?.stop();
    };
  }, []);

  const start = () => {
    if (!available || listening) return;
    setInterim('');
    const r = createRecognizer({
      onInterim: setInterim,
      onFinal: (text) => {
        recogRef.current = null;
        setListening(false);
        setInterim('');
        if (text.trim()) onTranscript(text);
      },
      onError: () => {
        recogRef.current = null;
        setListening(false);
        setInterim('');
      },
    });
    recogRef.current = r;
    r.start();
    setListening(true);
  };

  const stop = () => {
    recogRef.current?.stop();
  };

  if (!available) {
    return (
      <Pressable
        disabled
        style={{
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 6,
          backgroundColor: cfg.palette.muted + '33',
        }}
      >
        <Text style={{ color: cfg.palette.muted, fontSize: 12 }}>no mic</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 6,
          backgroundColor: listening ? '#c0392b' : cfg.palette.foreground,
          minWidth: 52,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: cfg.palette.background, fontWeight: '600' }}>
          {listening ? (interim ? '●' : 'rec') : 'hold'}
        </Text>
      </Pressable>

      {listening && (
        <View
          style={{
            position: 'absolute',
            bottom: 80,
            left: 20,
            right: 20,
            padding: 20,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderWidth: 2,
            borderColor: '#c0392b',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#ff6b6b', fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>
            LISTENING
          </Text>
          <Text style={{ color: '#fff', fontSize: 20, textAlign: 'center' }}>
            {interim || '…speak now'}
          </Text>
        </View>
      )}
    </>
  );
}
