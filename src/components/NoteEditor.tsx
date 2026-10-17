import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, 
  ImageIcon, Save, Copy, Trash2, X, Tag, Palette, Type, ChevronDown, Download
} from 'lucide-react';
import { Note, Group } from '../db';
import { MODERN_STYLES } from '../constants/editorStyles';
import { MultiSelectionExtension, applyToAllSelections } from '../lib/multiSelectionPlugin';

// Helper to parse CSS string to React style object
const parseStyleString = (styleString: string): React.CSSProperties => {
  const style: any = {};
  if (!styleString) return style;
  
  styleString.split(';').forEach(rule => {
    const [prop, value] = rule.split(':');
    if (prop && value) {
      const camelProp = prop.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      style[camelProp] = value.trim();
    }
  });
  return style;
};

const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

interface NoteEditorProps {
  note: Note | null;
  groups: Group[];
  onSave: (note: Partial<Note>) => void;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, groups, onSave, onClose, onDelete }) => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(note?.groupId);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Last used values for split buttons
  const [lastColor, setLastColor] = useState<string>(localStorage.getItem('lastColor') || '#ff6b00');
  const [lastStyle, setLastStyle] = useState<string | null>(localStorage.getItem('lastStyle'));
  const [lastSize, setLastSize] = useState<string>(localStorage.getItem('lastSize') || '18px');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CustomTextStyle,
      Color,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'adaptive-image',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Placeholder.configure({
        placeholder: 'Write your ideas here...',
      }),
      MultiSelectionExtension,
    ],
    content: note?.content || '',
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none',
        spellcheck: 'false',
      },
    },
  });

  const handleSave = () => {
    if (!editor) return;
    const content = editor.getHTML();
    const plainText = editor.getText();
    const title = plainText.split('\n')[0].substring(0, 50) || 'Untitled Note';
    
    onSave({
      ...note,
      title,
      content,
      plainText,
      groupId: selectedGroupId,
    });
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note?.title || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const content = readerEvent.target?.result as string;
          editor?.chain().focus().setImage({ src: content }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const closeAllPickers = () => {
    setShowColorPicker(false);
    setShowStylePicker(false);
    setShowSizePicker(false);
    setShowGroupPicker(false);
  };

  if (!editor) return null;

  return (
    <div className="fixed inset-0 h-[100dvh] z-[9999] flex flex-col bg-matte-black animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Sticky Responsive Header & Toolbar */}
      <div className="sticky top-0 border-b border-white/10 bg-matte-gray/95 backdrop-blur-xl z-30 pt-safe">
        <div className="flex items-center gap-1 px-2 sm:px-4 py-2 overflow-x-auto no-scrollbar sm:flex-wrap max-w-6xl mx-auto">
          <button onClick={onClose} className="shrink-0 p-2 hover:bg-white/10 rounded-md text-gray-400 mr-1 cursor-pointer">
            <X size={20} />
          </button>
          
          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          <button onClick={() => applyToAllSelections(editor, (chain) => chain.toggleBold())} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive('bold') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <Bold size={18} />
          </button>
          <button onClick={() => applyToAllSelections(editor, (chain) => chain.toggleItalic())} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive('italic') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <Italic size={18} />
          </button>
          <button onClick={() => applyToAllSelections(editor, (chain) => chain.toggleUnderline())} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive('underline') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <UnderlineIcon size={18} />
          </button>

          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive({ textAlign: 'left' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <AlignLeft size={18} />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive({ textAlign: 'center' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <AlignCenter size={18} />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive({ textAlign: 'right' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <AlignRight size={18} />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive({ textAlign: 'justify' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <AlignJustify size={18} />
          </button>

          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive('heading', { level: 1 }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <Heading1 size={18} />
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`shrink-0 p-2 rounded-md cursor-pointer ${editor.isActive('heading', { level: 2 }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
            <Heading2 size={18} />
          </button>

          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          {/* Color Split Button */}
          <div className="shrink-0 flex flex-col items-center">
            <button 
              onClick={() => {
                applyToAllSelections(editor, (chain) => chain.setColor(lastColor));
              }}
              className="p-1.5 hover:bg-white/10 rounded-t-md text-gray-400 transition-colors cursor-pointer"
              title={`Apply last color: ${lastColor}`}
            >
              <Palette size={18} style={{ color: lastColor }} />
            </button>
            <button 
              onClick={() => { setShowColorPicker(!showColorPicker); setShowStylePicker(false); setShowGroupPicker(false); setShowSizePicker(false); }}
              className={`w-full flex justify-center py-0.5 rounded-b-md hover:bg-white/10 transition-colors cursor-pointer ${showColorPicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-500'}`}
            >
              <ChevronDown size={10} />
            </button>
          </div>

          {/* Modern Styles Split Button */}
          <div className="shrink-0 flex flex-col items-center">
            <button 
              onClick={() => {
                if (lastStyle) {
                  applyToAllSelections(editor, (chain) => chain.setMark('textStyle', { style: lastStyle }));
                }
              }}
              className="p-1.5 hover:bg-white/10 rounded-t-md text-gray-400 transition-colors cursor-pointer"
              title={lastStyle ? "Apply last style" : "Select a style"}
            >
              <Type size={18} style={lastStyle ? parseStyleString(lastStyle) : {}} />
            </button>
            <button 
              onClick={() => { setShowStylePicker(!showStylePicker); setShowColorPicker(false); setShowGroupPicker(false); setShowSizePicker(false); }}
              className={`w-full flex justify-center py-0.5 rounded-b-md hover:bg-white/10 transition-colors cursor-pointer ${showStylePicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-500'}`}
            >
              <ChevronDown size={10} />
            </button>
          </div>

          {/* Font Size Split Button */}
          <div className="shrink-0 flex flex-col items-center">
            <button 
              onClick={() => {
                applyToAllSelections(editor, (chain) => chain.setMark('textStyle', { fontSize: lastSize }));
              }}
              className="p-1.5 hover:bg-white/10 rounded-t-md text-gray-400 transition-colors cursor-pointer"
              title={`Apply last size: ${lastSize}`}
            >
              <span className="text-[10px] font-bold">{lastSize.replace('px', '')}</span>
            </button>
            <button 
              onClick={() => { setShowSizePicker(!showSizePicker); setShowStylePicker(false); setShowColorPicker(false); setShowGroupPicker(false); }}
              className={`w-full flex justify-center py-0.5 rounded-b-md hover:bg-white/10 transition-colors cursor-pointer ${showSizePicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-500'}`}
            >
              <ChevronDown size={10} />
            </button>
          </div>

          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          <button onClick={addImage} className="shrink-0 p-2 hover:bg-white/10 rounded-md text-gray-300 cursor-pointer">
            <ImageIcon size={18} />
          </button>

          <div className="shrink-0 h-6 w-[1px] bg-white/10 mx-1" />

          {/* Group Picker Trigger */}
          <button 
            onClick={() => { setShowGroupPicker(!showGroupPicker); setShowColorPicker(false); setShowStylePicker(false); setShowSizePicker(false); }}
            className={`shrink-0 p-2 rounded-md flex items-center gap-2 cursor-pointer ${selectedGroupId ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400 hover:bg-white/10'}`}
          >
            <Tag size={18} />
            {selectedGroupId && (
              <span className="text-xs font-bold uppercase truncate max-w-[80px]">
                {groups.find(g => g.id === selectedGroupId)?.name}
              </span>
            )}
          </button>
          
          <div className="flex-grow min-w-[8px]" />
          
          {note?.id && onDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} className="shrink-0 p-2 hover:bg-red-500/20 text-red-400 rounded-md transition-colors cursor-pointer">
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Viewport-Safe Dropdown Popovers (rendered outside overflow-x-auto so they never clip or overflow on mobile) */}
        {showColorPicker && (
          <div className="mx-3 sm:mx-auto mt-1 mb-2 p-4 matte-card z-50 max-w-xs shadow-2xl border-orange-accent/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Colors</div>
            <div className="grid grid-cols-5 gap-3">
              {[
                '#ffffff', '#ff6b00', '#ff0000', '#00ff00', '#0000ff', 
                '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
                '#008000', '#000080', '#808080', '#c0c0c0', '#000000'
              ].map(color => (
                <button
                  key={color}
                  onClick={() => { 
                    applyToAllSelections(editor, (chain) => chain.setColor(color));
                    setLastColor(color);
                    localStorage.setItem('lastColor', color);
                    setShowColorPicker(false); 
                  }}
                  className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-inner cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button 
              onClick={() => { applyToAllSelections(editor, (chain) => chain.unsetColor()); setShowColorPicker(false); }}
              className="w-full mt-4 text-[10px] uppercase tracking-widest font-black py-2 bg-white/5 hover:bg-white/10 rounded transition-colors text-gray-400 cursor-pointer"
            >
              Reset Color
            </button>
          </div>
        )}

        {showStylePicker && (
          <div className="mx-3 sm:mx-auto mt-1 mb-2 max-w-sm matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">50 Modern Styles</span>
              <button 
                onClick={() => { applyToAllSelections(editor, (chain) => chain.unsetMark('textStyle')); setShowStylePicker(false); }}
                className="text-[9px] uppercase tracking-tighter font-bold text-orange-accent hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto custom-scrollbar">
              {MODERN_STYLES.map((style, idx) => (
                <button
                  key={style.name}
                  onClick={() => { 
                    applyToAllSelections(editor, (chain) => chain.setMark('textStyle', { style: style.style }));
                    setLastStyle(style.style);
                    localStorage.setItem('lastStyle', style.style);
                    setShowStylePicker(false); 
                  }}
                  className="w-full p-3.5 text-left hover:bg-white/5 border-b border-white/5 transition-all group flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs text-gray-500 font-mono mr-4 opacity-30">{(idx + 1).toString().padStart(2, '0')}</span>
                  <span className="flex-grow font-bold" style={parseStyleString(style.style)}>{style.name}</span>
                  <div className="w-1 h-1 rounded-full bg-orange-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {showSizePicker && (
          <div className="mx-3 sm:mx-auto mt-1 mb-2 max-w-[180px] matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-b border-white/5">
              Size
            </div>
            <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
              {['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px', '64px'].map(size => (
                <button
                  key={size}
                  onClick={() => { 
                    applyToAllSelections(editor, (chain) => chain.setMark('textStyle', { fontSize: size }));
                    setLastSize(size);
                    localStorage.setItem('lastSize', size);
                    setShowSizePicker(false); 
                  }}
                  className="w-full p-2.5 text-left hover:bg-white/5 text-sm text-gray-300 cursor-pointer"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {showGroupPicker && (
          <div className="mx-3 sm:mx-auto mt-1 mb-2 max-w-[220px] matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => { setSelectedGroupId(undefined); setShowGroupPicker(false); }}
              className="w-full p-3 text-left hover:bg-white/5 text-sm border-b border-white/5 cursor-pointer"
            >
              No Group
            </button>
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => { setSelectedGroupId(group.id); setShowGroupPicker(false); }}
                className={`w-full p-3 text-left hover:bg-white/5 text-sm flex items-center gap-2 cursor-pointer ${selectedGroupId === group.id ? 'text-orange-accent' : 'text-gray-300'}`}
              >
                <Tag size={14} />
                {group.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDelete!(note!.id!);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div
        className="flex-grow overflow-y-auto bg-matte-black/50 pb-32 custom-scrollbar"
        onClick={closeAllPickers}
      >
        <EditorContent editor={editor} className="max-w-4xl mx-auto" />
      </div>

      {/* Compact Studio Action Dock (replaces oversized vertical stack that covered text on phones) */}
      <div className="fixed bottom-safe-dock right-4 sm:right-8 z-50">
        <div className="luxury-dock px-3 py-2 rounded-2xl flex items-center gap-2.5">
          <button 
            onClick={handleExport}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-orange-accent transition-transform active:scale-95 cursor-pointer"
            title="Експортувати у .txt"
          >
            <Download size={19} />
          </button>
          <button 
            onClick={handleCopy}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-orange-accent'
            }`}
            title="Копіювати весь текст"
          >
            <Copy size={19} />
          </button>
          <button 
            onClick={handleSave}
            className="px-4 h-10 sm:h-11 rounded-xl bg-gradient-to-br from-[#ffa233] via-[#ff6b00] to-[#d94e00] flex items-center justify-center gap-1.5 text-black font-bold text-xs uppercase tracking-wider shadow-[0_6px_20px_rgba(255,107,0,0.35)] transition-transform active:scale-95 cursor-pointer"
            title="Зберегти нотатку"
          >
            <Save size={17} />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;

