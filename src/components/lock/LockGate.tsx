import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import LockScreen from '@/components/lock/LockScreen';
import { biometricRecentlyUsed, getAutoLockMs, getLockType, type LockType } from '@/lib/lock';
import { useTheme } from '@/lib/theme';

type LockContextValue = {
  /** Current lock type (null = no lock). */
  type: LockType | null;
  /** Call after setting, changing or removing the lock. */
  refresh: () => void;
  /** Lock immediately. */
  lockNow: () => void;
};

const LockContext = createContext<LockContextValue>({ type: null, refresh: () => {}, lockNow: () => {} });
export const useLock = () => useContext(LockContext);

/**
 * Wrap the whole app (inside ThemeProvider). It:
 *  - shows the lock screen on launch and when returning after the auto-lock time,
 *  - hides the app content in the app switcher,
 *  - keeps the app mounted underneath, so your place isn't lost after unlocking.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [type, setType] = useState<LockType | null>(getLockType);
  const [locked, setLocked] = useState(type !== null);
  const [covered, setCovered] = useState(false);
  const typeRef = useRef(type);
  typeRef.current = type;
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!typeRef.current) return;
      if (state === 'active') {
        setCovered(false);
        const at = leftAt.current;
        leftAt.current = null;
        if (at !== null && !biometricRecentlyUsed() && Date.now() - at >= getAutoLockMs()) setLocked(true);
      } else {
        setCovered(true); // 'inactive' (app switcher, control centre) and 'background'
        if (state === 'background' && leftAt.current === null) leftAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<LockContextValue>(
    () => ({
      type,
      refresh: () => {
        const next = getLockType();
        setType(next);
        if (!next) setLocked(false);
      },
      lockNow: () => {
        if (typeRef.current) setLocked(true);
      },
    }),
    [type],
  );

  return (
    <LockContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>

      {type && locked ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <LockScreen
            type={type}
            onUnlock={() => setLocked(false)}
            onReset={() => {
              setType(null);
              setLocked(false);
            }}
          />
        </View>
      ) : null}

      {type && covered && !locked ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      ) : null}
    </LockContext.Provider>
  );
}