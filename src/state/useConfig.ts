import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  configSchema,
  defaultConfig,
  mergeConfig,
  type Config,
  type ConfigPatch,
} from '../config/schema';

type State = {
  config: Config;
  lastError: string | null;
  applyPatch: (patch: ConfigPatch) => void;
  reset: () => void;
  setError: (e: string | null) => void;
};

export const useConfig = create<State>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      lastError: null,
      applyPatch: (patch) => {
        const next = mergeConfig(get().config, patch);
        const parsed = configSchema.safeParse(next);
        if (!parsed.success) {
          const msg = parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ');
          set({ lastError: `invalid config: ${msg}` });
          return;
        }
        set({ config: parsed.data, lastError: null });
      },
      reset: () => set({ config: defaultConfig, lastError: null }),
      setError: (e) => set({ lastError: e }),
    }),
    {
      name: 'hn-voice-ast-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ config: s.config }),
      version: 1,
    },
  ),
);
