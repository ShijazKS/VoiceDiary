import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SERIF, useTheme, type Palette } from '@/lib/theme';

type Props = {
  visible: boolean;
  hour: number;
  minute: number;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
};

const toDate = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/** Android: the system time dialog. iOS: a themed bottom sheet with a wheel picker. */
export default function TimePickerModal({ visible, hour, minute, onCancel, onConfirm }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState(() => toDate(hour, minute));

  useEffect(() => {
    if (visible) setValue(toDate(hour, minute));
  }, [visible, hour, minute]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    DateTimePickerAndroid.open({
      value: toDate(hour, minute),
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onConfirm(date.getHours(), date.getMinutes());
        else onCancel();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (Platform.OS === 'android') return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Reminder time</Text>

          <DateTimePicker
            value={value}
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={colors.ink}
            onChange={(_, d) => d && setValue(d)}
            style={{ height: 180 }}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={[styles.btnText, { color: colors.onTint }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
            >
              <Text style={[styles.btnText, { color: '#FFF' }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 32,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: c.surface,
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.faint, marginBottom: 14 },
    title: { fontSize: 22, fontWeight: '700', fontFamily: SERIF, color: c.ink, marginBottom: 6 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    btn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { backgroundColor: c.surfaceTint },
    btnText: { fontSize: 16, fontWeight: '700' },
  });