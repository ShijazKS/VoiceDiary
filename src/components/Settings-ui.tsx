import { Palette, SERIF, useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Shared building blocks for the Settings and Security screens. */

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const useSettingsStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
};

export function Section({ title }: { title: string }) {
  const styles = useSettingsStyles();
  return <Text style={styles.section}>{title}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const styles = useSettingsStyles();
  return (
    <View style={styles.card}>
      {Children.toArray(children).map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export function Row({
  icon, title, subtitle, right, onPress, danger, soon,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  /** Placeholder for a feature that isn't built yet: dimmed, not tappable. */
  soon?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useSettingsStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || soon}
      style={({ pressed }) => [styles.row, soon && { opacity: 0.55 }, pressed && { opacity: 0.6 }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled: !!soon }}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.brand} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {soon ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>Soon</Text>
        </View>
      ) : (
        right
      )}
      {onPress && !soon ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; icon: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useSettingsStyles();
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && { backgroundColor: colors.brand }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={o.icon} size={18} color={active ? colors.onBrand : colors.inkSoft} />
            <Text style={[styles.segText, { color: active ? colors.onBrand : colors.inkSoft }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
    },
    topTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '700', color: c.ink },
    section: { marginTop: 24, marginBottom: 10, fontSize: 22, fontFamily: SERIF, fontWeight: '700', color: c.ink },
    card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 54 },
    caption: { marginTop: 8, marginHorizontal: 4, fontSize: 13, lineHeight: 18, color: c.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '500', color: c.ink },
    rowSub: { marginTop: 2, fontSize: 13, color: c.muted },
    value: { fontSize: 15, color: c.inkSoft },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: c.surfaceTint },
    pillText: { fontSize: 12, fontWeight: '600', color: c.inkSoft },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.surfaceTint,
    },
    stepValue: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.ink, fontVariant: ['tabular-nums'] },
    tagField: {
      width: 124, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
      borderRadius: 12, backgroundColor: c.chip,
    },
    hash: { fontSize: 15, fontWeight: '600', color: c.tagText },
    tagInput: { flex: 1, paddingVertical: 8, paddingLeft: 2, fontSize: 15, color: c.ink },
    segment: { flexDirection: 'row', padding: 6, gap: 6 },
    segItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 11, borderRadius: 11,
    },
    segText: { fontSize: 14, fontWeight: '600' },
  });