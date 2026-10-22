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
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Privacy](#privacy)
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
git clone https://github.com/ShijazKS/VoiceDiary.git
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


## Privacy

- All memories (audio, photos, notes, tags, ratings) are stored **only on your device**.
- The app has no accounts, analytics or network backend.
- The microphone is used only while you are recording.
- Uninstalling the app deletes its data. There is no cloud backup, so back up your phone if your memories matter to you.

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
Copyright (c) 2026 shijazks
```

---

<div align="center">

Made with ❤️ so that no day goes unremembered.

</div>
