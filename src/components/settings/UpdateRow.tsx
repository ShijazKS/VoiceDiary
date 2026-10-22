import { Row } from "@/components/Settings-ui";
import { Alert } from "@/lib/alert";
import {
  checkForUpdates,
  describeUpdate,
  getUpdateState,
  useUpdateState,
} from "@/lib/remote";
import { useTheme } from "@/lib/theme";
import { useState } from "react";
import { ActivityIndicator, Linking } from "react-native";
/** "Check for updates" row for the About card. Only talks to the network when tapped. */
export default function UpdateRow() {
  const { colors } = useTheme();
  const update = useUpdateState();
  const [checking, setChecking] = useState(false);

  const subtitle = update.available
    ? `Version ${update.info!.latestVersion} is available`
    : update.checkedAt
      ? `You’re on the latest version · checked ${new Date(update.checkedAt).toLocaleDateString()}`
      : "See if a newer version is available";

  const check = async () => {
    setChecking(true);
    const result = await checkForUpdates();
    setChecking(false);

    if (result === "not-configured") {
      return Alert.alert(
        "Not set up yet",
        "Add your GitHub username in lib/remote.ts to turn on update checks.",
      );
    }
    if (result === "failed") {
      return Alert.alert(
        "Couldn’t check for updates",
        "Check your internet connection and try again in a little while.",
      );
    }

    const now = describeUpdate(getUpdateState());
    if (!now.available || !now.info) {
      return Alert.alert(
        "You’re up to date",
        `VoiceDiary ${now.current} is the latest version.`,
      );
    }
    const notes = now.info.notes.length
      ? `\n\n${now.info.notes.map((n) => `• ${n}`).join("\n")}`
      : "";
    Alert.alert(
      `Version ${now.info.latestVersion} is available`,
      `You have ${now.current}.${notes}`,
      [
        { text: "Later", style: "cancel" },
        {
          text: "Download",
          onPress: () => Linking.openURL(now.info!.downloadUrl),
        },
      ],
    );
  };

  return (
    <Row
      icon="refresh-circle-outline"
      title="Check for updates"
      subtitle={subtitle}
      right={checking ? <ActivityIndicator color={colors.brand} /> : undefined}
      onPress={checking ? undefined : check}
    />
  );
}
