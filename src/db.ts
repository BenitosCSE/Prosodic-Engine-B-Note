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

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 2, {
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
        // Add index for groupId if needed, but we'll just filter for now or use getAll
      }
    },
  });
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
