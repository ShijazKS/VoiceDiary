import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** One tab: name, label, and an outline/filled icon pair. */
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'home-outline', iconActive: 'home' },
  { name: 'memories', title: 'Memories', icon: 'search-outline', iconActive: 'search' },
  { name: 'insights', title: 'Insights', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
];

function TabIcon({
  focused,
  color,
  icon,
  iconActive,
}: {
  focused: boolean;
  color: ColorValue;
  icon: IconName;
  iconActive: IconName;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconPill, focused && { backgroundColor: colors.surfaceTint }]}>
      <Ionicons name={focused ? iconActive : icon} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,

        // Adapts to phones with and without a home indicator.
        tabBarStyle: {
          height: 69 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          ...Platform.select({
            ios: {
              shadowColor: colors.brand,
              shadowOpacity: 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: -4 },
            },
            default: { elevation: 12 },
          }),
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {TABS.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} color={color} icon={icon} iconActive={iconActive} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});