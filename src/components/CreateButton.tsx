import React, { useState, useRef, useEffect } from 'react';
import { Pencil, FileText, Music, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreateButtonProps {
  onCreateNote: () => void;
  onCreateSong: () => void;
}

const CreateButton: React.FC<CreateButtonProps> = ({ onCreateNote, onCreateSong }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <div className="relative" ref={menuRef}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Note Option */}
            <motion.button
              initial={{ opacity: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, y: -80, x: -50 }}
              exit={{ opacity: 0, y: 0, x: 0 }}
              onClick={() => { onCreateNote(); setIsOpen(false); }}
              className="absolute left-1/2 -translate-x-1/2 p-4 bg-matte-gray border border-white/10 rounded-full text-gray-300 shadow-2xl hover:text-orange-accent hover:border-orange-accent/50 transition-colors flex flex-col items-center gap-1"
            >
              <FileText size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Note</span>
            </motion.button>

            {/* Song Option */}
            <motion.button
              initial={{ opacity: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, y: -80, x: 50 }}
              exit={{ opacity: 0, y: 0, x: 0 }}
              onClick={() => { onCreateSong(); setIsOpen(false); }}
              className="absolute left-1/2 -translate-x-1/2 p-4 bg-matte-gray border border-white/10 rounded-full text-gray-300 shadow-2xl hover:text-orange-accent hover:border-orange-accent/50 transition-colors flex flex-col items-center gap-1"
            >
              <Music size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Song</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      <button 
        onClick={handleToggle}
        className={`p-4 bg-orange-accent rounded-full text-black shadow-[0_0_20px_rgba(255,107,0,0.3)] transition-all hover:scale-110 active:scale-95 -translate-y-4 z-50 relative`}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? <Plus size={32} strokeWidth={2.5} /> : <Pencil size={32} strokeWidth={2.5} />}
        </motion.div>
      </button>
    </div>
  );
};

export default CreateButton;
