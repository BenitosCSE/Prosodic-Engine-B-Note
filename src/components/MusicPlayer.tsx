import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Settings, X, ListMusic, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Track {
  id: string;
  name: string;
}

const MusicPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gdrive_api_key') || '');
  const [folderId, setFolderId] = useState(localStorage.getItem('gdrive_folder_id') || '1hCgDh2IJmVhrd3JUER7JfB5NmQX6F6pD');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (apiKey && folderId) {
      fetchTracks();
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const fetchTracks = async () => {
    if (!apiKey || !folderId) {
      setError('Please set API Key and Folder ID in settings');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const q = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'audio/' or name contains '.mp3')`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&key=${apiKey}&fields=files(id,name)&pageSize=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tracks. Check your API Key and Folder ID.');
      }

      const data = await response.json();
      setTracks(data.files || []);
      if (data.files?.length > 0 && currentTrackIndex === -1) {
        setCurrentTrackIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || currentTrackIndex === -1) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => setError('Playback failed: ' + e.message));
    }
    setIsPlaying(!isPlaying);
  };

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    // Audio source will update via useEffect or direct ref update
    if (audioRef.current) {
      audioRef.current.src = `https://www.googleapis.com/drive/v3/files/${tracks[index].id}?alt=media&key=${apiKey}`;
      audioRef.current.play().catch(e => setError('Playback failed: ' + e.message));
    }
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    playTrack(prevIndex);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  const saveSettings = () => {
    localStorage.setItem('gdrive_api_key', apiKey);
    localStorage.setItem('gdrive_folder_id', folderId);
    setShowSettings(false);
    fetchTracks();
  };

  const currentTrack = tracks[currentTrackIndex];

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-4">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 matte-card p-4 shadow-2xl border-orange-accent/20 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Music size={18} className="text-orange-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">B-PLAYER</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-gray-500 hover:text-white transition-colors">
                  <Settings size={16} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {showSettings ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 block mb-1">Google API Key</label>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white focus:border-orange-accent outline-none"
                    placeholder="Enter API Key..."
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 block mb-1">Folder ID</label>
                  <input 
                    type="text" 
                    value={folderId} 
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white focus:border-orange-accent outline-none"
                    placeholder="Enter GDrive Folder ID..."
                  />
                </div>
                <button 
                  onClick={saveSettings}
                  className="w-full py-2 bg-orange-accent text-black text-[10px] font-black uppercase tracking-widest rounded hover:bg-orange-accent/90 transition-colors"
                >
                  Save & Sync
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
                    {error}
                  </div>
                )}

                <div className="text-center py-2">
                  <div className="text-sm font-bold text-gray-200 truncate px-2">
                    {currentTrack ? currentTrack.name.replace(/\.[^/.]+$/, "") : "No track selected"}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                    {isPlaying ? "Now Playing" : "Paused"}
                  </div>
                </div>

                <div className="space-y-1">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress} 
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-accent"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-gray-600">
                    <span>{audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00"}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button onClick={prevTrack} className="text-gray-400 hover:text-white transition-colors">
                    <SkipBack size={20} />
                  </button>
                  <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-orange-accent flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-accent/20"
                  >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-gray-400 hover:text-white transition-colors">
                    <SkipForward size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <Volume2 size={14} className="text-gray-500" />
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={volume} 
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="flex-grow h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gray-400"
                  />
                </div>

                <div className="max-h-32 overflow-y-auto custom-scrollbar pt-2 space-y-1">
                  {tracks.map((track, idx) => (
                    <button
                      key={track.id}
                      onClick={() => playTrack(idx)}
                      className={`w-full text-left p-2 rounded text-[10px] truncate transition-colors ${idx === currentTrackIndex ? 'bg-orange-accent/10 text-orange-accent' : 'hover:bg-white/5 text-gray-500'}`}
                    >
                      {track.name}
                    </button>
                  ))}
                  {tracks.length === 0 && !isLoading && (
                    <div className="text-center py-4 text-[10px] text-gray-600 italic">
                      No tracks found in folder
                    </div>
                  )}
                  {isLoading && (
                    <div className="flex justify-center py-4">
                      <RefreshCw size={16} className="text-orange-accent animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-90 ${isOpen ? 'bg-orange-accent text-black' : 'bg-matte-gray/90 text-orange-accent border border-white/10 backdrop-blur-xl'}`}
      >
        <Music size={24} className={isPlaying ? 'animate-pulse' : ''} />
      </button>
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default MusicPlayer;
