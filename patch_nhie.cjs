const fs = require('fs');
let code = fs.readFileSync('src/components/games/NeverHaveIEver.tsx', 'utf-8');

// Add usedQuestions state
code = code.replace(
  `const [loadingQuestion, setLoadingQuestion] = useState(false);`,
  `const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set());`
);

// Fetch logs in fetchQuestions
code = code.replace(
  `const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('content')
        .eq('game_mode', 'never_have_i_ever')
        .eq('intensity', gameState.intensity_mode || 'friendly');
      
      if (data) {
        setQuestions(data.map(q => q.content));
      }
    };`,
  `const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('content')
        .eq('game_mode', 'never_have_i_ever')
        .eq('intensity', gameState.intensity_mode || 'friendly');
        
      const { data: logs } = await supabase.from('game_logs').select('question').eq('room_id', roomId).eq('game_mode', 'never_have_i_ever');
      if (logs) {
        setUsedQuestions(new Set(logs.map(l => l.question).filter(Boolean) as string[]));
      }
      
      if (data) {
        setQuestions(data.map(q => q.content));
      }
    };`
);

// Track current question
code = code.replace(
  `useEffect(() => {
    // Reset local state if question changes
    setRevealed(false);
  }, [gameState.current_question]);`,
  `useEffect(() => {
    if (gameState.current_question) {
      setUsedQuestions(prev => {
        const next = new Set(prev);
        next.add(gameState.current_question!);
        return next;
      });
    }
    // Reset local state if question changes
    setRevealed(false);
  }, [gameState.current_question]);`
);

// Filter in nextQuestion
code = code.replace(
  `const qList = questions.length > 0 ? questions : ["Never have I ever checked my partner's phone secretly.", "Never have I ever lied to get out of a date."];
    const q = qList[Math.floor(Math.random() * qList.length)];`,
  `const available = questions.filter(q => !usedQuestions.has(q));
    const defaultList = ["Never have I ever checked my partner's phone secretly.", "Never have I ever lied to get out of a date."];
    const qList = available.length > 0 ? available : (questions.length > 0 ? questions : defaultList);
    const q = qList[Math.floor(Math.random() * qList.length)];`
);

fs.writeFileSync('src/components/games/NeverHaveIEver.tsx', code);
