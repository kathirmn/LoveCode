const fs = require('fs');
let code = fs.readFileSync('src/components/games/TruthOrDare.tsx', 'utf-8');

// 1. Add uploadError state
code = code.replace(
  `const [isUploading, setIsUploading] = useState(false);`,
  `const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);`
);

// 2. Clear uploadError on submit/upload
code = code.replace(
  `const submitText = async () => {
    if (!textAnswer.trim()) return;
    setIsUploading(true);`,
  `const submitText = async () => {
    if (!textAnswer.trim()) return;
    setIsUploading(true);
    setUploadError(null);`
);

code = code.replace(
  `const handleMediaUpload = async (file: File | Blob, type: 'voice' | 'image' | 'video') => {
    setIsUploading(true);`,
  `const handleMediaUpload = async (file: File | Blob, type: 'voice' | 'image' | 'video') => {
    setIsUploading(true);
    setUploadError(null);`
);

// 3. Handle upload error correctly
code = code.replace(
  `} else {
      console.error('Failed to upload media:', error);
    }`,
  `} else {
      console.error('Failed to upload media:', error);
      setUploadError(error?.message || 'Failed to upload media. Ensure the "truth-dare-media" storage bucket is public and allows inserts.');
    }`
);

// 4. Render the upload error in UI
code = code.replace(
  `{isUploading ? (
                        <div className="flex flex-col items-center py-4 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm">Uploading...</span>
                        </div>
                      ) : (`,
  `{isUploading ? (
                        <div className="flex flex-col items-center py-4 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm">Uploading...</span>
                        </div>
                      ) : uploadError ? (
                        <div className="flex flex-col items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-center">
                          <span className="text-sm">{uploadError}</span>
                          <button onClick={() => setUploadError(null)} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold uppercase">Try Again</button>
                        </div>
                      ) : (`
);

fs.writeFileSync('src/components/games/TruthOrDare.tsx', code);
