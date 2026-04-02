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
  const DEFAULT_API_KEY = 'AIzaSyBddDf9m1Bvzg5V_H3TYn6whHRpi3TxLjA';
  const DEFAULT_FOLDER_ID = '1hCgDh2IJmVhrd3JUER7JfB5NmQX6F6pD';

  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('gdrive_api_key');
    if (saved === '.' || !saved || saved.length < 10) {
      localStorage.removeItem('gdrive_api_key');
      return DEFAULT_API_KEY;
    }
    return saved;
  });
  
  const [folderId, setFolderId] = useState(() => {
    const saved = localStorage.getItem('gdrive_folder_id');
    if (saved === '.' || !saved || saved.length < 10) {
      localStorage.removeItem('gdrive_folder_id');
      return DEFAULT_FOLDER_ID;
    }
    return saved;
  });

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
  }, [apiKey, folderId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const [debugLog, setDebugLog] = useState<string | null>(null);

  const fetchTracks = async () => {
    // FORCE USE THE PROVIDED CREDENTIALS
    const activeKey = 'AIzaSyBddDf9m1Bvzg5V_H3TYn6whHRpi3TxLjA';
    const activeFolder = '1hCgDh2IJmVhrd3JUER7JfB5NmQX6F6pD';

    setIsLoading(true);
    setError(null);
    setDebugLog(null);
    try {
      const q = encodeURIComponent(`'${activeFolder}' in parents and (mimeType contains 'audio/' or name contains '.mp3')`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${activeKey}&fields=files(id,name)&pageSize=100`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        const message = data.error?.message || 'Failed to fetch tracks';
        setDebugLog(JSON.stringify(data, null, 2));
        throw new Error(`Google API Error: ${message}`);
      }

      setTracks(data.files || []);
      if (data.files?.length > 0 && currentTrackIndex === -1) {
        setCurrentTrackIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('B-PLAYER ERROR:', err);
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
    const activeKey = 'AIzaSyBddDf9m1Bvzg5V_H3TYn6whHRpi3TxLjA';
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    
    if (audioRef.current) {
      audioRef.current.src = `https://www.googleapis.com/drive/v3/files/${tracks[index].id}?alt=media&key=${activeKey}`;
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
    <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-full max-w-[860px] z-40 px-4 pointer-events-none">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
        crossOrigin="anonymous"
      />

      <div className="pointer-events-auto">
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="matte-card p-4 shadow-2xl border-orange-accent/20 mb-2 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Music size={16} className="text-orange-accent" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Playlist</span>
                </div>
                <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-gray-500 hover:text-white transition-colors">
                  <Settings size={14} />
                </button>
              </div>

              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-400 mb-3">
                  {error}
                </div>
              )}

              {showSettings ? (
                <div className="space-y-3">
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-[10px] text-white outline-none focus:border-orange-accent"
                    placeholder="API Key..."
                  />
                  <input 
                    type="text" 
                    value={folderId} 
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-[10px] text-white outline-none focus:border-orange-accent"
                    placeholder="Folder ID..."
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setApiKey(DEFAULT_API_KEY);
                        setFolderId(DEFAULT_FOLDER_ID);
                        localStorage.removeItem('gdrive_api_key');
                        localStorage.removeItem('gdrive_folder_id');
                      }} 
                      className="flex-grow py-2 bg-white/5 text-gray-400 text-[10px] font-black uppercase rounded hover:text-white"
                    >
                      Reset
                    </button>
                    <button onClick={saveSettings} className="flex-[2] py-2 bg-orange-accent text-black text-[10px] font-black uppercase rounded">Save</button>
                  </div>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                  {tracks.map((track, idx) => (
                    <button
                      key={track.id}
                      onClick={() => playTrack(idx)}
                      className={`w-full text-left p-2 rounded text-[10px] truncate transition-colors ${idx === currentTrackIndex ? 'bg-orange-accent/10 text-orange-accent' : 'hover:bg-white/5 text-gray-500'}`}
                    >
                      {track.name}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="matte-card p-3 flex items-center gap-4 shadow-xl border-white/10">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 rounded-md transition-colors ${isOpen ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <ListMusic size={20} />
          </button>

          <div className="flex-grow min-w-0">
            <div className="text-[10px] font-bold text-gray-200 truncate">
              {currentTrack ? currentTrack.name.replace(/\.[^/.]+$/, "") : "B-PLAYER READY"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-grow h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-orange-accent transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[8px] font-mono text-gray-600 w-8">{audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevTrack} className="p-1 text-gray-500 hover:text-white"><SkipBack size={18} /></button>
            <button 
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-orange-accent flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={nextTrack} className="p-1 text-gray-500 hover:text-white"><SkipForward size={18} /></button>
          </div>
        </div>
      </div>
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
