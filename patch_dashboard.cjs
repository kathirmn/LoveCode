const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// 1. Add isPartnerAway and isTransitioning state
code = code.replace(
  `const [partnerOnline, setPartnerOnline] = useState(false);`,
  `const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'online' | 'away'>('online');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAwayToast, setShowAwayToast] = useState(false);`
);

// 2. Add visibility change listener and update presence handling
code = code.replace(
  `const playersCount = Object.keys(state).length;
        setPartnerOnline(playersCount > 1);`,
  `const playersCount = Object.keys(state).length;
        setPartnerOnline(playersCount > 1);
        
        // Check partner status
        const partnerState = Object.entries(state).find(([key]) => key !== playerId);
        if (partnerState && partnerState[1] && partnerState[1].length > 0) {
          const status = partnerState[1][0].status || 'online';
          setPartnerStatus(status);
          if (status === 'away') {
            setShowAwayToast(true);
            setTimeout(() => setShowAwayToast(false), 3000);
          }
        }`
);

code = code.replace(
  `if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }`,
  `if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString(), status: document.visibilityState === 'visible' ? 'online' : 'away' });
        }`
);

code = code.replace(
  `return () => {
      channel.unsubscribe();
    };`,
  `const handleVisibilityChange = async () => {
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
    };`
);

// 3. Fix setGameMode to prevent simultaneous clicks
code = code.replace(
  `const setGameMode = (mode: GameMode) => {`,
  `const setGameMode = async (mode: GameMode) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    
    // Check if mode is already updated by partner
    if (gameState.game_mode === mode) {
      setIsTransitioning(false);
      return;
    }`
);
code = code.replace(
  `card_prompt: null
    });
  };`,
  `card_prompt: null
    });
    
    setTimeout(() => setIsTransitioning(false), 500);
  };`
);

// 4. Update Header for Mobile (roomCode and partnerStatus)
code = code.replace(
  `{/* Header (Elegant Dark styling) */}`,
  `{/* Toast Notification for Away Status */}
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

      {/* Header (Elegant Dark styling) */}`
);
code = code.replace(
  `import { Heart, MessageCircleQuestion, Dices, Beer, ChevronLeft, LogOut, ChevronRight, Sparkles } from 'lucide-react';`,
  `import { Heart, MessageCircleQuestion, Dices, Beer, ChevronLeft, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';`
);

code = code.replace(
  `<div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">{partnerName}</span>
              <div className={\`w-2 h-2 rounded-full \${partnerOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-600'}\`}></div>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden sm:block">Room: {roomCode}</span>
          </div>`,
  `<div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">{partnerName}</span>
              <div className={\`w-2 h-2 rounded-full \${!partnerOnline ? 'bg-slate-600' : partnerStatus === 'away' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]'}\`}></div>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Room: <span className="text-slate-300 font-bold">{roomCode}</span></span>
          </div>`
);

// 5. Disable game card clicking during transition
code = code.replace(
  `onClick={() => setGameMode('qa')}`,
  `onClick={() => setGameMode('qa')}
                disabled={isTransitioning}`
);
code = code.replace(
  `onClick={() => setGameMode('truth_or_dare')}`,
  `onClick={() => setGameMode('truth_or_dare')}
                disabled={isTransitioning}`
);

// We need to pass disabled down to GameCard
code = code.replace(
  `function GameCard({ icon, title, description, onClick, theme }: { icon: React.ReactNode, title: string, description: string, onClick: () => void, theme: ThemeConfig }) {`,
  `function GameCard({ icon, title, description, onClick, theme, disabled }: { icon: React.ReactNode, title: string, description: string, onClick: () => void, theme: ThemeConfig, disabled?: boolean }) {`
);
code = code.replace(
  `onClick={onClick}
      className={\`group \${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 transition-all cursor-pointer relative overflow-hidden text-left flex flex-col h-full \${theme.borderAccent}\`}`,
  `onClick={onClick}
      disabled={disabled}
      className={\`group \${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 transition-all cursor-pointer relative overflow-hidden text-left flex flex-col h-full \${theme.borderAccent} \${disabled ? 'opacity-50 pointer-events-none' : ''}\`}`
);

// Never Have I ever card is a div, we need to handle it
code = code.replace(
  `onClick={() => setGameMode('never_have_i_ever')}
              >`,
  `onClick={() => setGameMode('never_have_i_ever')}
                className={\`col-span-1 md:col-span-2 group \${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 hover:\${theme.borderAccent} transition-all cursor-pointer flex items-center justify-between relative overflow-hidden \${isTransitioning ? 'opacity-50 pointer-events-none' : ''}\`}
              >`
);
// Remove the old className
code = code.replace(
  `className={\`col-span-1 md:col-span-2 group \${theme.panelBg} border border-white/5 rounded-3xl p-6 md:p-8 hover:\${theme.borderAccent} transition-all cursor-pointer flex items-center justify-between relative overflow-hidden\`}
                onClick={() => setGameMode('never_have_i_ever')}`,
  `onClick={() => setGameMode('never_have_i_ever')}`
);


fs.writeFileSync('src/components/Dashboard.tsx', code);
