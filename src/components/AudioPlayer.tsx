import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatTime } from '@/lib/memory';
import { useTheme, type Palette } from '@/lib/theme';

const BARS = Array.from({ length: 30 }, (_, i) => 8 + ((i * 37 + 11) % 22));

type Props = {
  uri: string;
  /** Used until the player reports the real duration. */
  fallbackDurationMs: number;
  style?: StyleProp<ViewStyle>;
};

/** Play/pause + waveform progress + time. Used on Today and the memory detail screen. */
export default function AudioPlayer({ uri, fallbackDurationMs, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const total = status.duration > 0 ? status.duration : fallbackDurationMs / 1000;
  const progress = total > 0 ? Math.min(status.currentTime / total, 1) : 0;

  const togglePlay = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true });
    if (total > 0 && status.currentTime >= total - 0.1) await player.seekTo(0);
    player.play();
  };

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={togglePlay}
        style={styles.playButton}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={20}
          color={colors.onBrand}
          style={{ marginLeft: status.playing ? 0 : 2 }}
        />
      </Pressable>

      <View style={styles.wave}>
        {BARS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: h, backgroundColor: i / BARS.length <= progress ? colors.brand : colors.faint },
            ]}
          />
        ))}
      </View>

      <Text style={styles.time}>
        {formatTime(status.currentTime)} / {formatTime(total)}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
    },
    wave: {
      flex: 1,
      height: 32,
      marginHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bar: { width: 3, borderRadius: 2 },
    time: { fontSize: 12, color: c.inkSoft, fontVariant: ['tabular-nums'] },
  });