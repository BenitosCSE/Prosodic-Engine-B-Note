import React, { useState, useMemo } from 'react';
import { 
  Search as SearchIcon, FileText, Clock, 
  Folder, Plus, Tag, Briefcase, Heart, Star, 
  Coffee, Zap, Trash2, LayoutGrid, Music, Disc3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Note, Group, saveGroup, deleteGroup } from '../db';
import { SongContent } from './song/types';

interface NoteListProps {
  notes: Note[];
  groups: Group[];
  onNoteClick: (note: Note) => void;
  onGroupsUpdate: () => void;
  onDelete: (id: number) => void;
  isSearchVisible: boolean;
  onSearchToggle: () => void;
}

const GROUP_ICONS = [
  { name: 'Folder', icon: Folder },
  { name: 'Tag', icon: Tag },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Coffee', icon: Coffee },
  { name: 'Zap', icon: Zap },
];

function extractSongPassport(note: Note): { bpm: number; beats: number; lineCount: number; preview: string } | null {
  if (note.type !== 'song' || !note.content) return null;
  try {
    const parsed: SongContent = JSON.parse(note.content);
    const lyricRows = (parsed.rows || []).filter(r => !r.isSection && r.text.trim().length > 0);
    return {
      bpm: parsed.settings?.bpm || 120,
      beats: parsed.settings?.beats || 4,
      lineCount: lyricRows.length,
      preview: lyricRows[0]?.text.replace(/\u0301/g, '') || '',
    };
  } catch {
    return null;
  }
}

