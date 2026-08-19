import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { LifeBuoy, MessageCircle, LayoutDashboard } from 'lucide-react';

const STATUS_COLORS = {
  open:        'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved:    'bg-green-50 text-green-700 border-green-200',
  closed:      'bg-gray-100 text-gray-600 border-gray-200',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const PRIORITY_COLORS = { low: 'text-gray-400', normal: 'text-gray-500', high: 'text-amber-600', urgent: 'text-red-600' };

export default function AdminTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    axios.get('/admin/tickets')
      .then(res => setTickets(res.data))
      .catch(() => toast.error('Failed to load tickets'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
  const counts = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
  tickets.forEach(t => counts[t.status]++);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate(user?.role === 'agent' ? '/agent/dashboard' : '/admin/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <LayoutDashboard size={14} /> Dashboard
        </button>
      </Navbar>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <LifeBuoy size={20} className="text-primary-600" />
          <h1 className="text-xl font-semibold text-gray-800">Support Tickets</h1>
        </div>

        <div className="flex gap-2 border-b border-gray-200 flex-wrap">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                filter === f ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {f === 'all' ? 'All' : STATUS_LABEL[f]} ({counts[f]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">No tickets here.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {filtered.map(t => (
              <button key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.first_name} {t.last_name} · <span className="capitalize">{t.category}</span> ·{' '}
                    <span className={`capitalize font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span> ·{' '}
                    <MessageCircle size={11} className="inline -mt-0.5" /> {t.message_count}
                    {t.assigned_to_name && <> · assigned to {t.assigned_to_name}</>}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
