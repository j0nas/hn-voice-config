import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useConfig } from './src/state/useConfig';
import { SLOT_DEFAULTS } from './src/config/schema';
import { evalToString } from './src/config/expr';
import { StoryList } from './src/ui/StoryList';
import { CommandBar } from './src/ui/CommandBar';

export default function App() {
  const cfg = useConfig((s) => s.config);
  const headerExpr = cfg.slots.header ?? SLOT_DEFAULTS.header;
  const header = evalToString(
    headerExpr,
    { now: Math.floor(Date.now() / 1000), feed: cfg.feed, storyLimit: cfg.storyLimit },
    '',
  ).value;
  return (
    <View style={{ flex: 1, backgroundColor: cfg.palette.background }}>
      {header !== '' && (
        <View
          style={[
            {
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: cfg.palette.accent,
            },
            cfg.style?.header,
          ]}
        >
          <Text style={[{ color: '#fff', fontWeight: '700' }, cfg.style?.header]}>{header}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <StoryList cfg={cfg} />
      </View>
      <CommandBar />
      <StatusBar style="auto" />
    </View>
  );
}