const NoteList: React.FC<NoteListProps> = ({ 
  notes, groups, onNoteClick, onGroupsUpdate, onDelete, isSearchVisible 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all' | 'songs'>('all');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('Folder');
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null);

  const filteredNotes = useMemo(() => {
    let result = notes;
    
    if (selectedGroupId === 'songs') {
      result = result.filter(note => note.type === 'song');
    } else if (selectedGroupId !== 'all') {
      result = result.filter(note => note.groupId === selectedGroupId);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note => 
        note.title.toLowerCase().includes(query) || 
        note.plainText.toLowerCase().includes(query)
      );
    }

    return result;
  }, [notes, searchQuery, selectedGroupId]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await saveGroup({
      name: newGroupName,
      icon: newGroupIcon,
      createdAt: Date.now(),
    });
    setNewGroupName('');
    setIsCreatingGroup(false);
    onGroupsUpdate();
  };

  const handleDeleteGroup = async (id: number) => {
    await deleteGroup(id);
    if (selectedGroupId === id) setSelectedGroupId('all');
    onGroupsUpdate();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIconComponent = (iconName: string) => {
    const found = GROUP_ICONS.find(i => i.name === iconName);
    const IconComp = found ? found.icon : Folder;
    return <IconComp size={15} />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <AnimatePresence>
        {isSearchVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="px-4 sm:px-6 lg:px-8 pb-2 overflow-hidden"
          >
            <div className="relative group">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-accent transition-colors" size={18} />
              <input 
                autoFocus
                type="text"
                placeholder="Пошук по треках та нотатках..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full matte-card rounded-xl py-3 sm:py-3.5 pl-11 pr-4 text-sm text-gray-100 focus:outline-none focus:border-orange-accent/50 transition-all placeholder:text-gray-600"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Scrollable Area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {/* Horizontal Studio Filter Bar */}
        <div className="px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[9px] uppercase tracking-[0.25em] text-gray-500 font-black">Каталог студії</h2>
            <button 
              onClick={() => setIsCreatingGroup(true)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-orange-accent/80 hover:text-orange-accent transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-orange-accent/10"
              title="Створити групу"
            >
              <Plus size={14} />
              <span>Група</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 sm:flex-wrap mb-4">
            {/* All Notes Button */}
            <button
              onClick={() => setSelectedGroupId('all')}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedGroupId === 'all' 
                  ? 'bg-orange-accent/20 border-orange-accent/60 text-orange-accent shadow-[0_0_20px_rgba(255,107,0,0.15)]' 
                  : 'matte-card text-gray-400 hover:text-gray-200 hover:border-white/20'
              }`}
            >
              <LayoutGrid size={15} />
              <span>Усі</span>
              <span className="text-[10px] opacity-50 font-mono">{notes.length}</span>
            </button>

            {/* Songs Virtual Group */}
            <button
              onClick={() => setSelectedGroupId('songs')}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedGroupId === 'songs' 
                  ? 'bg-orange-accent/20 border-orange-accent/60 text-orange-accent shadow-[0_0_20px_rgba(255,107,0,0.15)]' 
                  : 'matte-card text-gray-400 hover:text-gray-200 hover:border-white/20'
              }`}
            >
              <Music size={15} />
              <span>Пісні</span>
              <span className="text-[10px] opacity-50 font-mono">{notes.filter(n => n.type === 'song').length}</span>
            </button>

            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id!)}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all group relative cursor-pointer ${
                  selectedGroupId === group.id 
                    ? 'bg-orange-accent/20 border-orange-accent/60 text-orange-accent shadow-[0_0_20px_rgba(255,107,0,0.15)]' 
                    : 'matte-card text-gray-400 hover:text-gray-200 hover:border-white/20'
                }`}
              >
                {getIconComponent(group.icon)}
                <span>{group.name}</span>
                <span className="text-[10px] opacity-50 font-mono">{notes.filter(n => n.groupId === group.id).length}</span>
                {selectedGroupId === group.id && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupToDelete(group.id!);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-red-400 pl-1 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Multi-Device Feed Grid */}
        <div className="px-4 sm:px-6 lg:px-8 pb-32">
          {filteredNotes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredNotes.map((note, idx) => {
                const passport = extractSongPassport(note);
                return (
                  <motion.div 
                    key={note.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28, delay: Math.min(idx * 0.03, 0.25) }}
                    onClick={() => onNoteClick(note)}
                    className="matte-card p-4 cursor-pointer hover:border-orange-accent/40 hover:-translate-y-0.5 transition-all group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#ffa233] to-[#ff5500] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5 min-w-0 flex-grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-gray-100 group-hover:text-orange-accent transition-colors truncate max-w-full">
                            {note.title}
                          </h3>
                          {passport && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded-md bg-orange-accent/15 border border-orange-accent/30 text-[9px] font-mono font-bold text-orange-accent">
                                {passport.bpm} BPM
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-gray-400">
                                {passport.beats}/4
                              </span>
                              {passport.lineCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400">
                                  {passport.lineCount} рядк.
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {passport && passport.preview && (
                          <p className="text-xs text-gray-400/80 italic truncate">
                            «{passport.preview}»
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-gray-500 font-bold pt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatDate(note.updatedAt)}
                          </span>
                          {note.groupId && (
                            <>
                              <span className="opacity-30">•</span>
                              <div className="flex items-center gap-1 text-orange-accent/70 truncate">
                                <Tag size={10} />
                                <span className="truncate">{groups.find(g => g.id === note.groupId)?.name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {note.type === 'song' && (
                          <div className="p-2 bg-orange-accent/10 border border-orange-accent/25 rounded-xl text-orange-accent group-hover:scale-105 transition-transform">
                            <Disc3 size={16} />
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteToDelete(note.id!);
                          }}
                          className="p-2 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all touch-visible-hover cursor-pointer"
                          title="Видалити"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600 italic">
              <FileText size={48} className="mb-4 opacity-20" />
              <p>У цій категорії поки порожньо.</p>
            </div>
          )}
        </div>

        {/* Note Delete Confirmation Modal */}
        {noteToDelete !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="matte-card p-8 max-w-sm w-full border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Delete Note?</h3>
              <p className="text-gray-400 text-center text-sm mb-8">
                This action is permanent and cannot be undone. Are you sure?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setNoteToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onDelete(noteToDelete);
                    setNoteToDelete(null);
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group Delete Confirmation Modal */}
        {groupToDelete !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="matte-card p-8 max-w-sm w-full border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Folder size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Delete Group?</h3>
              <p className="text-gray-400 text-center text-sm mb-8">
                Notes will remain but become ungrouped. Are you sure?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleDeleteGroup(groupToDelete);
                    setGroupToDelete(null);
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {isCreatingGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="matte-card w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 orange-text-gradient">Create New Group</h3>
            <input 
              autoFocus
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 mb-6 focus:outline-none focus:border-orange-accent"
            />
            
            <div className="grid grid-cols-7 gap-2 mb-8">
              {GROUP_ICONS.map(item => (
                <button
                  key={item.name}
                  onClick={() => setNewGroupIcon(item.name)}
                  className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                    newGroupIcon === item.name ? 'bg-orange-accent text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <item.icon size={20} />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsCreatingGroup(false)}
                className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateGroup}
                className="flex-1 py-3 rounded-lg bg-orange-accent text-black font-bold"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteList;
