import { Alert } from "@/lib/alert";
import {
  // DEFAULT_TAG,
  EMPTY_DETAILS,
  MAX_DESCRIPTION,
  MAX_TAGS,
  PHOTO_ASPECT,
  PHOTO_RATIO,
  normalizeTag,
  type Details,
} from "@/lib/memory";
import { getDefaultTag } from "@/lib/settings";
import { SERIF, useTheme, type Palette } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type DetailsSheetProps = {
  visible: boolean;
  /** Values the form starts with each time the sheet opens. */
  initial: Details;
  title?: string;
  /** Small line under the title, e.g. the memory's date. */
  subtitle?: string;
  /** Shows the "Delete memory" button when provided. */
  onDelete?: () => void;
  onClose: () => void;
  onSave: (details: Details) => void;
};

export default function DetailsSheet({
  visible,
  initial,
  title = "Add details",
  subtitle,
  onDelete,
  onClose,
  onSave,
}: DetailsSheetProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [form, setForm] = useState<Details>(EMPTY_DETAILS);
  const [tagText, setTagText] = useState("");

  // Reset the form from `initial` every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setForm({
        imageUri: initial.imageUri,
        description: initial.description,
        tags: [...initial.tags],
        rating: initial.rating,
      });
      setTagText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const tagsFull = form.tags.length >= MAX_TAGS;

  /** Adds the typed text as a tag. Returns the new list so Save can use it. */
  const commitTag = (text: string, current: string[]) => {
    const tag = normalizeTag(text);
    if (!tag || current.includes(tag) || current.length >= MAX_TAGS)
      return current;
    return [...current, tag];
  };

  const handleTagChange = (t: string) => {
    // typing a space or comma finishes the tag
    if (/[\s,]$/.test(t)) {
      setForm((f) => ({ ...f, tags: commitTag(t, f.tags) }));
      setTagText("");
    } else {
      setTagText(t);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photos needed",
        "Allow photo access in Settings to attach a picture.",
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: PHOTO_ASPECT,
    });
    if (!res.canceled) setForm((f) => ({ ...f, imageUri: res.assets[0].uri }));
  };

  const save = () =>
    onSave({
      ...form,
      description: form.description.trim(),
      tags: commitTag(tagText, form.tags), // include a tag that was typed but not confirmed
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Photo — cropped to the same portrait ratio the cards use */}
            <Text style={styles.label}>Photo</Text>
            <View style={styles.photoRow}>
              <Pressable
                onPress={pickPhoto}
                style={styles.photoFrame}
                accessibilityLabel={
                  form.imageUri ? "Change photo" : "Choose a photo"
                }
              >
                {form.imageUri ? (
                  <Image
                    source={{ uri: form.imageUri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons
                      name="image-outline"
                      size={28}
                      color={colors.photoFg}
                    />
                  </View>
                )}
              </Pressable>

              <View style={styles.photoSide}>
                <Pressable style={styles.photoAction} onPress={pickPhoto}>
                  <Ionicons
                    name={form.imageUri ? "swap-horizontal" : "add"}
                    size={16}
                    color={colors.photoFg}
                  />
                  <Text style={styles.photoActionText}>
                    {form.imageUri ? "Change photo" : "Choose a photo"}
                  </Text>
                </Pressable>

                {form.imageUri ? (
                  <Pressable
                    style={[styles.photoAction, styles.photoRemove]}
                    onPress={() => setForm((f) => ({ ...f, imageUri: null }))}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.danger}
                    />
                    <Text
                      style={[styles.photoActionText, { color: colors.danger }]}
                    >
                      Remove
                    </Text>
                  </Pressable>
                ) : null}

                <Text style={styles.photoHint}>
                  {form.imageUri
                    ? "Shown exactly like this on your memory card."
                    : "Optional. A default picture is used."}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              placeholder="What made today memorable?"
              placeholderTextColor={colors.hint}
              keyboardAppearance={isDark ? "dark" : "light"}
              multiline
              maxLength={MAX_DESCRIPTION}
              style={[styles.input, styles.multiline]}
            />

            {/* Tags */}
            <Text style={styles.label}>
              Tags ({form.tags.length}/{MAX_TAGS})
            </Text>
            <View style={styles.tagBox}>
              {form.tags.map((t) => (
                <Pressable
                  key={t}
                  style={styles.tagChip}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      tags: f.tags.filter((x) => x !== t),
                    }))
                  }
                  accessibilityLabel={`Remove tag ${t}`}
                >
                  <Text style={styles.tagChipText}>#{t}</Text>
                  <Ionicons name="close" size={14} color={colors.tagText} />
                </Pressable>
              ))}
              {!tagsFull && (
                <TextInput
                  value={tagText}
                  onChangeText={handleTagChange}
                  onSubmitEditing={() => {
                    setForm((f) => ({
                      ...f,
                      tags: commitTag(tagText, f.tags),
                    }));
                    setTagText("");
                  }}
                  placeholder={
                    form.tags.length
                      ? "Add another"
                      : `Add a tag (default #${getDefaultTag()})`
                  }
                  placeholderTextColor={colors.hint}
                  keyboardAppearance={isDark ? "dark" : "light"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  style={styles.tagInput}
                />
              )}
            </View>

            {/* Rating */}
            <Text style={styles.label}>
              How was the day? ({form.rating}/10)
            </Text>
            <View style={styles.ratingRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const on = form.rating === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setForm((f) => ({ ...f, rating: n }))}
                    style={[styles.ratingDot, on && styles.ratingDotOn]}
                  >
                    <Text
                      style={[styles.ratingDotText, on && { color: "#FFF" }]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>

            {onDelete && (
              <Pressable style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteText}>Delete memory</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(33,26,23,0.4)",
    },
    sheet: {
      maxHeight: "88%",
      paddingHorizontal: 20,
      paddingBottom: 28,
      paddingTop: 10,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: c.surface,
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.faint,
      marginBottom: 14,
    },
    title: { fontSize: 22, fontWeight: "700", fontFamily: SERIF, color: c.ink },
    subtitle: { marginTop: 2, fontSize: 14, color: c.muted },
    label: {
      marginTop: 18,
      marginBottom: 8,
      fontSize: 14,
      fontWeight: "600",
      color: c.body,
    },

    photoRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    photoFrame: {
      width: 112,
      aspectRatio: PHOTO_RATIO,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: c.photoBg,
    },
    photoImage: { width: "100%", height: "100%" },
    photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
    photoSide: { flex: 1, gap: 10 },
    photoAction: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.photoBg,
    },
    photoRemove: { backgroundColor: c.dangerBg },
    photoActionText: { fontSize: 14, fontWeight: "600", color: c.photoFg },
    photoHint: { fontSize: 12, lineHeight: 17, color: c.muted },

    input: {
      padding: 14,
      borderRadius: 14,
      fontSize: 15,
      color: c.ink,
      backgroundColor: c.chip,
    },
    multiline: { minHeight: 90, textAlignVertical: "top" },

    tagBox: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      padding: 8,
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: c.chip,
    },
    tagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.tagBg,
    },
    tagChipText: { fontSize: 13, color: c.tagText, fontWeight: "600" },
    tagInput: {
      flexGrow: 1,
      minWidth: 120,
      paddingVertical: 6,
      paddingHorizontal: 6,
      fontSize: 15,
      color: c.ink,
    },

    ratingRow: { flexDirection: "row", justifyContent: "space-between" },
    ratingDot: {
      width: 31,
      height: 31,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.ratingBg,
    },
    ratingDotOn: { backgroundColor: c.star },
    ratingDotText: { fontSize: 13, fontWeight: "600", color: c.ratingText },

    saveButton: {
      height: 52,
      marginTop: 24,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
    },
    saveText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
    deleteButton: {
      height: 48,
      marginTop: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteText: { fontSize: 15, fontWeight: "600", color: c.danger },
  });
