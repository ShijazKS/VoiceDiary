import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

/**
 * App lock: PIN or pattern (+ optional biometrics).
 *
 * - The secret is never stored. Only a salted SHA-256 hash goes into SecureStore
 *   (iOS Keychain / Android Keystore-backed storage).
 * - A PIN is the digits ("1234"); a pattern is the dot numbers 0–8 ("01258").
 * - Wrong guesses are throttled: after 5 in a row the wait doubles each time (30s → 1h).
 *
 * Be aware: this locks the APP. The recordings and database files are not encrypted on disk.
 */

export type LockType = 'pin' | 'pattern';
export const PIN_LENGTH = 4;
export const MIN_PATTERN_DOTS = 4;

const CRED_KEY = 'voicediary.lock'; // SecureStore: { type, salt, hash }
const FLAG_KEY = 'lock-enabled'; // kv-store flag. Wiped on uninstall (see getLockType)
const FAILS_KEY = 'lock-fails';
const UNTIL_KEY = 'lock-until';
const BIO_KEY = 'lock-biometrics';
const AFTER_KEY = 'lock-after';

type Stored = { type: LockType; salt: string; hash: string };

const readStored = (): Stored | null => {
  try {
    const raw = SecureStore.getItem(CRED_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
};

/** Current lock type, or null when no lock is set. Safe to call synchronously. */
export function getLockType(): LockType | null {
  const stored = readStored();
  if (!stored) return null;
  // iOS keeps Keychain items after an app is uninstalled, but our flag (and all data) is wiped.
  // Without this check a reinstall would lock you out of an empty app.
  if (Storage.getItemSync(FLAG_KEY) !== '1') {
    SecureStore.deleteItemAsync(CRED_KEY).catch(() => {});
    return null;
  }
  return stored.type;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const hashSecret = (salt: string, secret: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${secret}`);

export async function setCredential(type: LockType, secret: string) {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await hashSecret(salt, secret);
  await SecureStore.setItemAsync(CRED_KEY, JSON.stringify({ type, salt, hash } satisfies Stored));
  Storage.setItemSync(FLAG_KEY, '1');
  clearFails();
}

export async function removeLock() {
  await SecureStore.deleteItemAsync(CRED_KEY);
  Storage.removeItemSync(FLAG_KEY);
  Storage.removeItemSync(BIO_KEY);
  clearFails();
}

/* ------------------------------ verification ------------------------------ */

function clearFails() {
  Storage.removeItemSync(FAILS_KEY);
  Storage.removeItemSync(UNTIL_KEY);
}

export const lockoutRemainingMs = () => Math.max(0, Number(Storage.getItemSync(UNTIL_KEY) ?? 0) - Date.now());

export type VerifyResult = { ok: true } | { ok: false; retryAfterMs: number };

export async function verifyCredential(secret: string): Promise<VerifyResult> {
  const wait = lockoutRemainingMs();
  if (wait > 0) return { ok: false, retryAfterMs: wait };

  const stored = readStored();
  if (!stored) return { ok: true };

  if ((await hashSecret(stored.salt, secret)) === stored.hash) {
    clearFails();
    return { ok: true };
  }

  const fails = Number(Storage.getItemSync(FAILS_KEY) ?? 0) + 1;
  Storage.setItemSync(FAILS_KEY, String(fails));
  let retryAfterMs = 0;
  if (fails >= 5) {
    retryAfterMs = Math.min(30_000 * 2 ** (fails - 5), 3_600_000);
    Storage.setItemSync(UNTIL_KEY, String(Date.now() + retryAfterMs));
  }
  return { ok: false, retryAfterMs };
}

/* -------------------------------- biometrics ------------------------------- */

export const getBiometricsEnabled = () => Storage.getItemSync(BIO_KEY) === '1';
export const setBiometricsEnabled = (on: boolean) =>
  on ? Storage.setItemSync(BIO_KEY, '1') : Storage.removeItemSync(BIO_KEY);

export async function isBiometricAvailable() {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

let busy = false;
let externalBusy = false;
let endedAt = 0;
/**
 * True while (and just after) a system screen is showing (biometric prompt, file picker, share sheet),
 * so using it doesn't count as "leaving the app" and doesn't trigger the lock.
 */
export const biometricRecentlyUsed = () => busy || externalBusy || Date.now() - endedAt < 1500;

/** Wrap anything that opens another screen on top of the app (picker, share sheet…). */
export async function whileExternalUi<T>(fn: () => Promise<T>): Promise<T> {
  externalBusy = true;
  try {
    return await fn();
  } finally {
    externalBusy = false;
    endedAt = Date.now();
  }
}

export async function authenticateBiometric(prompt = 'Unlock VoiceDiary') {
  busy = true;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true, // the fallback is OUR PIN / pattern
    });
    return res.success;
  } catch {
    return false;
  } finally {
    busy = false;
    endedAt = Date.now();
  }
}

/* --------------------------------- auto-lock -------------------------------- */

export type AutoLock = 'now' | '1m' | '5m';
export const AUTO_LOCK_MS: Record<AutoLock, number> = { now: 0, '1m': 60_000, '5m': 300_000 };

export const getAutoLock = (): AutoLock => {
  const v = Storage.getItemSync(AFTER_KEY);
  return v === '1m' || v === '5m' ? v : 'now';
};
export const setAutoLock = (v: AutoLock) => Storage.setItemSync(AFTER_KEY, v);
export const getAutoLockMs = () => AUTO_LOCK_MS[getAutoLock()];