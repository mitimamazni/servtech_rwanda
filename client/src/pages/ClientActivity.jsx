import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { ArrowLeft, BadgeCheck, Clock, TrendingUp, TrendingDown, DollarSign, Target, Loader } from 'lucide-react';

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

export default function ClientActivity() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/client/${clientId}/activity`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load client activity'))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading client data...
      </div>
    </div>
  );

  const { client, bets, stats } = data || {};
  const winRate = stats?.total_bets > 0 ? Math.round((stats.wins / stats.total_bets) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Client profile */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-bold">{client?.first_name?.charAt(0)}{client?.last_name?.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{client?.first_name} {client?.last_name}</h2>
                <p className="text-xs text-gray-500 font-mono">{client?.id_number}</p>
                <p className="text-xs text-gray-400">{client?.email}</p>
              </div>
            </div>
            {client?.status === 'verified'
              ? <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-medium"><BadgeCheck size={13} /> Verified</span>
              : <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-medium"><Clock size={13} /> Pending</span>
            }
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
            <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium text-gray-700">{client?.phone || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Igitsina</p><p className="font-medium text-gray-700">{client?.gender || '—'}</p></div>
            <div><p className="text-xs text-gray-400">District</p><p className="font-medium text-gray-700">{client?.district || '—'}</p></div>
            <div>
              <p className="text-xs text-gray-400">Registered By</p>
              <p className="font-medium text-gray-700">{client?.agent_name || 'Self-registered'}</p>
              {client?.agent_phone && <p className="text-xs text-gray-400">{client.agent_phone}</p>}
            </div>
          </div>
        </div>

        {/* Betting stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Bets',    value: stats?.total_bets || 0,                                    icon: Target,       color: 'bg-primary-600' },
            { label: 'Total Wagered', value: `${parseInt(stats?.total_wagered || 0).toLocaleString()} RWF`, icon: DollarSign, color: 'bg-indigo-500' },
            { label: 'Win Rate',      value: `${winRate}%`,                                              icon: TrendingUp,   color: 'bg-green-500' },
            { label: 'Losses',        value: stats?.losses || 0,                                        icon: TrendingDown, color: 'bg-red-400' },
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

        {/* Bets table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">Betting History</h3>
          </div>
          {!bets?.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">No betting activity recorded</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Game', 'Amount (RWF)', 'Outcome', 'Date'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bets.map(bet => (
                    <tr key={bet.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{bet.game}</td>
                      <td className="px-5 py-3 text-gray-700">{parseInt(bet.amount).toLocaleString()}</td>
                      <td className="px-5 py-3"><OutcomeBadge outcome={bet.outcome} /></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(bet.placed_at).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
