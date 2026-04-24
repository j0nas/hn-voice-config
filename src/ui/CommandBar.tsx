import { useState, useRef, useEffect } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { useConfig } from '../state/useConfig';
import { requestAction, getConfiguredEndpoint } from '../llm/lmstudio';
import { dispatchAction } from '../state/dispatch';
import { PTTButton } from './PTTButton';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok'; summary: string }
  | { kind: 'error'; message: string };

export function CommandBar() {
  const cfg = useConfig((s) => s.config);
  const lastError = useConfig((s) => s.lastError);
  const reset = useConfig((s) => s.reset);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<TextInput>(null);
  const { model } = getConfiguredEndpoint();

  useEffect(() => {
    if (status.kind !== 'ok') return;
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 5000);
    return () => clearTimeout(t);
  }, [status]);

  async function send(utterance: string) {
    const trimmed = utterance.trim();
    if (!trimmed) return;
    setStatus({ kind: 'sending' });
    const result = await requestAction(cfg, trimmed);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    const summaries: string[] = [];
    for (const action of result.actions) {
      const d = dispatchAction(action);
      summaries.push(d.summary);
    }
    setStatus({ kind: 'ok', summary: summaries.join(' · ') });
    setText('');
  }

  const isSending = status.kind === 'sending';

  return (
    <View
      style={{
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: cfg.palette.muted + '33',
        backgroundColor: cfg.palette.background,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={`speak or type... (${model})`}
          placeholderTextColor={cfg.palette.muted}
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
          style={{
            flex: 1,
            color: cfg.palette.foreground,
            backgroundColor: cfg.palette.background,
            borderWidth: 1,
            borderColor: cfg.palette.muted + '55',
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={isSending || !text.trim()}
          style={{
            backgroundColor: cfg.palette.accent,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 6,
            opacity: isSending || !text.trim() ? 0.45 : 1,
          }}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600' }}>send</Text>
          )}
        </Pressable>
        <Pressable
          onPress={reset}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 9,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: cfg.palette.muted + '55',
          }}
        >
          <Text style={{ color: cfg.palette.muted, fontSize: 12 }}>reset</Text>
        </Pressable>
        <PTTButton onTranscript={send} />
      </View>
      {status.kind === 'ok' && (
        <Text style={{ color: cfg.palette.muted, fontSize: 11 }} selectable>
          ✓ {status.summary}
        </Text>
      )}
      {status.kind === 'error' && (
        <Text style={{ color: '#c0392b', fontSize: 12 }} selectable>
          {status.message}
        </Text>
      )}
      {lastError && status.kind !== 'error' && (
        <Text style={{ color: '#c0392b', fontSize: 12 }} selectable>
          {lastError}
        </Text>
      )}
    </View>
  );
}
