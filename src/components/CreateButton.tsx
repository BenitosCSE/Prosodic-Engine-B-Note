import React, { useState, useRef, useEffect } from 'react';
import { Pencil, FileText, Music, Plus } from 'lucide-react';
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
              initial={{ opacity: 0, y: 12, x: 0, scale: 0.75 }}
              animate={{ opacity: 1, y: -88, x: -64, scale: 1 }}
              exit={{ opacity: 0, y: 10, x: 0, scale: 0.75 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => { onCreateNote(); setIsOpen(false); }}
              className="absolute left-1/2 -translate-x-1/2 w-20 h-20 matte-card rounded-2xl text-gray-200 hover:text-orange-accent hover:border-orange-accent/50 transition-colors flex flex-col items-center justify-center gap-1.5 shadow-[0_15px_35px_rgba(0,0,0,0.85)] cursor-pointer"
            >
              <FileText size={22} className="text-orange-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest">Нотатка</span>
            </motion.button>

            {/* Song Option */}
            <motion.button
              initial={{ opacity: 0, y: 12, x: 0, scale: 0.75 }}
              animate={{ opacity: 1, y: -88, x: 64, scale: 1 }}
              exit={{ opacity: 0, y: 10, x: 0, scale: 0.75 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24, delay: 0.03 }}
              onClick={() => { onCreateSong(); setIsOpen(false); }}
              className="absolute left-1/2 -translate-x-1/2 w-20 h-20 matte-card rounded-2xl text-gray-200 hover:text-orange-accent hover:border-orange-accent/50 transition-colors flex flex-col items-center justify-center gap-1.5 shadow-[0_15px_35px_rgba(0,0,0,0.85)] cursor-pointer"
            >
              <Music size={22} className="text-orange-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest">Пісня</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleToggle}
        className="w-14 h-14 flex items-center justify-center rounded-2xl text-black shadow-[0_0_28px_rgba(255,107,0,0.45),inset_0_1px_0_rgba(255,255,255,0.45)] bg-gradient-to-br from-[#ffa233] via-[#ff6b00] to-[#e05500] z-50 relative cursor-pointer"
      >
        <motion.div
          animate={{ rotate: isOpen ? 135 : 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 22 }}
        >
          {isOpen ? <Plus size={28} strokeWidth={2.5} /> : <Pencil size={24} strokeWidth={2.5} />}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default CreateButton;

