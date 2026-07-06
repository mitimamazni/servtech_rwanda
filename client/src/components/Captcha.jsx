import { useState, useEffect } from 'react';
import axios from '../utils/axios';
import { RefreshCw } from 'lucide-react';

// Self-hosted math CAPTCHA — no external API/keys needed.
// Reports { captcha_token, captcha_answer } back via onChange whenever the
// user types an answer, so the parent form can just spread it into its payload.
export default function Captcha({ onChange }) {
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchChallenge = () => {
    setLoading(true);
    setAnswer('');
    onChange({ captcha_token: null, captcha_answer: '' });
    axios.get('/captcha')
      .then(r => setChallenge(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchChallenge(); }, []);

  const handleAnswerChange = (v) => {
    setAnswer(v);
    onChange({ captcha_token: challenge?.token, captcha_answer: v });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Verify you're human</label>
      <div className="flex items-center gap-2">
        <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 select-none min-w-[90px] text-center">
          {loading ? '...' : `${challenge?.question} =`}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={answer}
          onChange={e => handleAnswerChange(e.target.value)}
          placeholder="?"
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm w-20"
        />
        <button type="button" onClick={fetchChallenge}
          className="text-gray-400 hover:text-gray-600 p-2" title="New question">
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );
}
