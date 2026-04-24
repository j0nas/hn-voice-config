export type Recognizer = {
  start: () => void;
  stop: () => void;
};

export type RecognizerCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (err: string) => void;
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WebSpeechCtor = new () => WebSpeechRecognition;

function getCtor(): WebSpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: WebSpeechCtor; webkitSpeechRecognition?: WebSpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttAvailable(): boolean {
  return getCtor() !== null;
}

export function createRecognizer(cb: RecognizerCallbacks): Recognizer {
  const Ctor = getCtor();
  if (!Ctor) {
    return {
      start: () => cb.onError('Web Speech API not available. Try Chrome.'),
      stop: () => undefined,
    };
  }
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'en-US';
  let final = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) cb.onInterim(interim);
  };
  rec.onerror = (e) => cb.onError(e.error);
  rec.onend = () => cb.onFinal(final.trim());
  return {
    start: () => {
      try {
        rec.start();
      } catch (e) {
        cb.onError(e instanceof Error ? e.message : String(e));
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {}
    },
  };
}
