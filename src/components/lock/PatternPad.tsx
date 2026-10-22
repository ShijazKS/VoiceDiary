import { useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';

import { MIN_PATTERN_DOTS } from '@/lib/lock';
import { Palette, useTheme } from '@/lib/theme';

const SIZE = 276;
const CELL = SIZE / 3;
const HIT = 36;
type Point = { x: number; y: number };

const center = (i: number): Point => ({ x: ((i % 3) + 0.5) * CELL, y: (Math.floor(i / 3) + 0.5) * CELL });
const hitTest = (x: number, y: number) => {
  for (let i = 0; i < 9; i++) {
    const c = center(i);
    if (Math.hypot(c.x - x, c.y - y) <= HIT) return i;
  }
  return -1;
};

type Props = {
  disabled?: boolean;
  error?: boolean;
  minDots?: number;
  /** Pattern as dot numbers, e.g. "01258". */
  onComplete: (pattern: string) => void;
  onTooShort?: () => void;
};

export default function PatternPad({ disabled, error, minDots = MIN_PATTERN_DOTS, onComplete, onTooShort }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [path, setPath] = useState<number[]>([]);
  const [finger, setFinger] = useState<Point | null>(null);

  const pathRef = useRef<number[]>([]);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ disabled, minDots, onComplete, onTooShort });
  latest.current = { disabled, minDots, onComplete, onTooShort };

  const addDot = (i: number) => {
    const current = pathRef.current;
    if (i < 0 || current.includes(i)) return;
    const next = [...current];
    if (current.length) {
      // Dragging across a dot in a straight line (e.g. 0 → 2) also selects the one in between.
      const a = current[current.length - 1];
      const dr = Math.floor(i / 3) - Math.floor(a / 3);
      const dc = (i % 3) - (a % 3);
      if (dr % 2 === 0 && dc % 2 === 0 && (Math.abs(dr) === 2 || Math.abs(dc) === 2)) {
        const mid = (Math.floor(a / 3) + dr / 2) * 3 + (a % 3) + dc / 2;
        if (!next.includes(mid)) next.push(mid);
      }
    }
    next.push(i);
    pathRef.current = next;
    setPath(next);
  };

  const finish = () => {
    const p = pathRef.current;
    setFinger(null);
    if (!p.length) return;
    if (p.length < latest.current.minDots) latest.current.onTooShort?.();
    else latest.current.onComplete(p.join(''));
    clearTimer.current = setTimeout(() => {
      pathRef.current = [];
      setPath([]);
    }, 700);
  };

  const touch = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    setFinger({ x, y });
    addDot(hitTest(x, y));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: (e) => {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        pathRef.current = [];
        setPath([]);
        touch(e);
      },
      onPanResponderMove: touch,
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }),
  ).current;

  const tone = error ? colors.danger : colors.brand;
  const points = path.map(center);

  return (
    <View style={[styles.area, disabled && { opacity: 0.4 }]} {...pan.panHandlers}>
      {/* pointerEvents none → touches always report coordinates relative to the area */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {points.slice(1).map((p, i) => (
          <Line key={i} a={points[i]} b={p} color={tone} />
        ))}
        {finger && points.length > 0 && path.length < 9 ? <Line a={points[points.length - 1]} b={finger} color={tone} /> : null}

        {Array.from({ length: 9 }, (_, i) => {
          const c = center(i);
          const on = path.includes(i);
          return (
            <View key={i} style={[styles.slot, { left: c.x - 20, top: c.y - 20 }]}>
              {on ? <View style={[styles.halo, { backgroundColor: tone }]} /> : null}
              <View style={[styles.dot, on ? { backgroundColor: tone, borderColor: tone } : { borderColor: colors.faint }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Line({ a, b, color }: { a: Point; b: Point; color: string }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return (
    <View
      style={{
        position: 'absolute',
        left: (a.x + b.x) / 2 - len / 2,
        top: (a.y + b.y) / 2 - 2,
        width: len,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        opacity: 0.75,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    area: { width: SIZE, height: SIZE, overflow: 'hidden' },
    slot: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: 40, height: 40, borderRadius: 20, opacity: 0.18 },
    dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  });