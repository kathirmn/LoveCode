const fs = require('fs');
let code = fs.readFileSync('src/components/games/SimultaneousQA.tsx', 'utf-8');

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
        .eq('game_mode', 'qa')
        .eq('intensity', gameState.intensity_mode || 'friendly');
      
      if (data) {
        setQuestions(data.map(q => q.content));
      }
    };`,
  `const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('content')
        .eq('game_mode', 'qa')
        .eq('intensity', gameState.intensity_mode || 'friendly');
        
      const { data: logs } = await supabase.from('game_logs').select('question').eq('room_id', roomId).eq('game_mode', 'qa');
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
  `// Reset local state if question changes
    setAnswer('');
    setRevealed(false);
    setCountdown(null);`,
  `if (gameState.current_question) {
      setUsedQuestions(prev => {
        const next = new Set(prev);
        next.add(gameState.current_question!);
        return next;
      });
    }

    // Reset local state if question changes
    setAnswer('');
    setRevealed(false);
    setCountdown(null);`
);

// Filter in nextQuestion
code = code.replace(
  `const qList = questions.length > 0 ? questions : ["What is your favorite memory of us?", "What was your first impression of me?"];
    const q = qList[Math.floor(Math.random() * qList.length)];`,
  `const available = questions.filter(q => !usedQuestions.has(q));
    const defaultList = ["What is your favorite memory of us?", "What was your first impression of me?"];
    const qList = available.length > 0 ? available : (questions.length > 0 ? questions : defaultList);
    const q = qList[Math.floor(Math.random() * qList.length)];`
);

fs.writeFileSync('src/components/games/SimultaneousQA.tsx', code);
