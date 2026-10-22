import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PIN_LENGTH } from '@/lib/lock';
import { Palette, SERIF, useTheme } from '@/lib/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

type Props = {
  length?: number;
  disabled?: boolean;
  error?: boolean;
  /** Called once all digits are entered. The pad clears itself afterwards. */
  onComplete: (pin: string) => void;
};

export default function PinPad({ length = PIN_LENGTH, disabled, error, onComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState('');
  const done = useRef(onComplete);
  done.current = onComplete;

  useEffect(() => {
    if (value.length !== length) return;
    const t = setTimeout(() => {
      done.current(value);
      setValue('');
    }, 120); // lets the last dot fill in before clearing
    return () => clearTimeout(t);
  }, [value, length]);

  const press = (key: string) => {
    if (disabled || !key) return;
    setValue((v) => (key === 'back' ? v.slice(0, -1) : v.length < length ? v + key : v));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < value.length && { backgroundColor: error ? colors.danger : colors.brand, borderColor: 'transparent' },
              error && i >= value.length && { borderColor: colors.danger },
            ]}
          />
        ))}
      </View>

      <View style={[styles.grid, disabled && { opacity: 0.4 }]}>
        {KEYS.map((k, i) =>
          k ? (
            <Pressable
              key={i}
              onPress={() => press(k)}
              disabled={disabled}
              style={({ pressed }) => [styles.key, pressed && { opacity: 0.55 }]}
              accessibilityRole="button"
              accessibilityLabel={k === 'back' ? 'Delete' : k}
            >
              {k === 'back' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.ink} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          ) : (
            <View key={i} style={styles.keySpace} />
          ),
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    dots: { flexDirection: 'row', gap: 18, marginBottom: 36 },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: c.faint },
    grid: { width: 276, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
    key: {
      width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.surfaceTint,
    },
    keySpace: { width: 78, height: 78 },
    keyText: { fontSize: 30, fontFamily: SERIF, color: c.ink },
  });