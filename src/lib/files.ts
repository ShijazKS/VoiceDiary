import { Directory, File, Paths } from 'expo-file-system';

/**
 * Layout inside the app's documents folder:
 *   memories/2026-10-06/voice.m4a
 *   memories/2026-10-06/image-<timestamp>.jpg
 *
 * The database stores RELATIVE paths ("memories/2026-10-06/voice.m4a").
 * On iOS the app's absolute path changes between updates, so absolute
 * paths saved in a database would break.
 */
const ROOT = 'memories';

const dayDir = (date: string) => new Directory(Paths.document, ROOT, date);

/** Relative path from the database → absolute uri you can play/display. */
export const resolvePath = (relative: string) => new File(Paths.document, relative).uri;

const extensionOf = (uri: string, fallback: string) => {
  const m = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : fallback;
};

/** Copies a temporary file (recording / picked photo) into permanent storage. */
export function storeFile(date: string, sourceUri: string, baseName: string, fallbackExt: string) {
  const dir = dayDir(date);
  dir.create({ intermediates: true, idempotent: true });

  const name = `${baseName}.${extensionOf(sourceUri, fallbackExt)}`;
  const dest = new File(dir, name);
  if (dest.exists) dest.delete();
  new File(sourceUri).copy(dest);

  return `${ROOT}/${date}/${name}`; // relative path to save in SQLite
}

export function removeFile(relative: string) {
  try {
    const f = new File(Paths.document, relative);
    if (f.exists) f.delete();
  } catch {}
}

export function removeDayFolder(date: string) {
  try {
    const d = dayDir(date);
    if (d.exists) d.delete();
  } catch {}
}
/** Deletes every stored recording and photo (used by "Clear all data"). */
export function removeAllFiles() {
  try {
    const d = new Directory(Paths.document, ROOT);
    if (d.exists) d.delete();
  } catch {}
}