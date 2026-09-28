import * as Haptics from 'expo-haptics';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useApp } from './app';
import * as api from '@/lib/api';
import { DEMO, POLL_MS } from '@/lib/config';
import { DEMO_MESSAGES, demoStream } from '@/lib/demo';

export type Item = {
  key: string;
  id?: number;
  role: 'user' | 'assistant';
  text: string;
  thinking: string;
  ts: string;
  status?: 'sending' | 'streaming' | 'failed';
  thinkMs?: number;
  fresh?: boolean; // created in this session, animate its entrance
  error?: string;
};

type State = { items: Item[]; convId: string | null; hasMore: boolean; loading: boolean; busy: boolean };

type Action =
  | { t: 'loaded'; convId: string | null; items: Item[]; hasMore: boolean }
  | { t: 'older'; items: Item[]; hasMore: boolean }
  | { t: 'add'; items: Item[] }
  | { t: 'patch'; key: string; patch: Partial<Item> | ((i: Item) => Partial<Item>) }
  | { t: 'remove'; key: string }
  | { t: 'conv'; convId: string }
  | { t: 'busy'; busy: boolean };

const fromMessage = (m: api.Message): Item => ({
  key: `m${m.id}`,
  id: m.id,
  role: m.role,
  text: m.text || '',
  thinking: m.thinking || '',
  ts: m.timestamp,
});

const visible = (m: api.Message) =>
  (m.role === 'user' || m.role === 'assistant') && !m.activity && m.origin !== 'toy' && m.origin !== 'call_marker';

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'loaded':
      return { ...s, convId: a.convId, items: a.items, hasMore: a.hasMore, loading: false };
    case 'older':
      return { ...s, items: [...a.items, ...s.items], hasMore: a.hasMore };
    case 'add': {
      const known = new Set(s.items.map((i) => i.id).filter(Boolean));
      const add = a.items.filter((i) => !i.id || !known.has(i.id));
      return add.length ? { ...s, items: [...s.items, ...add] } : s;
    }
    case 'patch':
      return {
        ...s,
        items: s.items.map((i) =>
          i.key === a.key ? { ...i, ...(typeof a.patch === 'function' ? a.patch(i) : a.patch) } : i,
        ),
      };
    case 'remove':
      return { ...s, items: s.items.filter((i) => i.key !== a.key) };
    case 'conv':
      return { ...s, convId: a.convId };
    case 'busy':
      return { ...s, busy: a.busy };
  }
}

type ChatCtx = State & {
  send: (text: string) => void;
  stop: () => void;
  loadOlder: () => void;
  refresh: () => void;
  byKey: (key: string) => Item | undefined;
};

