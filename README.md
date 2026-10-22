<div align="center">

# 🎙️ VoiceDiary

**Capture a memory before it fades away.**
Record one short voice note a day, add a photo, a note, tags and a rating, and look back on your life through a calendar, a timeline and your bookmarked highlights.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Expo](https://img.shields.io/badge/Expo-SDK-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-TypeScript-61DAFB?logo=react&logoColor=black)
![SQLite](<https://img.shields.io/badge/Storage-SQLite_(local)-003B57?logo=sqlite>)

</div>

---

## Table of contents

- [About](#about)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Build an APK](#build-an-apk)
  - [Option A: EAS Build (recommended)](#option-a-eas-build-recommended)
  - [Option B: Build locally with Gradle](#option-b-build-locally-with-gradle)
  - [Install the APK on a phone](#install-the-apk-on-a-phone)
  - [Release to Google Play (AAB)](#release-to-google-play-aab)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## About

VoiceDiary is a mobile app for keeping a **voice-first daily journal**. Instead of typing, you speak for up to seven minutes about your day. Each day holds exactly one memory, so the habit stays small and easy to keep.

Everything is stored **on your device**. There is no account, no server and no cloud sync.

## Features

- 🎤 **Voice recording** for up to 7 minutes, with pause, resume, finish and discard. Recording pauses automatically if you leave the app, and stops at the 7-minute limit.
- 📅 **One memory per day.** Saving again for the same day replaces the old memory.
- 🕛 **"Previous day" mode.** Record yesterday's memory today if you prefer to reflect at the start of the next day.
- 🖼️ **Details for each memory:** a photo (cropped to a 4:5 portrait), a written note, up to 3 tags and a 1–10 rating. All of them are optional.
- ▶️ **Full-screen player** with a draggable progress bar, ±10 second skip, playback speed and bookmarking.
- 🔖 **Highlights.** Bookmark a memory and it appears in the Highlights tab.
- 🗓️ **Three ways to browse:** a monthly **Calendar**, a **Timeline** grouped by month (with tag filters) and **Highlights**.
- 📊 **Insights** from your ratings, tags, durations and streaks.
- 🔔 **Reminders** that skip a day once you have recorded it.
- 🌗 **Light, dark or system theme.**
- 🔒 **Offline and private.** Your audio, photos and text never leave your phone.

## Screenshots

> Add your screenshots to `docs/screenshots/` and update the paths below.

|            Today             |            Memories             |            Player             |            Insights             |
| :--------------------------: | :-----------------------------: | :---------------------------: | :-----------------------------: |
| `docs/screenshots/today.png` | `docs/screenshots/memories.png` | `docs/screenshots/player.png` | `docs/screenshots/insights.png` |

<!-- Example once you have images:
<p align="center">
  <img src="docs/screenshots/today.png" width="200" />
  <img src="docs/screenshots/memories.png" width="200" />
  <img src="docs/screenshots/player.png" width="200" />
</p>
-->

## Tech stack

| Area              | Technology                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Framework         | [Expo](https://expo.dev) + [React Native](https://reactnative.dev)                           |
| Language          | TypeScript                                                                                   |
| Navigation        | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based)                       |
| Audio             | [`expo-audio`](https://docs.expo.dev/versions/latest/sdk/audio/) (recording and playback)    |
| Database          | [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/) with versioned migrations |
| Key-value storage | `expo-sqlite/kv-store` (theme preference)                                                    |
| Icons             | `@expo/vector-icons` (Ionicons)                                                              |
| Visual effects    | `expo-linear-gradient`                                                                       |
| Build and release | [EAS Build](https://docs.expo.dev/build/introduction/)                                       |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or newer (LTS recommended)
- npm, yarn or pnpm
- A phone with the [Expo Go](https://expo.dev/go) app, **or** an Android emulator / iOS simulator
- For local Android builds: [Android Studio](https://developer.android.com/studio) and JDK 17

### Install and run

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/voicediary.git
cd voicediary

# 2. Install dependencies
npm install

# 3. Start the dev server
npx expo start
```

Then press `a` for Android, `i` for iOS (macOS only), or scan the QR code with Expo Go.

> **Note:** Some features, such as scheduled reminders and background audio behaviour, can behave differently or be limited in Expo Go. For the most accurate behaviour, use a development build:
>
> ```bash
> npx expo run:android      # builds and installs a dev build on a device/emulator
> ```

### Useful scripts

```bash
npx expo start              # start Metro
npx expo run:android        # build + run on Android
npx expo run:ios            # build + run on iOS (macOS only)
npx tsc --noEmit            # type-check
npx expo lint               # lint (if configured)
```

## Project structure

```text
.
├── app/                    # Screens and routes (Expo Router)
├── assets/                 # Images, backgrounds, default memory image, icons
├── components/
│   ├── AudioPlayer.tsx     # Inline player used on the Today card
│   ├── DetailsSheet.tsx    # Edit photo, note, tags, rating
│   └── memories/           # MemoryRow, MonthCalendar, …
├── hooks/
│   └── useMemories.ts      # Loads memories for the Memories tab
├── lib/
│   ├── db.ts               # SQLite open + migrations
│   ├── memories-repo.ts    # All database reads/writes
│   ├── memory.ts           # Types, constants, date helpers
│   ├── files.ts            # Stores audio/photos in app storage
│   ├── settings.ts         # User settings (e.g. "Previous day")
│   ├── reminders.ts        # Local notifications
│   └── theme.tsx           # Light/dark palettes + ThemeProvider
├── app.json                # Expo config
├── eas.json                # EAS build profiles
└── package.json
```

> Folder names reflect how the code imports its modules (`@/lib/...`, `@/components/...`). Adjust this section if you reorganise the project.

## Data model

Data lives in a local SQLite database (`voicediary.db`). The schema is managed by **versioned migrations** in `lib/db.ts`; the current version is stored in `PRAGMA user_version`.

| Table         | Purpose                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memories`    | One row per day (`date` is `UNIQUE`): audio path, duration (max 7 min), optional image path, description, rating (1–10), bookmark flag, timestamps |
| `tags`        | Unique tag names (case-insensitive). A default `general` tag is seeded                                                                             |
| `memory_tags` | Many-to-many link between memories and tags                                                                                                        |

Rules enforced by the database:

- One memory per calendar day.
- Duration between 0 and 420,000 ms (7 minutes).
- Rating between 1 and 10.
- At most **3 tags** per memory (enforced by a trigger).
- Deleting a memory removes its tag links automatically.

Audio and photos are copied into the app's document folder, grouped by day, and referenced by relative path in the database.

**Changing the schema?** Never edit an existing migration. Append a new entry to the `MIGRATIONS` array in `lib/db.ts`.

---

## Build an APK

An **APK** is the file you can install directly on an Android phone. An **AAB** (Android App Bundle) is the format Google Play requires. This project can produce both.

### Option A: EAS Build (recommended)

EAS builds your app in the cloud, so you don't need Android Studio. A free Expo account is enough.

**1. Install the EAS CLI and sign in**

```bash
npm install -g eas-cli
eas login
```

**2. Configure the project (first time only)**

```bash
eas build:configure
```

This creates `eas.json`. Edit it so the `preview` profile produces an **APK**:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**3. Set a unique Android package name** in `app.json`:

```json
{
  "expo": {
    "name": "VoiceDiary",
    "slug": "voicediary",
    "android": {
      "package": "com.yourname.voicediary"
    }
  }
}
```

**4. Make sure the microphone permission is declared** (Expo adds `RECORD_AUDIO` through the audio plugin, but you can be explicit):

```json
{
  "expo": {
    "android": {
      "permissions": ["RECORD_AUDIO"]
    }
  }
}
```

**5. Build the APK**

```bash
eas build --platform android --profile preview
```

When the build finishes (usually 10–20 minutes), EAS prints a **download link and QR code** for the `.apk`. On the first build, let EAS generate and manage the Android keystore for you.

### Option B: Build locally with Gradle

Use this if you want a build on your own machine with no cloud service.

**Requirements:** JDK 17, Android Studio (for the Android SDK), and the `ANDROID_HOME` environment variable pointing to your SDK.

**1. Generate the native Android project**

```bash
npx expo prebuild --platform android
```

**2. Create a signing key (once, and keep it safe)**

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore voicediary-release.keystore \
  -alias voicediary -keyalg RSA -keysize 2048 -validity 10000
```

Move `voicediary-release.keystore` to `android/app/`.

**3. Add your signing config.** In `android/gradle.properties` (do **not** commit this file with real passwords):

```properties
VOICEDIARY_STORE_FILE=voicediary-release.keystore
VOICEDIARY_STORE_PASSWORD=your-store-password
VOICEDIARY_KEY_ALIAS=voicediary
VOICEDIARY_KEY_PASSWORD=your-key-password
```

Then in `android/app/build.gradle`, inside `android { ... }`:

```groovy
signingConfigs {
    release {
        storeFile file(VOICEDIARY_STORE_FILE)
        storePassword VOICEDIARY_STORE_PASSWORD
        keyAlias VOICEDIARY_KEY_ALIAS
        keyPassword VOICEDIARY_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

**4. Build**

```bash
cd android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
```

Your APK will be at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

You can also run the EAS pipeline on your own machine with `eas build --platform android --profile preview --local` (Linux or macOS).

> ⚠️ **Keep your keystore and passwords safe and backed up.** If you lose the key you used to publish, you cannot update the same app on Google Play. Never commit `*.keystore` or passwords to Git. Add them to `.gitignore`.

### Install the APK on a phone

1. Copy the `.apk` to your phone (USB, cloud drive, or the EAS download link).
2. Open it. If asked, allow **"Install unknown apps"** for the app you're using to open the file.
3. Tap **Install**.

Or install over USB with the Android Debug Bridge:

```bash
adb install -r path/to/voicediary.apk
```

### Release to Google Play (AAB)

Google Play needs an **App Bundle**, not an APK:

```bash
eas build --platform android --profile production
eas submit --platform android          # optional: upload to Play Console
```

You'll need a [Google Play Developer account](https://play.google.com/console) and a privacy policy URL. VoiceDiary stores everything locally, which keeps that policy simple, but the app does request microphone access, so declare it in the store listing.

### Bumping versions for new releases

Before each release, update `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",
    "android": { "versionCode": 2 }
  }
}
```

`version` is what users see. `versionCode` must increase with every upload to Google Play. With EAS you can also set `"appVersionSource": "remote"` and `"autoIncrement": true` in `eas.json` to have it handled for you.

---

## Privacy

- All memories (audio, photos, notes, tags, ratings) are stored **only on your device**.
- The app has no accounts, analytics or network backend.
- The microphone is used only while you are recording.
- Uninstalling the app deletes its data. There is no cloud backup, so back up your phone if your memories matter to you.

## Troubleshooting

| Problem                                                       | Fix                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Cannot find module 'expo-linear-gradient'`                   | Run `npx expo install expo-linear-gradient`                                                       |
| Recording does nothing / no permission prompt                 | Allow the microphone in system settings, then retry. Use a real device if the emulator has no mic |
| Reminders don't fire in Expo Go                               | Use a development build: `npx expo run:android`                                                   |
| Build fails with a Java error                                 | Use **JDK 17** and set `JAVA_HOME`                                                                |
| `SDK location not found`                                      | Set `ANDROID_HOME` or create `android/local.properties` with `sdk.dir=/path/to/Android/Sdk`       |
| APK won't install ("App not installed")                       | Uninstall any older build signed with a different key, then install again                         |
| Metro cache issues                                            | `npx expo start -c`                                                                               |
| Native changes not picked up after editing `app.json` plugins | `npx expo prebuild --clean`                                                                       |

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/my-change`
2. Make your changes and run `npx tsc --noEmit`
3. Commit with a clear message
4. Open a pull request describing what changed and why

For database changes, **append a migration** rather than editing an old one. Please open an issue first for large features.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

```text
Copyright (c) 2026 <Your Name>
```

---

<div align="center">

Made with ❤️ so that no day goes unremembered.

</div>
