import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Sparkles, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LobbyProps {
  onJoin: (roomId: string, code: string, player: 'p1' | 'p2', name: string) => void;
}

export function Lobby({ onJoin }: LobbyProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError('Please enter your name first');
      return;
    }
    setLoading(true);
    setError('');
    const newCode = generateCode();
    
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert([{ code: newCode }])
        .select()
        .single();

      if (roomError) {
        console.warn('DB Error, using local fallback:', roomError);
        onJoin('local-room-' + newCode, newCode, 'p1', name);
        return;
      }

      await supabase
        .from('game_state')
        .insert([{ 
          room_id: room.id, 
          game_mode: 'dashboard',
          p1_name: name,
          p1_ready: true,
          p2_ready: false
        }]);

      onJoin(room.id, newCode, 'p1', name);
    } catch (err) {
      setError('Failed to create room. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name first');
      return;
    }
    if (code.length !== 4) {
      setError('Code must be 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();

      if (roomError || !room) {
        console.warn('DB Error, using local fallback:', roomError);
        onJoin('local-room-' + code, code, 'p2', name);
        return;
      }

      await supabase
        .from('game_state')
        .update({ p2_name: name, p2_ready: true })
        .eq('room_id', room.id);

      onJoin(room.id, code, 'p2', name);
    } catch (err) {
      setError('Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-[#0f172a]">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-tr from-rose-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Heart className="w-8 h-8 text-white fill-current" />
              </div>
              <Sparkles className="w-6 h-6 text-indigo-400 absolute -top-2 -right-3 animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-indigo-400">UsTwo</h1>
          <p className="text-slate-400">Your private space, no matter the distance.</p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          <div className="space-y-6">
            
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all mb-4"
              />
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={loading || !name.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-500 to-indigo-500 hover:from-rose-400 hover:to-indigo-400 text-white rounded-2xl font-semibold shadow-lg shadow-rose-500/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Heart className="w-5 h-5 fill-current" />
              Create a Room
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium">or join existing</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 4-digit code"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              
              {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 4 || !name.trim()}
                className="w-full py-4 px-6 bg-slate-800/80 border border-white/5 hover:bg-slate-700/80 hover:border-white/10 text-white rounded-2xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Join Room
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
