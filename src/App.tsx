import React, { useState, useEffect, useRef } from 'react';
import { Search, Pencil, Download, Upload, Plus, Check } from 'lucide-react';
import { Note, Group, getAllNotes, saveNote, deleteNote, getAllGroups, importDatabase, getSavedCustomDictionary } from './db';
import { ensureExtendedStressDB } from './utils/prosodyEngine';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import SongEditor from './components/song/SongEditor';
import CreateButton from './components/CreateButton';

type View = 'list' | 'editor' | 'song-editor';

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
    ensureExtendedStressDB();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let [allNotes, allGroups] = await Promise.all([
        getAllNotes(),
        getAllGroups()
      ]);

      // Seed data if empty for the user's presentation
      if (allNotes.length === 0) {
        const now = Date.now();
        const seedNote: Note = {
          title: 'Презентація',
          content: `
            <h1>Презентація</h1>
            <h2>Progressive Web Application</h2>
            <h3>Prosodic Engine</h3>
            <p><strong>B-NoTe</strong></p>
            <p>B-NoTe - це унікальний записник, твій помічник, який завжди під рукою. Створений для тих, хто цінує естетику, швидкість та функціональність.</p>
          `,
          plainText: 'Презентація. Progressive Web Application. Prosodic Engine. B-NoTe - це унікальний записник...',
          type: 'note',
          createdAt: now,
          updatedAt: now,
        };
        await saveNote(seedNote);
        allNotes = await getAllNotes();
      }

      setNotes(allNotes.sort((a, b) => b.updatedAt - a.updatedAt));
      setGroups(allGroups);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setCurrentView('editor');
  };

  const handleCreateSong = () => {
    setEditingNote(null);
    setCurrentView('song-editor');
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    if (note.type === 'song') {
      setCurrentView('song-editor');
    } else {
      setCurrentView('editor');
    }
  };

  const handleSaveNote = async (noteData: Partial<Note>): Promise<number> => {
    const now = Date.now();
    const newNote: Note = {
      title: noteData.title || 'Untitled Note',
      content: noteData.content || '',
      plainText: noteData.plainText || '',
      groupId: noteData.groupId,
      type: noteData.type || 'note',
      createdAt: noteData.createdAt || now,
      updatedAt: now,
      ...(noteData.id ? { id: noteData.id } : {}),
    };

    const id = await saveNote(newNote);
    await loadData();
    
    // Update editingNote with the new ID so subsequent saves use the same record
    if (!noteData.id) {
      setEditingNote({ ...newNote, id });
    } else {
      setEditingNote(newNote);
    }

    // Don't automatically switch to list for song editor as it auto-saves
    if (currentView !== 'song-editor') {
      setCurrentView('list');
      setEditingNote(null);
    }
    return id;
  };

  const handleDeleteNote = async (id: number) => {
    await deleteNote(id);
    await loadData();
    setCurrentView('list');
    setEditingNote(null);
  };

  const handleExport = () => {
    const customDictionary = getSavedCustomDictionary();
    const exportData = {
      notes,
      groups,
      customDictionary,
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `b-note-full-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = Array.isArray(parsed) ? { notes: parsed } : parsed;

      const { importedNotes, importedGroups, importedWords } = await importDatabase(payload);
      await loadData();
      setImportStatus(
        `Відновлено: ${importedNotes} записів${importedGroups ? `, ${importedGroups} груп` : ''}${importedWords ? `, ${importedWords} наголосів` : ''}`
      );
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      console.error('Failed to import backup:', error);
      setImportStatus('Помилка читання JSON-файлу');
      setTimeout(() => setImportStatus(null), 3000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'editor':
        return (
          <NoteEditor 
            note={editingNote} 
            groups={groups}
            onSave={handleSaveNote} 
            onClose={() => setCurrentView('list')}
            onDelete={handleDeleteNote}
          />
        );
      case 'song-editor':
        return (
          <SongEditor 
            note={editingNote} 
            groups={groups}
            onSave={handleSaveNote} 
            onClose={() => setCurrentView('list')}
            onDelete={handleDeleteNote}
          />
        );
      default:
        return (
          <NoteList 
            notes={notes} 
            groups={groups} 
            onNoteClick={handleEditNote} 
            onGroupsUpdate={loadData}
            onDelete={handleDeleteNote}
            isSearchVisible={isSearchVisible}
            onSearchToggle={() => setIsSearchVisible(!isSearchVisible)}
          />
        );
    }
  };

  return (
    <div className="app-container pt-safe">
      {/* Background Watermark */}
      <div className="watermark">BENITO EUGENIO</div>

      {/* Header */}
      <header className="relative px-4 sm:px-8 pt-3 sm:pt-5 pb-3 sm:pb-5 text-center z-10 select-none">
        <div className="inline-flex flex-col items-center">
          <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.4em] sm:tracking-[0.45em] text-orange-accent/60 font-black mb-1">
            Acoustic Prosody Studio
          </span>
          <h1 className="text-3xl sm:text-5xl premium-title-effect">
            B-NOTE
          </h1>
        </div>
        <div className="w-28 sm:w-36 h-px bg-gradient-to-r from-transparent via-orange-accent/60 to-transparent mx-auto mt-2.5 sm:mt-3" />
      </header>

      {/* Import status badge */}
      {importStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-matte-black/95 border border-orange-accent/50 text-orange-accent text-xs font-bold shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <Check size={14} />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow overflow-hidden relative z-10">
        {renderContent()}
      </main>

      {/* Hidden File Input for JSON Restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Floating Luxury Glass Dock */}
      <nav className="fixed bottom-safe-dock left-1/2 -translate-x-1/2 z-40">
        <div className="luxury-dock px-4 sm:px-6 py-2 sm:py-2.5 rounded-3xl flex items-center gap-4 sm:gap-6">
          <button 
            onClick={() => {
              if (currentView !== 'list') {
                setCurrentView('list');
                setEditingNote(null);
                setIsSearchVisible(true);
              } else {
                setIsSearchVisible(!isSearchVisible);
              }
            }}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isSearchVisible && currentView === 'list'
                ? 'text-orange-accent bg-orange-accent/15 shadow-[0_0_15px_rgba(255,107,0,0.2)] scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Пошук"
          >
            <Search size={22} />
          </button>
          
          <CreateButton 
            onCreateNote={handleCreateNote}
            onCreateSong={handleCreateSong}
          />

          <div className="flex items-center gap-1">
            <button 
              onClick={handleExport}
              className="p-2.5 rounded-xl text-gray-400 hover:text-orange-accent hover:bg-white/5 transition-all cursor-pointer"
              title="Експортувати резервну копію (.json)"
            >
              <Download size={21} />
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl text-gray-400 hover:text-orange-accent hover:bg-white/5 transition-all cursor-pointer"
              title="Відновити базу з резервної копії (.json)"
            >
              <Upload size={21} />
            </button>
          </div>
        </div>
      </nav>

      {/* Loading Overlay */}
      {isLoading && currentView === 'list' && notes.length === 0 && (
        <div className="absolute inset-0 bg-matte-black z-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-accent/20 border-t-orange-accent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}



