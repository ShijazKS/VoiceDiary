import { Alert as NativeAlert } from "react-native";

/**
 * Drop-in replacement for React Native's Alert.alert that renders a themed dialog.
 * Same call signature, so switching is just an import change:
 *
 *   - import { Alert } from 'react-native';
 *   + import { Alert } from '@/lib/alert';
 *
 * Needs <AlertHost /> mounted once in the root layout (components/AlertHost.tsx).
 * Without a host it falls back to the native alert, so nothing ever fails silently.
 */

export type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AlertOptions = {
  /** Tapping outside / Android back closes the dialog. Defaults to true when there is a cancel button. */
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type Listener = (request: AlertRequest) => void;

let listener: Listener | null = null;
let nextId = 1;

/** Used by <AlertHost />. Returns an unsubscribe function. */
export function subscribeAlerts(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) {
    if (!listener) {
      // host not mounted yet (very early in startup): use the system dialog
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    listener({
      id: nextId++,
      title,
      message,
      buttons: buttons && buttons.length ? buttons : [{ text: "OK" }],
      options,
    });
  },

  /** `if (await Alert.confirm({ title: 'Delete?', destructive: true })) { ... }` */
  confirm(opts: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }) {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        opts.title,
        opts.message,
        [
          {
            text: opts.cancelText ?? "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: opts.confirmText ?? "OK",
            style: opts.destructive ? "destructive" : "default",
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  },
};
