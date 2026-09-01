import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, PlayerId, ThemeConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import { Send, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface QAProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => Promise<void>;
  playerId: PlayerId;
  roomId: string;
  onBack: () => void;
  theme: ThemeConfig;
}

export function SimultaneousQA({ gameState, updateGameState, playerId, roomId, theme }: QAProps) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const partnerId = playerId === 'p1' ? 'p2' : 'p1';
  const myAnswerState = playerId === 'p1' ? gameState.p1_answer : gameState.p2_answer;
  const partnerAnswerState = playerId === 'p1' ? gameState.p2_answer : gameState.p1_answer;

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('content')
        .eq('game_mode', 'qa')
        .eq('intensity', gameState.intensity_mode || 'friendly');
      if (data) {
        setQuestions(data.map(q => q.content));
      }
    };
    fetchQuestions();
  }, [gameState.intensity_mode]);

  useEffect(() => {
    // Reset local state if question changes
    setAnswer('');
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
          game_mode: 'qa',
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

  useEffect(() => {
    const channel = supabase.channel(`qa-typing:${roomId}`);
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload.player !== playerId) {
        setPartnerTyping(payload.payload.typing);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      supabase.channel(`qa-typing:${roomId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { player: playerId, typing: true }
      });
      
      setTimeout(() => {
        setIsTyping(false);
        supabase.channel(`qa-typing:${roomId}`).send({
          type: 'broadcast',
          event: 'typing',
          payload: { player: playerId, typing: false }
        });
      }, 2000);
    }
  };

  const nextQuestion = async () => {
    setLoadingQuestion(true);
    const qList = questions.length > 0 ? questions : ["What is your favorite memory of us?", "What was your first impression of me?"];
    const q = qList[Math.floor(Math.random() * qList.length)];
    await updateGameState({
      current_question: q,
      p1_answer: null,
      p2_answer: null,
    });
    setLoadingQuestion(false);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setIsSubmitting(true);
    await updateGameState({
      [playerId === 'p1' ? 'p1_answer' : 'p2_answer']: answer
    });
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Question Header */}
      <div className={`${theme.panelBg} border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm text-center relative overflow-hidden`}>
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${theme.primaryGrad}`} />
        <h2 className={`${theme.textAccent} text-xs font-semibold uppercase tracking-wider mb-2`}>Simultaneous Q&A</h2>
        {gameState.current_question ? (
          <h3 className="text-xl md:text-2xl font-bold text-white text-balance">{gameState.current_question}</h3>
        ) : (
          <div className="py-4">
            <button 
              onClick={nextQuestion}
              disabled={loadingQuestion}
              className={`px-6 py-3 ${theme.buttonBg} ${theme.buttonHover} text-white rounded-full text-sm font-medium transition-all shadow-lg ${theme.glow} disabled:opacity-50`}
            >
              Pick a Question
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
              <>
                <textarea
                  value={answer}
                  onChange={handleTyping}
                  placeholder="Type your answer here..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 resize-none h-32 transition-all"
                />
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim() || isSubmitting}
                  className={`w-full py-3 px-4 ${theme.buttonBg} ${theme.buttonHover} disabled:opacity-50 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg ${theme.glow}`}
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Submit Answer
                </button>
              </>
            ) : (
              <div className="h-40 bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-center relative overflow-hidden">
                {revealed ? (
                  <p className="text-white text-center p-4 text-lg font-medium">{myAnswerState}</p>
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
            
            <div className={`h-[11.5rem] rounded-2xl flex items-center justify-center relative overflow-hidden transition-all ${partnerAnswerState ? 'bg-slate-900/50 border border-white/5' : 'bg-transparent border border-dashed border-white/10'}`}>
              {!partnerAnswerState ? (
                <div className="text-slate-500 text-center flex flex-col items-center gap-2">
                  {partnerTyping ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-sm">Partner is typing...</span>
                    </>
                  ) : (
                    <span className="text-sm">Waiting for partner...</span>
                  )}
                </div>
              ) : revealed ? (
                <p className="text-white text-center p-4 text-lg font-medium">{partnerAnswerState}</p>
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
            Next Question
          </button>
        </motion.div>
      )}
    </div>
  );
}