const Ctx = createContext<ChatCtx | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { signedIn, prefs, signOut, showToast } = useApp();
  const [s, dispatch] = useReducer(reducer, { items: [], convId: null, hasMore: false, loading: true, busy: false });
  const sref = useRef(s);
  useLayoutEffect(() => {
    sref.current = s;
  }, [s]);
  const abort = useRef<AbortController | null>(null);

  const onAuthLost = useCallback(
    (e: unknown) => {
      if (e instanceof api.AuthError) signOut();
      return e instanceof api.AuthError;
    },
    [signOut],
  );

  const load = useCallback(async () => {
    if (DEMO) {
      dispatch({ t: 'loaded', convId: 'demo', items: DEMO_MESSAGES.map(fromMessage), hasMore: false });
      return;
    }
    try {
      const convId = await api.mainConversationId();
      if (!convId) return dispatch({ t: 'loaded', convId: null, items: [], hasMore: false });
      const { messages, has_more } = await api.history(convId);
      dispatch({ t: 'loaded', convId, items: messages.filter(visible).map(fromMessage), hasMore: has_more });
    } catch (e) {
      if (!onAuthLost(e)) showToast("Couldn't load messages. Pull to retry.");
    }
  }, [onAuthLost, showToast]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const loadOlder = useCallback(async () => {
    const { convId, hasMore, items } = sref.current;
    const oldest = items.find((i) => i.id)?.id;
    if (DEMO || !convId || !hasMore || !oldest) return;
    try {
      const { messages, has_more } = await api.history(convId, oldest);
      dispatch({ t: 'older', items: messages.filter(visible).map(fromMessage), hasMore: has_more });
    } catch (e) {
      onAuthLost(e);
    }
  }, [onAuthLost]);

  // His proactive messages (wake-ups, reminders) only arrive through polling.
  const pollOnce = useCallback(async () => {
    const { convId, busy, items } = sref.current;
    if (DEMO || !convId || busy) return;
    const after = items.reduce((mx, i) => Math.max(mx, i.id ?? 0), 0);
    try {
      const { messages } = await api.poll(convId, after);
      const add = messages.filter((m) => visible(m) && m.role === 'assistant').map((m) => ({ ...fromMessage(m), fresh: true }));
      if (add.length) {
        dispatch({ t: 'add', items: add });
        Haptics.selectionAsync();
      }
    } catch (e) {
      onAuthLost(e);
    }
  }, [onAuthLost]);

  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(pollOnce, POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && pollOnce());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [signedIn, pollOnce]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      if (sref.current.busy) abort.current?.abort();
      const now = new Date().toISOString();
      const uKey = `u${Date.now()}`;
      const aKey = `a${Date.now()}`;
      dispatch({ t: 'add', items: [{ key: uKey, role: 'user', text, thinking: '', ts: now, status: 'sending', fresh: true }] });
      dispatch({ t: 'busy', busy: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const ctrl = new AbortController();
      abort.current = ctrl;
      let started = false;
      let thinkStart = 0;
      const ensureReply = () => {
        if (started) return;
        started = true;
        dispatch({ t: 'patch', key: uKey, patch: { status: undefined } });
        dispatch({ t: 'add', items: [{ key: aKey, role: 'assistant', text: '', thinking: '', ts: new Date().toISOString(), status: 'streaming', fresh: true }] });
      };
      let firstText = true;
      const handlers = {
        onThinking: (t: string) => {
          ensureReply();
          if (!thinkStart) thinkStart = Date.now();
          dispatch({ t: 'patch', key: aKey, patch: (i) => ({ thinking: i.thinking + t }) });
        },
        onDelta: (t: string) => {
          ensureReply();
          if (firstText) {
            firstText = false;
            Haptics.selectionAsync();
            if (thinkStart) dispatch({ t: 'patch', key: aKey, patch: { thinkMs: Date.now() - thinkStart } });
          }
          dispatch({ t: 'patch', key: aKey, patch: (i) => ({ text: i.text + t }) });
        },
      };

      try {
        if (DEMO) {
          await new Promise((r) => setTimeout(r, 700));
          ensureReply();
          await demoStream(text, handlers, ctrl.signal);
          dispatch({ t: 'patch', key: aKey, patch: { status: undefined } });
        } else {
          const ok = await api.streamChat(
            { message: text, conversation_id: sref.current.convId, model: prefs.model, effort: prefs.effort.toLowerCase() },
            {
              ...handlers,
              onConversation: (d) => {
                if (d.conversation_id) dispatch({ t: 'conv', convId: d.conversation_id });
                if (d.user_message_id) dispatch({ t: 'patch', key: uKey, patch: { id: d.user_message_id } });
              },
              onDone: (d) => {
                if (d.drop_row) return dispatch({ t: 'remove', key: aKey });
                dispatch({ t: 'patch', key: aKey, patch: { status: undefined, id: d.assistant_message_id } });
              },
              onError: (m) => {
                ensureReply();
                dispatch({ t: 'patch', key: aKey, patch: { status: 'failed', error: m } });
              },
            },
            ctrl.signal,
          );
          // The server keeps generating even if the stream drops (e.g. app backgrounded);
          // the next poll picks the finished reply up.
          if (!ok && !ctrl.signal.aborted) {
            dispatch({ t: 'remove', key: aKey });
            setTimeout(pollOnce, 4000);
          }
        }
      } catch (e) {
        if (ctrl.signal.aborted) {
          dispatch({ t: 'patch', key: aKey, patch: { status: undefined } });
        } else if (!onAuthLost(e)) {
          if (started) dispatch({ t: 'remove', key: aKey });
          dispatch({ t: 'patch', key: uKey, patch: { status: undefined } });
          showToast('Connection dropped. His reply will show up when it lands.');
          setTimeout(pollOnce, 4000);
        }
      } finally {
        if (abort.current === ctrl) {
          abort.current = null;
          dispatch({ t: 'busy', busy: false });
        }
      }
    },
    [prefs, onAuthLost, pollOnce, showToast],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    if (!DEMO) api.cancel();
  }, []);

  const byKey = useCallback((key: string) => sref.current.items.find((i) => i.key === key), []);

  const value = useMemo(
    () => ({ ...s, send, stop, loadOlder, refresh: load, byKey }),
    [s, send, stop, loadOlder, load, byKey],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useChat() {
  const v = use(Ctx);
  if (!v) throw new Error('useChat outside ChatProvider');
  return v;
}
