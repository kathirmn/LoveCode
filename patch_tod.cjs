const fs = require('fs');
let code = fs.readFileSync('src/components/games/TruthOrDare.tsx', 'utf-8');

// 1. Add usedPrompts state
code = code.replace(
  `const [fileType, setFileType] = useState<'image' | 'video'>('image');`,
  `const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [usedPrompts, setUsedPrompts] = useState<Set<string>>(new Set());`
);

// 2. Fetch game_logs in fetchQuestions
code = code.replace(
  `const dRes = await supabase.from('questions').select('content, input_type').eq('game_mode', 'dare').eq('intensity', mode);
        dData = dRes.data;
      }`,
  `const dRes = await supabase.from('questions').select('content, input_type').eq('game_mode', 'dare').eq('intensity', mode);
        dData = dRes.data;
      }
      
      const { data: logs } = await supabase.from('game_logs').select('question').eq('room_id', roomId).eq('game_mode', 'truth_or_dare');
      if (logs) {
        setUsedPrompts(new Set(logs.map(l => l.question).filter(Boolean) as string[]));
      }`
);

// 3. Track new questions picked via gameState
code = code.replace(
  `if (!gameState.card_flipped) {`,
  `if (gameState.card_prompt) {
      setUsedPrompts(prev => {
        const next = new Set(prev);
        next.add(gameState.card_prompt!);
        return next;
      });
    }
    
    if (!gameState.card_flipped) {`
);

// 4. Use usedPrompts in handlePick
code = code.replace(
  `const list = type === 'truth' ? truths : dares;
    const defaultList: Question[] = type === 'truth' 
      ? [{ content: "What's a secret you've never told me?", input_type: 'text' }] 
      : [{ content: "Do 10 pushups.", input_type: 'text' }];
    const source = list.length > 0 ? list : defaultList;`,
  `const list = type === 'truth' ? truths : dares;
    const available = list.filter(q => !usedPrompts.has(q.content));
    const defaultList: Question[] = type === 'truth' 
      ? [{ content: "What's a secret you've never told me?", input_type: 'text' }] 
      : [{ content: "Do 10 pushups.", input_type: 'text' }];
    const source = available.length > 0 ? available : (list.length > 0 ? list : defaultList);`
);

fs.writeFileSync('src/components/games/TruthOrDare.tsx', code);
