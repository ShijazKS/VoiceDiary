import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import RatingPicker from '@/components/RatingPicker';
import { SERIF, useTheme, type Palette } from '@/lib/theme';

type Props = {
  visible: boolean;
  initial: number;
  subtitle?: string;
  onClose: () => void;
  onSave: (rating: number) => void;
};

/** Small bottom sheet to change only the 1–10 rating. */
export default function RatingSheet({ visible, initial, subtitle, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [rating, setRating] = useState(initial);

  useEffect(() => {
    if (visible) setRating(initial);
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>How was the day?</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <RatingPicker value={rating} onChange={setRating} />

          <Pressable style={styles.save} onPress={() => onSave(rating)}>
            <Text style={styles.saveText}>Save rating</Text>
          </Pressable>
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
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.faint,
      marginBottom: 14,
    },
    title: { fontSize: 22, fontWeight: '700', fontFamily: SERIF, color: c.ink },
    subtitle: { marginTop: 2, fontSize: 14, color: c.muted },
    save: {
      height: 54,
      marginTop: 24,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    saveText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  });