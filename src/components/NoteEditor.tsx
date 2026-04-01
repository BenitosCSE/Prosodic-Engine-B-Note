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
  Image as ImageIcon, Save, Copy, Trash2, X, Tag, Palette, Type
} from 'lucide-react';
import { Note, Group } from '../db';
import { MODERN_STYLES } from '../constants/editorStyles';

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
    ],
    content: note?.content || '',
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none',
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

  const handleCopy = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard.writeText(text);
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

  if (!editor) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-matte-black animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-white/10 bg-matte-gray/80 backdrop-blur-md sticky top-0 z-10">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-md text-gray-400 mr-2">
          <X size={20} />
        </button>
        
        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-md ${editor.isActive('bold') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <Bold size={18} />
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-md ${editor.isActive('italic') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <Italic size={18} />
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded-md ${editor.isActive('underline') ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <UnderlineIcon size={18} />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-2 rounded-md ${editor.isActive({ textAlign: 'left' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <AlignLeft size={18} />
        </button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-2 rounded-md ${editor.isActive({ textAlign: 'center' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <AlignCenter size={18} />
        </button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-2 rounded-md ${editor.isActive({ textAlign: 'right' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <AlignRight size={18} />
        </button>
        <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`p-2 rounded-md ${editor.isActive({ textAlign: 'justify' }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <AlignJustify size={18} />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded-md ${editor.isActive('heading', { level: 1 }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <Heading1 size={18} />
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded-md ${editor.isActive('heading', { level: 2 }) ? 'bg-orange-accent/20 text-orange-accent' : 'hover:bg-white/10'}`}>
          <Heading2 size={18} />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        {/* Color Picker */}
        <div className="relative">
          <button 
            onClick={() => { setShowColorPicker(!showColorPicker); setShowStylePicker(false); setShowGroupPicker(false); setShowSizePicker(false); }}
            className={`p-2 rounded-md hover:bg-white/10 transition-colors ${showColorPicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400'}`}
            title="Text Color"
          >
            <Palette size={18} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-2 p-4 matte-card z-50 w-64 shadow-2xl border-orange-accent/20 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Colors</div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  '#ffffff', '#ff6b00', '#ff0000', '#00ff00', '#0000ff', 
                  '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
                  '#008000', '#000080', '#808080', '#c0c0c0', '#000000'
                ].map(color => (
                  <button
                    key={color}
                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                    className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-inner"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button 
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                className="w-full mt-4 text-[10px] uppercase tracking-widest font-black py-2 bg-white/5 hover:bg-white/10 rounded transition-colors text-gray-400"
              >
                Reset Color
              </button>
            </div>
          )}
        </div>

        {/* Modern Styles Picker */}
        <div className="relative">
          <button 
            onClick={() => { setShowStylePicker(!showStylePicker); setShowColorPicker(false); setShowGroupPicker(false); setShowSizePicker(false); }}
            className={`p-2 rounded-md hover:bg-white/10 transition-colors ${showStylePicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400'}`}
            title="Modern Styles"
          >
            <Type size={18} />
          </button>
          {showStylePicker && (
            <div className="absolute top-full left-0 mt-2 w-72 matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">50 Modern Styles</span>
                <button 
                  onClick={() => { editor.chain().focus().unsetMark('textStyle').run(); setShowStylePicker(false); }}
                  className="text-[9px] uppercase tracking-tighter font-bold text-orange-accent hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                {MODERN_STYLES.map((style, idx) => (
                  <button
                    key={style.name}
                    onClick={() => { 
                      editor.chain().focus().setMark('textStyle', { style: style.style }).run(); 
                      setShowStylePicker(false); 
                    }}
                    className="w-full p-4 text-left hover:bg-white/5 border-b border-white/5 transition-all group flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-500 font-mono mr-4 opacity-30">{(idx + 1).toString().padStart(2, '0')}</span>
                    <span className="flex-grow font-bold" style={parseStyleString(style.style)}>{style.name}</span>
                    <div className="w-1 h-1 rounded-full bg-orange-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Font Size Picker */}
        <div className="relative">
          <button 
            onClick={() => { setShowSizePicker(!showSizePicker); setShowStylePicker(false); setShowColorPicker(false); setShowGroupPicker(false); }}
            className={`p-2 rounded-md hover:bg-white/10 transition-colors ${showSizePicker ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400'}`}
            title="Font Size"
          >
            <span className="text-xs font-bold">Size</span>
          </button>
          {showSizePicker && (
            <div className="absolute top-full left-0 mt-2 w-32 matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-2 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-b border-white/5">
                Size
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px', '64px'].map(size => (
                  <button
                    key={size}
                    onClick={() => { 
                      editor.chain().focus().setMark('textStyle', { fontSize: size }).run(); 
                      setShowSizePicker(false); 
                    }}
                    className="w-full p-3 text-left hover:bg-white/5 text-sm text-gray-300"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <button onClick={addImage} className="p-2 hover:bg-white/10 rounded-md text-gray-300">
          <ImageIcon size={18} />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        {/* Group Picker */}
        <div className="relative">
          <button 
            onClick={() => setShowGroupPicker(!showGroupPicker)}
            className={`p-2 rounded-md flex items-center gap-2 ${selectedGroupId ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400 hover:bg-white/10'}`}
          >
            <Tag size={18} />
            {selectedGroupId && (
              <span className="text-xs font-bold uppercase truncate max-w-[80px]">
                {groups.find(g => g.id === selectedGroupId)?.name}
              </span>
            )}
          </button>

          {showGroupPicker && (
            <div className="absolute top-full left-0 mt-2 w-48 matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => { setSelectedGroupId(undefined); setShowGroupPicker(false); }}
                className="w-full p-3 text-left hover:bg-white/5 text-sm border-b border-white/5"
              >
                No Group
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => { setSelectedGroupId(group.id); setShowGroupPicker(false); }}
                  className={`w-full p-3 text-left hover:bg-white/5 text-sm flex items-center gap-2 ${selectedGroupId === group.id ? 'text-orange-accent' : 'text-gray-300'}`}
                >
                  <Tag size={14} />
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex-grow" />
        
        {note?.id && onDelete && (
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-md transition-colors">
            <Trash2 size={18} />
          </button>
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
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDelete!(note!.id!);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-grow overflow-y-auto bg-matte-black/50">
        <EditorContent editor={editor} className="max-w-4xl mx-auto" />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 right-8 flex flex-col gap-4 z-50">
        <button 
          onClick={handleCopy}
          className="w-14 h-14 rounded-full bg-matte-gray border border-white/10 flex items-center justify-center text-orange-accent shadow-lg hover:scale-110 transition-transform"
          title="Copy all text"
        >
          <Copy size={24} />
        </button>
        <button 
          onClick={handleSave}
          className="w-14 h-14 rounded-full bg-orange-accent flex items-center justify-center text-black shadow-lg hover:scale-110 transition-transform"
          title="Save note"
        >
          <Save size={24} />
        </button>
      </div>
    </div>
  );
};

export default NoteEditor;

