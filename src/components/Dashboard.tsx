import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Heart, MessageCircleQuestion, Dices, Beer, ChevronLeft, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { GameState, GameMode, PlayerId, IntensityMode, ThemeConfig } from '../types';
import { SimultaneousQA } from './games/SimultaneousQA';
import { TruthOrDare } from './games/TruthOrDare';
import { NeverHaveIEver } from './games/NeverHaveIEver';
import { THEMES } from '../theme';

interface DashboardProps {
  roomId: string;
  roomCode: string;
  playerId: PlayerId;
  playerName: string;
  onLeave: () => void;
}

export function Dashboard({ roomId, roomCode, playerId, playerName, onLeave }: DashboardProps) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'online' | 'away'>('online');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAwayToast, setShowAwayToast] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    room_id: roomId,
    game_mode: 'dashboard',
    intensity_mode: 'friendly',
    current_question: null,
    p1_answer: null,
    p2_answer: null,
    p1_name: null,
    p2_name: null,
    p1_ready: false,
    p2_ready: false,
    current_turn: 'p1',
    card_type: null,
    card_prompt: null,
    card_flipped: false
  });


  useEffect(() => {
    // 1. Initial State Fetch
    const fetchState = async () => {
      const { data } = await supabase
        .from('game_state')
        .select('*')
        .eq('room_id', roomId)
        .single();
        
      if (data) setGameState(data as GameState);
    };
    fetchState();

    // 2. Setup Realtime Channel
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: playerId },
      },
    });

    channel
      // Presence
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const playersCount = Object.keys(state).length;
        setPartnerOnline(playersCount > 1);
        
        // Check partner status
        const partnerState = Object.entries(state).find(([key]) => key !== playerId);
        if (partnerState && partnerState[1] && partnerState[1].length > 0) {
          const status = (partnerState[1][0] as any).status || 'online';
          setPartnerStatus(status);
          if (status === 'away') {
            setShowAwayToast(true);
            setTimeout(() => setShowAwayToast(false), 3000);
          }
        }
      })
      // DB Changes
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setGameState(payload.new as GameState);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString(), status: document.visibilityState === 'visible' ? 'online' : 'away' });
        }
      });

    const handleVisibilityChange = async () => {
      if (channel.state === 'joined') {
        await channel.track({ 
          online_at: new Date().toISOString(), 
          status: document.visibilityState === 'visible' ? 'online' : 'away' 
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      channel.unsubscribe();
    };
  }, [roomId, playerId]);

  const updateGameState = async (updates: Partial<GameState>) => {
    // Optimistic update
    setGameState(prev => ({ ...prev, ...updates }));
    
    // Attempt DB update
    await supabase
      .from('game_state')
      .update(updates)
      .eq('room_id', roomId);
  };

  const setGameMode = async (mode: GameMode) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    
    // Check if mode is already updated by partner
    if (gameState.game_mode === mode) {
      setIsTransitioning(false);
      return;
    }
    // Reset answers when changing modes
    updateGameState({ 
      game_mode: mode,
      p1_answer: null,
      p2_answer: null,
      current_question: null,
      card_flipped: false,
      current_turn: 'p1',
      card_type: null,
      card_prompt: null
    });
    
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const renderGame = () => {
    switch (gameState.game_mode) {
      case 'qa':
        return <SimultaneousQA gameState={gameState} updateGameState={updateGameState} playerId={playerId} roomId={roomId} onBack={() => setGameMode('dashboard')} theme={theme} />;
      case 'truth_or_dare':
        return <TruthOrDare gameState={gameState} updateGameState={updateGameState} playerId={playerId} roomId={roomId} onBack={() => setGameMode('dashboard')} theme={theme} />;
      case 'never_have_i_ever':
        return <NeverHaveIEver gameState={gameState} updateGameState={updateGameState} playerId={playerId} roomId={roomId} onBack={() => setGameMode('dashboard')} theme={theme} />;
      default:
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-6 mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Set the Mood</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.entries(THEMES) as [IntensityMode, ThemeConfig][]).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => updateGameState({ intensity_mode: key })}
                      className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                        gameState.intensity_mode === key 
                          ? `${t.buttonBg} text-white shadow-lg ${t.glow}` 
                          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-light tracking-tight text-white">Ready to play?</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GameCard 
                icon={<MessageCircleQuestion className="w-6 h-6" />}
                title="Simultaneous Q&A"
                description="Answer deep questions together. Both answers stay hidden until both are ready."
                onClick={() => setGameMode('qa')}
                disabled={isTransitioning}
                theme={theme}
              />
              
              <GameCard 
                icon={<Dices className="w-6 h-6" />}
                title="Truth or Dare"
                description="A digital card deck built for two. Flip a card and see what destiny has in store."
                onClick={() => setGameMode('truth_or_dare')}
                disabled={isTransitioning}
                theme={theme}
              />

              <div 
                onClick={() => setGameMode('never_have_i_ever')}
                className={`col-span-1 md:col-span-2 group ${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 hover:${theme.borderAccent} transition-all cursor-pointer flex items-center justify-between relative overflow-hidden ${isTransitioning ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${theme.textAccent}`}>
                  <div className="w-24 h-24 opacity-50">
                    <Beer className="w-full h-full" />
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-6 z-10">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-black/20 ${theme.textAccent}`}>
                    <Beer className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg md:text-xl font-medium text-white">Never Have I Ever</h4>
                    <p className="text-sm text-slate-400">Classic game, redefined for couples.</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest z-10 ${theme.textAccent}`}>
                  <span>Start</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  const partnerName = playerId === 'p1' ? (gameState.p2_name || 'Partner') : (gameState.p1_name || 'Partner');
  const theme = THEMES[gameState.intensity_mode || 'friendly'];

  return (
    <div className={`min-h-screen ${theme.bg} text-slate-100 flex flex-col font-sans overflow-hidden transition-colors duration-1000`}>
      {/* Toast Notification for Away Status */}
      <AnimatePresence>
        {showAwayToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase shadow-xl backdrop-blur-md flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            Partner is away
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header (Elegant Dark styling) */}
      <nav className={`h-16 flex items-center justify-between px-4 md:px-8 ${theme.navBg} border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 transition-colors duration-1000`}>
        <div className="flex items-center gap-2 md:gap-3">
          {gameState.game_mode !== 'dashboard' && (
            <button 
              onClick={() => setGameMode('dashboard')}
              className="p-1 -ml-1 md:p-2 md:-ml-2 rounded-full hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className={`w-8 h-8 bg-gradient-to-tr ${theme.primaryGrad} rounded-lg flex items-center justify-center shadow-lg transition-colors duration-1000`}>
            <Heart className="w-4 h-4 text-white fill-current" />
          </div>
          <span className={`text-lg md:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${theme.primaryGrad} transition-colors duration-1000`}>UsTwo</span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">{partnerName}</span>
              <div className={`w-2 h-2 rounded-full ${!partnerOnline ? 'bg-slate-600' : partnerStatus === 'away' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></div>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Room: <span className="text-slate-300 font-bold">{roomCode}</span></span>
          </div>
          <button onClick={onLeave} className="w-10 h-10 rounded-full border-2 border-indigo-500/30 p-0.5 hover:border-rose-500/50 transition-colors">
            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400">
              <LogOut className="w-4 h-4" />
            </div>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-12">
        <div className="max-w-4xl mx-auto">
          {renderGame()}
        </div>
      </main>
    </div>
  );
}

function GameCard({ icon, title, description, onClick, theme, disabled }: { icon: React.ReactNode, title: string, description: string, onClick: () => void, theme: ThemeConfig, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group ${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 transition-all cursor-pointer relative overflow-hidden text-left flex flex-col h-full ${theme.borderAccent} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${theme.textAccent}`}>
        <div className="w-24 h-24 opacity-50">
          {icon}
        </div>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 z-10 bg-black/20 ${theme.textAccent}`}>
        {icon}
      </div>
      <h4 className="text-xl font-medium mb-2 text-white z-10">{title}</h4>
      <p className="text-sm text-slate-400 mb-6 flex-1 z-10">{description}</p>
      
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest z-10 ${theme.textAccent}`}>
        <span>Start</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}
