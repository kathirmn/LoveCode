import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, PlayerId, ThemeConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface NHIEProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => Promise<void>;
  playerId: PlayerId;
  roomId: string;
  onBack: () => void;
  theme: ThemeConfig;
}

export function NeverHaveIEver({ gameState, updateGameState, playerId, roomId, theme }: NHIEProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set());

  const myAnswerState = playerId === 'p1' ? gameState.p1_answer : gameState.p2_answer;
  const partnerAnswerState = playerId === 'p1' ? gameState.p2_answer : gameState.p1_answer;

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('content')
        .eq('game_mode', 'never_have_i_ever')
        .eq('intensity', gameState.intensity_mode || 'friendly');
      if (data) {
        setQuestions(data.map(q => q.content));
      }
    };
    fetchQuestions();
  }, [gameState.intensity_mode]);

  useEffect(() => {
    setRevealed(false);
    setCountdown(null);
  }, [gameState.current_question]);

  useEffect(() => {
    if (myAnswerState && partnerAnswerState && !revealed && countdown === null) {
      setCountdown(3);
    }
  }, [myAnswerState, partnerAnswerState, revealed, countdown]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setRevealed(true);
      setCountdown(null);

      // Only p1 logs to avoid duplicate logs in the database
      if (playerId === 'p1') {
        supabase.from('game_logs').insert([{
          room_id: roomId,
          game_mode: 'never_have_i_ever',
          question: gameState.current_question,
          p1_name: gameState.p1_name || 'Player 1',
          p1_answer: gameState.p1_answer,
          p2_name: gameState.p2_name || 'Player 2',
          p2_answer: gameState.p2_answer
        }]).then(({ error }) => {
          if (error) console.error('Failed to log game:', error);
        });
      }
    }
  }, [countdown]);

  const nextQuestion = async () => {
    setLoadingQuestion(true);
    const available = questions.filter(q => !usedQuestions.has(q));
    const defaultList = ["Never have I ever checked my partner's phone secretly.", "Never have I ever lied to get out of a date."];
    const qList = available.length > 0 ? available : (questions.length > 0 ? questions : defaultList);
    const q = qList[Math.floor(Math.random() * qList.length)];
    await updateGameState({
      current_question: q,
      p1_answer: null,
      p2_answer: null,
    });
    setLoadingQuestion(false);
  };

  const submitAnswer = async (answer: string) => {
    await updateGameState({
      [playerId === 'p1' ? 'p1_answer' : 'p2_answer']: answer
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Question Header */}
      <div className={`${theme.panelBg} border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm text-center relative overflow-hidden`}>
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${theme.primaryGrad}`} />
        <h2 className={`${theme.textAccent} text-xs font-semibold uppercase tracking-wider mb-2`}>Never Have I Ever</h2>
        {gameState.current_question ? (
          <h3 className="text-xl md:text-2xl font-bold text-white text-balance">{gameState.current_question}</h3>
        ) : (
          <div className="py-4">
            <button 
              onClick={nextQuestion}
              disabled={loadingQuestion}
              className={`px-6 py-3 ${theme.buttonBg} ${theme.buttonHover} text-white rounded-full text-sm font-medium transition-all shadow-lg ${theme.glow} disabled:opacity-50`}
            >
              Pick a Statement
            </button>
          </div>
        )}
      </div>

      {gameState.current_question && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* My Area */}
          <div className="space-y-4 border border-white/5 bg-slate-800/40 p-5 rounded-3xl backdrop-blur-sm">
            <h4 className="text-slate-400 text-sm font-medium">Your Answer</h4>
            {!myAnswerState ? (
              <div className="flex flex-col gap-3 h-32 justify-center">
                <button
                  onClick={() => submitAnswer('I Have')}
                  className={`w-full py-3 px-4 ${theme.buttonBg} ${theme.buttonHover} text-white rounded-2xl font-semibold transition-all shadow-lg ${theme.glow}`}
                >
                  I Have
                </button>
                <button
                  onClick={() => submitAnswer('I Have Not')}
                  className="w-full py-3 px-4 bg-slate-700/80 hover:bg-slate-600 text-white rounded-2xl font-semibold transition-all shadow-lg"
                >
                  I Have Not
                </button>
              </div>
            ) : (
              <div className="h-32 bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-center relative overflow-hidden">
                {revealed ? (
                  <p className={`text-center p-4 text-2xl font-bold ${myAnswerState === 'I Have' ? theme.textAccent : 'text-slate-300'}`}>{myAnswerState}</p>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <span>Answer submitted</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Partner Area */}
          <div className="space-y-4 border border-white/5 bg-slate-800/40 p-5 rounded-3xl backdrop-blur-sm relative">
            <h4 className="text-slate-400 text-sm font-medium">Partner's Answer</h4>
            
            <div className={`h-32 rounded-2xl flex items-center justify-center relative overflow-hidden transition-all ${partnerAnswerState ? 'bg-slate-900/50 border border-white/5' : 'bg-transparent border border-dashed border-white/10'}`}>
              {!partnerAnswerState ? (
                <div className="text-slate-500 text-center flex flex-col items-center gap-2">
                  <span className="text-sm">Waiting for partner...</span>
                </div>
              ) : revealed ? (
                <p className={`text-center p-4 text-2xl font-bold ${partnerAnswerState === 'I Have' ? theme.textAccent : 'text-slate-300'}`}>{partnerAnswerState}</p>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <span>Answer locked in</span>
                </div>
              )}

              {/* Blur Overlay before reveal */}
              {partnerAnswerState && !revealed && (
                <div className="absolute inset-0 backdrop-blur-xl bg-slate-900/50 flex items-center justify-center">
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-sm font-medium text-slate-300">
                    Hidden until you both answer
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.primaryGrad}`}
            >
              {countdown > 0 ? countdown : 'GO!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mt-4"
        >
          <button 
            onClick={nextQuestion}
            className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-white rounded-full text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Next Statement
          </button>
        </motion.div>
      )}
    </div>
  );
}
