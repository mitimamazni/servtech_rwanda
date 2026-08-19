import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { Wallet, Trophy, LayoutDashboard, X, AlertTriangle, ShieldOff } from 'lucide-react';

const SPORT_ICON = { football: '⚽', basketball: '🏀', boxing: '🥊' };

const EXCLUSION_OPTIONS = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'indefinite', label: 'Indefinitely' },
];

export default function Sportsbook() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [balance, setBalance] = useState(null);
  const [excludedUntil, setExcludedUntil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slip, setSlip] = useState(null); // { match, selection, odds }
  const [stake, setStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [excluding, setExcluding] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/matches'),
      axios.get('/client/dashboard'),
    ])
      .then(([matchesRes, dashRes]) => {
        setMatches(matchesRes.data);
        setBalance(dashRes.data.client.wallet_balance);
        const until = dashRes.data.client.self_exclusion_until;
        setExcludedUntil(until && new Date(until) > new Date() ? until : null);
      })
      .catch(() => toast.error('Failed to load sportsbook'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openSlip = (match, selection, odds) => {
    if (odds === null || excludedUntil) return;
    setSlip({ match, selection, odds });
    setStake('');
  };

  const potentialPayout = slip && stake ? (parseFloat(stake) * parseFloat(slip.odds)).toFixed(0) : 0;

  const placeBet = async () => {
    const amount = parseFloat(stake);
    if (!amount || amount <= 0) return toast.error('Enter a valid stake');
    if (balance !== null && amount > parseFloat(balance)) return toast.error('Insufficient wallet balance');

    setPlacing(true);
    try {
      const res = await axios.post('/bets', { match_id: slip.match.id, selection: slip.selection, stake: amount });
      setBalance(res.data.wallet_balance);
      toast.success('Bet placed!');
      setSlip(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const confirmSelfExclusion = async (duration) => {
    setExcluding(true);
    try {
      const res = await axios.post('/self-exclusion', { duration });
      setExcludedUntil(res.data.self_exclusion_until);
      setSlip(null);
      setShowExclusionModal(false);
      toast.success('Self-exclusion set. Take care.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set self-exclusion');
    } finally {
      setExcluding(false);
    }
  };

  const selectionLabel = (match, sel) => sel === 'home' ? match.home_team : sel === 'away' ? match.away_team : 'Draw';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/client/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <LayoutDashboard size={14} /> Dashboard
        </button>
      </Navbar>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6 pb-28">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-primary-600" />
            <h1 className="text-xl font-semibold text-gray-800">Sportsbook</h1>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
            <Wallet size={16} className="text-primary-600" />
            <span className="text-sm text-gray-500">Balance:</span>
            <span className="text-sm font-semibold text-gray-800">
              {balance !== null ? `${parseInt(balance).toLocaleString()} RWF` : '—'}
            </span>
          </div>
        </div>

        {excludedUntil ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <ShieldOff size={24} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">You've self-excluded from betting</p>
            <p className="text-xs text-red-500 mt-1">
              Betting is locked until {new Date(excludedUntil).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric' })}.
              Contact support if you need help before then.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading matches...
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">No matches open for betting right now.</div>
        ) : (
          <div className="space-y-3">
            {matches.map(match => (
              <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-medium text-gray-400">
                      {SPORT_ICON[match.sport] || '🎮'} {match.league || match.sport}
                    </span>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">
                      {match.home_team} <span className="text-gray-400 font-normal">vs</span> {match.away_team}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(match.start_time).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`grid ${match.odds_draw !== null ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                  {[
                    { sel: 'home', label: match.home_team, odds: match.odds_home },
                    ...(match.odds_draw !== null ? [{ sel: 'draw', label: 'Draw', odds: match.odds_draw }] : []),
                    { sel: 'away', label: match.away_team, odds: match.odds_away },
                  ].map(({ sel, label, odds }) => (
                    <button key={sel} onClick={() => openSlip(match, sel, odds)}
                      className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                        slip?.match.id === match.id && slip?.selection === sel
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/50'
                      }`}>
                      <p className="text-[11px] text-gray-500 truncate">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{parseFloat(odds).toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              <strong>Responsible Gambling Notice:</strong> Gambling should be entertaining, not a source of income.
              Please bet within your means.
            </p>
          </div>
          {!excludedUntil && (
            <button onClick={() => setShowExclusionModal(true)}
              className="text-xs font-medium text-amber-700 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
              Take a break
            </button>
          )}
        </div>
      </div>

      {/* Bet slip */}
      {slip && !excludedUntil && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-4 z-20">
          <div className="max-w-4xl mx-auto flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  {selectionLabel(slip.match, slip.selection)} <span className="text-gray-400 font-normal">@ {parseFloat(slip.odds).toFixed(2)}</span>
                </p>
                <button onClick={() => setSlip(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400">{slip.match.home_team} vs {slip.match.away_team}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stake (RWF)</label>
              <input type="number" min="1" value={stake} onChange={e => setStake(e.target.value)}
                placeholder="0" autoFocus
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Potential payout</p>
              <p className="text-sm font-semibold text-gray-800">{parseInt(potentialPayout || 0).toLocaleString()} RWF</p>
            </div>
            <button onClick={placeBet} disabled={placing}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
              {placing ? 'Placing...' : 'Place Bet'}
            </button>
          </div>
        </div>
      )}

      {/* Self-exclusion modal */}
      {showExclusionModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ShieldOff size={18} className="text-red-500" /> Take a break</h3>
              <button onClick={() => setShowExclusionModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              You won't be able to place bets for the period you choose. This can't be undone by yourself once set — you'd need to contact support.
            </p>
            <div className="space-y-2">
              {EXCLUSION_OPTIONS.map(opt => (
                <button key={opt.value} disabled={excluding} onClick={() => confirmSelfExclusion(opt.value)}
                  className="w-full text-left text-sm border border-gray-200 hover:border-red-300 hover:bg-red-50 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

