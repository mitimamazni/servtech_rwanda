import { useState, useEffect } from 'react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { Trophy, Plus, X, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS = {
  upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  live:     'bg-amber-50 text-amber-700 border-amber-200',
  finished: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled:'bg-red-50 text-red-700 border-red-200',
};

const OUTCOME_COLORS = {
  win:     'bg-green-50 text-green-700 border-green-200',
  loss:    'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function AdminSportsbook() {
  const [tab, setTab] = useState('matches');
  const [matches, setMatches] = useState([]);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [settling, setSettling] = useState(null); // match being settled
  const [form, setForm] = useState({ sport: 'football', league: '', home_team: '', away_team: '', start_time: '', odds_home: '', odds_draw: '', odds_away: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([axios.get('/admin/matches'), axios.get('/admin/bets')])
      .then(([m, b]) => { setMatches(m.data); setBets(b.data); })
      .catch(() => toast.error('Failed to load sportsbook data'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createMatch = async (e) => {
    e.preventDefault();
    if (!form.home_team || !form.away_team || !form.start_time || !form.odds_home || !form.odds_away) {
      return toast.error('Fill in required fields');
    }
    setSaving(true);
    try {
      await axios.post('/admin/matches', { ...form, odds_draw: form.odds_draw || null });
      toast.success('Match created');
      setShowForm(false);
      setForm({ sport: 'football', league: '', home_team: '', away_team: '', start_time: '', odds_home: '', odds_draw: '', odds_away: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create match');
    } finally {
      setSaving(false);
    }
  };

  const settleMatch = async (matchId, result) => {
    try {
      const res = await axios.patch(`/admin/matches/${matchId}/settle`, { result });
      toast.success(`Match settled — ${res.data.bets_settled} bet(s) resolved`);
      setSettling(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to settle match');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => setShowForm(true)}
          className="text-sm text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={14} /> New Match
        </button>
      </Navbar>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-primary-600" />
          <h1 className="text-xl font-semibold text-gray-800">Sportsbook Management</h1>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {['matches', 'bets'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'matches' ? `Matches (${matches.length})` : `All Bets (${bets.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : tab === 'matches' ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {matches.map(match => (
              <div key={match.id} className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-gray-400">{match.league || match.sport}</p>
                  <p className="text-sm font-medium text-gray-800">{match.home_team} vs {match.away_team}</p>
                  <p className="text-xs text-gray-400">{new Date(match.start_time).toLocaleString('en-RW')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {parseFloat(match.odds_home).toFixed(2)}{match.odds_draw ? ` / ${parseFloat(match.odds_draw).toFixed(2)}` : ''} / {parseFloat(match.odds_away).toFixed(2)}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[match.status]}`}>
                    {match.status}{match.result ? ` · ${match.result}` : ''}
                  </span>
                  {match.status !== 'finished' && match.status !== 'cancelled' && (
                    settling === match.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => settleMatch(match.id, 'home')} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">{match.home_team} won</button>
                        {match.odds_draw && <button onClick={() => settleMatch(match.id, 'draw')} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Draw</button>}
                        <button onClick={() => settleMatch(match.id, 'away')} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">{match.away_team} won</button>
                        <button onClick={() => setSettling(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setSettling(match.id)}
                        className="text-xs inline-flex items-center gap-1 text-primary-700 border border-primary-200 hover:bg-primary-50 px-2.5 py-1 rounded-lg font-medium">
                        <CheckCircle2 size={13} /> Settle
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {bets.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No bets placed yet</div>
            ) : bets.map(bet => (
              <div key={bet.id} className="px-5 py-3.5 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{bet.first_name} {bet.last_name}</p>
                  <p className="text-xs text-gray-400">
                    {bet.game}{bet.selection ? ` · ${bet.selection} @ ${parseFloat(bet.odds).toFixed(2)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{parseInt(bet.amount).toLocaleString()} RWF</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${OUTCOME_COLORS[bet.outcome]}`}>{bet.outcome}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">New Match</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={createMatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="football">Football</option>
                  <option value="basketball">Basketball</option>
                  <option value="boxing">Boxing</option>
                </select>
                <input placeholder="League" value={form.league} onChange={e => setForm({ ...form, league: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Home team *" value={form.home_team} onChange={e => setForm({ ...form, home_team: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                <input placeholder="Away team *" value={form.away_team} onChange={e => setForm({ ...form, away_team: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <input type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              <div className="grid grid-cols-3 gap-3">
                <input type="number" step="0.01" placeholder="Odds home *" value={form.odds_home} onChange={e => setForm({ ...form, odds_home: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                <input type="number" step="0.01" placeholder="Odds draw" value={form.odds_draw} onChange={e => setForm({ ...form, odds_draw: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" step="0.01" placeholder="Odds away *" value={form.odds_away} onChange={e => setForm({ ...form, odds_away: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                {saving ? 'Creating...' : 'Create Match'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
