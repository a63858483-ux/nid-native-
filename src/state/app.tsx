import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AuthError, login, setToken } from '@/lib/api';
import { registerPush, unregisterPush } from '@/lib/push';
import { DEMO } from '@/lib/config';
import { clearToken, DEFAULT_PREFS, loadPrefs, loadToken, savePrefs, saveToken, type Prefs } from '@/lib/storage';

type AppCtx = {
  ready: boolean;
  signedIn: boolean;
  signIn: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  toast: string | null;
  showToast: (text: string) => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    (async () => {
      // A Keychain failure (e.g. an unsigned simulator build) must not keep the splash up forever.
      const [t, p] = await Promise.all([loadToken().catch(() => null), loadPrefs()]);
      setPrefsState(p);
      if (t) setToken(t);
      setSignedIn(DEMO || !!t);
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (password: string) => {
    const t = await login(password);
    setToken(t);
    await saveToken(t).catch(() => {});
    setSignedIn(true);
  }, []);

  // Every signed-in launch reports the device's push token (it can change between installs).
  useEffect(() => {
    if (signedIn) registerPush();
  }, [signedIn]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    setToken(null);
    await clearToken().catch(() => {});
    setSignedIn(false);
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const value = useMemo(() => ({ ready, signedIn, signIn, signOut, prefs, setPrefs, toast, showToast }), [ready, signedIn, signIn, signOut, prefs, setPrefs, toast, showToast]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useApp() {
  const v = use(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

export { AuthError };
