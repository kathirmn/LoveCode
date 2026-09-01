import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, PlayerId, ThemeConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Mic, Square, Camera, Video, Send, Loader2, Play } from 'lucide-react';

interface TruthOrDareProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => Promise<void>;
  playerId: PlayerId;
  roomId: string;
  onBack: () => void;
  theme: ThemeConfig;
}

interface Question {
  content: string;
  input_type?: 'text' | 'voice' | 'image' | 'video';
}

export function TruthOrDare({ gameState, updateGameState, playerId, roomId, theme }: TruthOrDareProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [truths, setTruths] = useState<Question[]>([]);
  const [dares, setDares] = useState<Question[]>([]);
  
  const [submittedAnswer, setSubmittedAnswer] = useState<{ type: string, content: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [usedPrompts, setUsedPrompts] = useState<Set<string>>(new Set());

  // Derive input type robustly from local state to avoid needing a DB column sync
  const activeQuestion = [...truths, ...dares].find(q => q.content === gameState.card_prompt);
  const currentInputType = activeQuestion?.input_type?.toLowerCase() || 'text';

  useEffect(() => {
    const fetchQuestions = async () => {
      const mode = gameState.intensity_mode || 'friendly';
      let tData, dData;
      
      // Try fetching with input_type first
      const res = await supabase.from('questions').select('content, input_type').eq('game_mode', 'truth').eq('intensity', mode);
      
      if (res.error) {
        // Fallback: If input_type column doesn't exist yet, just fetch content
        const tFallback = await supabase.from('questions').select('content').eq('game_mode', 'truth').eq('intensity', mode);
        const dFallback = await supabase.from('questions').select('content').eq('game_mode', 'dare').eq('intensity', mode);
        tData = tFallback.data;
        dData = dFallback.data;
      } else {
        tData = res.data;
        const dRes = await supabase.from('questions').select('content, input_type').eq('game_mode', 'dare').eq('intensity', mode);
        dData = dRes.data;
      }
      
      const { data: logs } = await supabase.from('game_logs').select('question').eq('room_id', roomId).eq('game_mode', 'truth_or_dare');
      if (logs) {
        setUsedPrompts(new Set(logs.map(l => l.question).filter(Boolean) as string[]));
      }
      
      if (tData) setTruths(tData as Question[]);
      if (dData) setDares(dData as Question[]);
    };
    fetchQuestions();
  }, [gameState.intensity_mode]);

  useEffect(() => {
    if (gameState.card_prompt) {
      setUsedPrompts(prev => {
        const next = new Set(prev);
        next.add(gameState.card_prompt!);
        return next;
      });
    }
    
    if (!gameState.card_flipped) {
      setSubmittedAnswer(null);
      setTextAnswer('');
    }
  }, [gameState.card_flipped]);

  useEffect(() => {
    const channel = supabase.channel(`tod-answer:${roomId}`);
    channel.on('broadcast', { event: 'answer' }, (payload) => {
      setSubmittedAnswer(payload.payload);
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    }
  }, [roomId]);

  const isMyTurn = gameState.current_turn === playerId;

  const handlePick = async (type: 'truth' | 'dare') => {
    if (!isMyTurn) return;
    setIsFlipping(true);
    
    const list = type === 'truth' ? truths : dares;
    const available = list.filter(q => !usedPrompts.has(q.content));
    const defaultList: Question[] = type === 'truth' 
      ? [{ content: "What's a secret you've never told me?", input_type: 'text' }] 
      : [{ content: "Do 10 pushups.", input_type: 'text' }];
    const source = available.length > 0 ? available : (list.length > 0 ? list : defaultList);
    const q = source[Math.floor(Math.random() * source.length)];
    
    setTimeout(async () => {
      await updateGameState({
        card_type: type,
        card_prompt: q.content,
        card_flipped: true
      });
      setIsFlipping(false);
    }, 600);
  };

  const nextTurn = async () => {
    await updateGameState({
      current_turn: playerId === 'p1' ? 'p2' : 'p1',
      card_type: null,
      card_prompt: null,
      card_flipped: false
    });
  };

  const broadcastAndLog = async (payload: { type: string, content: string }) => {
    setSubmittedAnswer(payload);
    
    supabase.channel(`tod-answer:${roomId}`).send({
      type: 'broadcast',
      event: 'answer',
      payload
    });

    if (payload.type !== 'voice') {
      await supabase.from('game_logs').insert([{
        room_id: roomId,
        game_mode: 'truth_or_dare',
        question: gameState.card_prompt,
        p1_name: gameState.p1_name || 'Player 1',
        p1_answer: playerId === 'p1' ? (payload.type === 'text' ? payload.content : `[${payload.type}]`) : null,
        p2_name: gameState.p2_name || 'Player 2',
        p2_answer: playerId === 'p2' ? (payload.type === 'text' ? payload.content : `[${payload.type}]`) : null,
        media_url: ['image', 'video'].includes(payload.type) ? payload.content : null
      }]);
    }
  };

  const submitText = async () => {
    if (!textAnswer.trim()) return;
    setIsUploading(true);
    setUploadError(null);
    await broadcastAndLog({ type: 'text', content: textAnswer });
    setIsUploading(false);
  };

  const handleMediaUpload = async (file: File | Blob, type: 'voice' | 'image' | 'video') => {
    setIsUploading(true);
    setUploadError(null);
    const ext = type === 'voice' ? 'webm' : (file instanceof File ? file.name.split('.').pop() || 'jpg' : 'mp4');
    const fileName = `${roomId}/${Date.now()}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from('truth-dare-media')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
      
    if (data) {
      const { data: { publicUrl } } = supabase.storage
        .from('truth-dare-media')
        .getPublicUrl(fileName);
      await broadcastAndLog({ type, content: publicUrl });
    } else {
      console.error('Failed to upload media:', error);
      setUploadError(error?.message || 'Failed to upload media. Ensure the "truth-dare-media" storage bucket is public and allows inserts.');
    }
    setIsUploading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleMediaUpload(blob, 'voice');
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (e) {
      console.error("Microphone error", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const triggerFileInput = (type: 'image' | 'video') => {
    setFileType(type);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleMediaUpload(file, fileType);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 min-h-[60vh] gap-8 w-full max-w-md mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-light tracking-tight text-white">Truth or Dare</h2>
        <p className={`text-xs px-3 py-1 rounded-md inline-block font-bold uppercase tracking-wider ${isMyTurn ? `${theme.panelBg} ${theme.textAccent}` : 'bg-slate-800/50 text-slate-400'}`}>
          {isMyTurn ? "It's your turn!" : "Waiting for partner..."}
        </p>
      </div>

      <div className="relative w-full h-auto perspective-[1000px]">
        <motion.div
          className="w-full relative preserve-3d"
          animate={{ rotateY: gameState.card_flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Card Front */}
          <div 
            className={`w-full min-h-[24rem] backface-hidden rounded-3xl bg-gradient-to-br ${theme.primaryGrad} opacity-30 border border-white/10 p-1 shadow-2xl backdrop-blur-md`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-full h-full min-h-[24rem] bg-slate-900/80 rounded-[22px] flex flex-col items-center justify-center p-6 gap-6">
              {isMyTurn ? (
                <>
                  <div className="w-16 h-16 border border-white/10 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-3xl font-light text-slate-400">?</span>
                  </div>
                  <div className="w-full space-y-3">
                    <button 
                      onClick={() => handlePick('truth')}
                      disabled={isFlipping}
                      className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHover} text-white rounded-2xl text-sm font-bold tracking-widest transition-colors shadow-lg ${theme.glow}`}
                    >
                      TRUTH
                    </button>
                    <button 
                      onClick={() => handlePick('dare')}
                      disabled={isFlipping}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white border border-white/5 rounded-2xl text-sm font-bold tracking-widest transition-colors shadow-lg"
                    >
                      DARE
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-400 space-y-4">
                  <div className={`w-16 h-16 border border-white/10 ${theme.panelBg} rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse`}>
                    <span className={`text-3xl font-light ${theme.textAccent}`}>?</span>
                  </div>
                  <p className="text-sm">Partner is choosing...</p>
                </div>
              )}
            </div>
          </div>

          {/* Card Back */}
          <div 
            className={`absolute top-0 inset-x-0 w-full min-h-[24rem] backface-hidden rounded-3xl p-1 shadow-2xl ${theme.glow} border border-white/10 bg-slate-800/40 backdrop-blur-xl`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className={`w-full h-full min-h-[24rem] rounded-[22px] flex flex-col p-6 text-center ${gameState.card_type === 'truth' ? theme.panelBg : 'bg-slate-900/50'}`}>
              <div className="flex justify-center mb-4">
                <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-md ${theme.buttonBg} text-white`}>
                  {gameState.card_type}
                </span>
              </div>
              <p className="text-xl font-light text-white text-balance leading-relaxed mb-6">
                "{gameState.card_prompt}"
              </p>

              {/* Answer Phase */}
              <div className="mt-auto flex flex-col gap-4">
                {!submittedAnswer ? (
                  isMyTurn ? (
                    <div className="w-full">
                      {isUploading ? (
                        <div className="flex flex-col items-center py-4 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm">Uploading...</span>
                        </div>
                      ) : uploadError ? (
                        <div className="flex flex-col items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-center">
                          <span className="text-sm">{uploadError}</span>
                          <button onClick={() => setUploadError(null)} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold uppercase">Try Again</button>
                        </div>
                      ) : (
                        <>
                          {currentInputType === 'text' && (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={textAnswer}
                                onChange={e => setTextAnswer(e.target.value)}
                                placeholder="Type your answer..."
                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none resize-none h-24"
                              />
                              <button onClick={submitText} disabled={!textAnswer.trim()} className={`w-full py-2.5 ${theme.buttonBg} text-white rounded-xl font-medium flex items-center justify-center gap-2`}>
                                <Send className="w-4 h-4" /> Submit
                              </button>
                            </div>
                          )}
                          
                          {currentInputType === 'voice' && (
                            <button 
                              onPointerDown={startRecording}
                              onPointerUp={stopRecording}
                              onPointerLeave={stopRecording}
                              className={`w-full py-6 rounded-2xl flex flex-col items-center gap-2 ${isRecording ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-900/50 text-slate-300'}`}
                            >
                              <div className={`p-4 rounded-full ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800'}`}>
                                {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
                              </div>
                              <span className="text-sm font-medium select-none">{isRecording ? 'Recording...' : 'Hold to Record'}</span>
                            </button>
                          )}

                          {currentInputType === 'image' && (
                            <button onClick={() => triggerFileInput('image')} className="w-full py-4 bg-slate-900/50 text-slate-300 rounded-2xl flex flex-col items-center gap-2 hover:bg-slate-800">
                              <Camera className="w-6 h-6" />
                              <span className="text-sm font-medium">Snap Photo</span>
                            </button>
                          )}

                          {currentInputType === 'video' && (
                            <button onClick={() => triggerFileInput('video')} className="w-full py-4 bg-slate-900/50 text-slate-300 rounded-2xl flex flex-col items-center gap-2 hover:bg-slate-800">
                              <Video className="w-6 h-6" />
                              <span className="text-sm font-medium">Record Video</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 bg-black/20 rounded-2xl">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
                      <span className="text-sm">Waiting for partner's response...</span>
                    </div>
                  )
                ) : (
                  <div className="w-full bg-black/20 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">Response</span>
                    {submittedAnswer.type === 'text' && (
                      <p className="text-white text-lg italic">"{submittedAnswer.content}"</p>
                    )}
                    {submittedAnswer.type === 'voice' && (
                      <audio controls src={submittedAnswer.content} className="w-full max-w-[200px]" />
                    )}
                    {submittedAnswer.type === 'image' && (
                      <img src={submittedAnswer.content} alt="Partner response" className="w-full h-48 object-cover rounded-xl" />
                    )}
                    {submittedAnswer.type === 'video' && (
                      <video controls src={submittedAnswer.content} className="w-full h-48 bg-black rounded-xl" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        accept={fileType === 'image' ? 'image/*' : 'video/*'} 
        capture="environment" 
        className="hidden" 
      />

      <AnimatePresence>
        {gameState.card_flipped && submittedAnswer && isMyTurn && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <button 
              onClick={nextTurn}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full text-xs font-medium uppercase tracking-widest flex items-center gap-2 transition-colors border border-white/10 backdrop-blur-md shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              Next Turn
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
