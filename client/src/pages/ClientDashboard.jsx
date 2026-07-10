import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { BadgeCheck, Clock, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, RefreshCw } from 'lucide-react';

const OutcomeBadge = ({ outcome }) => {
  const map = {
    win:     'bg-green-50 text-green-700 border-green-200',
    loss:    'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[outcome]}`}>
      {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
    </span>
  );
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/client/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading your dashboard...
      </div>
    </div>
  );

  const { client, bets, stats } = data || {};
  const winRate = stats?.total_bets > 0 ? Math.round((stats.wins / stats.total_bets) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-bold text-xl">
                  {client?.first_name?.charAt(0)}{client?.last_name?.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{client?.first_name} {client?.last_name}</h2>
                <p className="text-sm text-gray-500">{client?.email}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{client?.id_number}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {client?.status === 'verified' ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full text-sm font-medium">
                  <BadgeCheck size={15} /> Verified
                </span>
              ) : client?.status === 'rejected' ? (
                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-sm font-medium">
                  <AlertTriangle size={15} /> Verification Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-sm font-medium">
                  <Clock size={15} /> Pending Verification
                </span>
              )}
              <p className="text-xs text-gray-400">{client?.district}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            {[
              { label: 'Phone',    value: client?.phone || 'N/A' },
              { label: 'Igitsina', value: client?.gender || 'N/A' },
              { label: 'District', value: client?.district || 'N/A' },
              { label: 'Member Since', value: new Date(client?.created_at).toLocaleDateString('en-RW', { month: 'short', year: 'numeric' }) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-700">{value}</p>
              </div>
            ))}
          </div>

          {client?.status === 'rejected' && (
            <div className="mt-6 bg-red-50 border border-red-100 rounded-xl px-4 py-4">
              <p className="text-sm text-red-700">
                <span className="font-medium">Your verification was not approved.</span>
                {client?.rejection_reason && <> Reason: {client.rejection_reason}</>}
              </p>
              <button onClick={() => navigate('/client/resubmit')}
                className="mt-3 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg font-medium">
                <RefreshCw size={14} /> Resubmit for review
              </button>
            </div>
          )}
        </div>

        {/* Betting stats */}
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-4">Betting Summary</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Bets',     value: stats?.total_bets || 0,                               icon: Target,       color: 'bg-primary-600' },
              { label: 'Total Wagered',  value: `${parseInt(stats?.total_wagered || 0).toLocaleString()} RWF`, icon: DollarSign, color: 'bg-indigo-500' },
              { label: 'Win Rate',       value: `${winRate}%`,                                         icon: TrendingUp,   color: 'bg-green-500' },
              { label: 'Losses',         value: stats?.losses || 0,                                   icon: TrendingDown, color: 'bg-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${color}`}><Icon size={18} className="text-white" /></div>
                <div>
                  <p className="text-lg font-semibold text-gray-800">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent bets */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">Recent Bets</h3>
          </div>
          {bets?.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No betting activity yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {bets?.map(bet => (
                <div key={bet.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{bet.game}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(bet.placed_at).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{parseInt(bet.amount).toLocaleString()} RWF</span>
                    <OutcomeBadge outcome={bet.outcome} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Responsible gambling notice */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            <strong>Responsible Gambling Notice:</strong> Gambling should be entertaining, not a source of income.
            If you feel your gambling is becoming a problem, please contact the ServTech support team.
          </p>
        </div>
      </div>
    </div>
  );
}
