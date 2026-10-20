import { openDB, IDBPDatabase } from 'idb';

export interface Group {
  id?: number;
  name: string;
  icon: string; // Lucide icon name
  createdAt: number;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  plainText: string;
  groupId?: number; // Reference to Group
  type?: 'note' | 'song';
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'b-note-db';
const STORE_NAME = 'notes';
const GROUP_STORE = 'groups';
const STRESS_CACHE_STORE = 'stress_cache';
const SETTINGS_KEY = 'b-note-song-settings';

export interface ExtendedStressDB {
  version: number;
  source: string;
  stats?: {
    sourceWordforms: number;
    uniqueWords: number;
    stems: number;
    exact: number;
    multi: number;
    suffixRules: number;
  };
  s4: Record<string, number>;
  s3: Record<string, number>;
  stems: Record<string, number>;
  exact: Record<string, number>;
  multi: Record<string, number[]>;
}

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(GROUP_STORE)) {
          db.createObjectStore(GROUP_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STRESS_CACHE_STORE)) {
          db.createObjectStore(STRESS_CACHE_STORE);
        }
      }
    },
  });
}

export async function getCachedStressDB(): Promise<ExtendedStressDB | undefined> {
  try {
    const db = await initDB();
    return await db.get(STRESS_CACHE_STORE, 'nasu_v2');
  } catch (e) {
    console.warn('Failed to read stress DB from IndexedDB:', e);
    return undefined;
  }
}

export async function saveCachedStressDB(data: ExtendedStressDB): Promise<void> {
  try {
    const db = await initDB();
    await db.put(STRESS_CACHE_STORE, data, 'nasu_v2');
  } catch (e) {
    console.warn('Failed to cache stress DB in IndexedDB:', e);
  }
}

export function getSavedCustomDictionary(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.customDictionary === 'object' && parsed.customDictionary !== null) {
        return parsed.customDictionary;
      }
    }
  } catch (e) {
    console.error('Failed to read customDictionary from localStorage', e);
  }
  return {};
}

export async function saveNote(note: Note): Promise<number> {
  const db = await initDB();
  const id = await db.put(STORE_NAME, {
    ...note,
    type: note.type || 'note'
  });
  return id as number;
}

export async function deleteNote(id: number): Promise<void> {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await initDB();
  const notes = await db.getAllFromIndex(STORE_NAME, 'updatedAt');
  return notes.map(note => ({
    ...note,
    type: note.type || 'note'
  }));
}

export async function getNote(id: number): Promise<Note | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

export async function saveGroup(group: Group): Promise<number> {
  const db = await initDB();
  const id = await db.put(GROUP_STORE, group);
  return id as number;
}

export async function getAllGroups(): Promise<Group[]> {
  const db = await initDB();
  return db.getAll(GROUP_STORE);
}

export async function deleteGroup(id: number): Promise<void> {
  const db = await initDB();
  // Optional: move notes to "No Group" or delete them
  await db.delete(GROUP_STORE, id);
}

export async function importDatabase(data: {
  notes?: Note[];
  groups?: Group[];
  customDictionary?: Record<string, number>;
}): Promise<{ importedNotes: number; importedGroups: number; importedWords: number }> {
  const db = await initDB();
  let importedGroups = 0;
  let importedNotes = 0;
  let importedWords = 0;

  if (Array.isArray(data.groups)) {
    const txGroups = db.transaction(GROUP_STORE, 'readwrite');
    for (const group of data.groups) {
      if (group && typeof group.name === 'string') {
        await txGroups.store.put({
          ...group,
          createdAt: group.createdAt || Date.now(),
        });
        importedGroups++;
      }
    }
    await txGroups.done;
  }

  if (Array.isArray(data.notes)) {
    const txNotes = db.transaction(STORE_NAME, 'readwrite');
    for (const note of data.notes) {
      if (note && typeof note.title === 'string') {
        await txNotes.store.put({
          ...note,
          type: note.type || 'note',
          createdAt: note.createdAt || Date.now(),
          updatedAt: note.updatedAt || Date.now(),
        });
        importedNotes++;
      }
    }
    await txNotes.done;
  }

  if (data.customDictionary && typeof data.customDictionary === 'object') {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const currentSettings = raw ? JSON.parse(raw) : {};
      const existingDict = currentSettings.customDictionary || {};
      const mergedDict = { ...existingDict, ...data.customDictionary };
      importedWords = Object.keys(data.customDictionary).length;
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          ...currentSettings,
          customDictionary: mergedDict,
        })
      );
    } catch (e) {
      console.error('Failed to import customDictionary:', e);
    }
  }

  return { importedNotes, importedGroups, importedWords };
}

