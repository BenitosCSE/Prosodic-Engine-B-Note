import React, { useState, useMemo } from 'react';
import { 
  Search as SearchIcon, FileText, Clock, ChevronRight, 
  Folder, Plus, Tag, Briefcase, Heart, Star, 
  Coffee, Zap, Trash2, LayoutGrid, Music
} from 'lucide-react';
import { Note, Group, saveGroup, deleteGroup } from '../db';

interface NoteListProps {
  notes: Note[];
  groups: Group[];
  onNoteClick: (note: Note) => void;
  onGroupsUpdate: () => void;
  onDelete: (id: number) => void;
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

const NoteList: React.FC<NoteListProps> = ({ notes, groups, onNoteClick, onGroupsUpdate, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all' | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('Folder');
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null);

  const filteredNotes = useMemo(() => {
    if (selectedGroupId === null && !searchQuery.trim()) return [];

    let result = notes;
    
    // Filter by group
    if (selectedGroupId !== 'all' && selectedGroupId !== null) {
      result = result.filter(note => note.groupId === selectedGroupId);
    }

    // Filter by search
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
    return <IconComp size={18} />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <div className="p-6 pb-2">
        <div className="relative group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-accent transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Deep search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-matte-gray/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-lg focus:outline-none focus:border-orange-accent/50 transition-all placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Groups Section */}
      <div className="px-6 py-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Groups</h2>
          <button 
            onClick={() => setIsCreatingGroup(true)}
            className="text-orange-accent hover:scale-110 transition-transform"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {/* All Notes Button */}
          <button
            onClick={() => setSelectedGroupId('all')}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
              selectedGroupId === 'all' 
                ? 'bg-orange-accent/20 border-orange-accent text-orange-accent' 
                : 'bg-matte-gray/30 border-white/5 text-gray-400 hover:border-white/20'
            }`}
          >
            <LayoutGrid size={18} />
            <span className="text-sm font-bold whitespace-nowrap">Full List</span>
          </button>

          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id!)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all group relative ${
                selectedGroupId === group.id 
                  ? 'bg-orange-accent/20 border-orange-accent text-orange-accent' 
                  : 'bg-matte-gray/30 border-white/5 text-gray-400 hover:border-white/20'
              }`}
            >
              {getIconComponent(group.icon)}
              <span className="text-sm font-bold whitespace-nowrap">{group.name}</span>
              {selectedGroupId === group.id && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupToDelete(group.id!);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                >
                  <Trash2 size={12} />
                </div>
              )}
            </button>
          ))}
        </div>
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

      {/* Feed */}
      <div className="flex-grow overflow-y-auto p-6 pt-2 space-y-4 pb-32">
        {selectedGroupId === null && !searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600/40 italic">
            <div className="text-center animate-in fade-in duration-700">
              <div className="w-16 h-1 bg-orange-accent/20 mx-auto mb-6" />
              <p className="text-lg font-bold mb-2 orange-text-gradient opacity-60">Select a group or search</p>
              <p className="text-sm tracking-widest uppercase">to view your notes</p>
            </div>
          </div>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map(note => (
            <div 
              key={note.id}
              onClick={() => onNoteClick(note)}
              className="matte-card p-5 cursor-pointer hover:border-orange-accent/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-xl font-bold group-hover:text-orange-accent transition-colors truncate">
                  {note.title}
                </h3>
                {note.type === 'song' && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-accent/10 border border-orange-accent/20 rounded text-[8px] font-black uppercase tracking-widest text-orange-accent/60 shrink-0">
                    <Music size={10} />
                    Song
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm line-clamp-2 mb-4 leading-relaxed">
                {note.plainText}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-600 font-bold">
                  <Clock size={12} />
                  {formatDate(note.updatedAt)}
                </div>
                <div className="flex items-center gap-3">
                  {note.groupId && (
                    <div className="flex items-center gap-1 text-[10px] text-orange-accent/60 font-bold uppercase tracking-tighter">
                      <Tag size={10} />
                      {groups.find(g => g.id === note.groupId)?.name}
                    </div>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note.id!);
                    }}
                    className="p-2 hover:bg-red-500/20 text-red-400/40 hover:text-red-400 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 italic">
            <FileText size={48} className="mb-4 opacity-20" />
            <p>No notes found in this view.</p>
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
  );
};

export default NoteList;
