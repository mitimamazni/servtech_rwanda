import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { LifeBuoy, Plus, X, LayoutDashboard, MessageCircle } from 'lucide-react';

const STATUS_COLORS = {
  open:        'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved:    'bg-green-50 text-green-700 border-green-200',
  closed:      'bg-gray-100 text-gray-600 border-gray-200',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

export default function Tickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'general', priority: 'normal', message: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get('/tickets')
      .then(res => setTickets(res.data))
      .catch(() => toast.error('Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createTicket = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return toast.error('Subject and message are required');
    setSaving(true);
    try {
      const res = await axios.post('/tickets', form);
      toast.success('Ticket submitted');
      setShowForm(false);
      setForm({ subject: '', category: 'general', priority: 'normal', message: '' });
      navigate(`/client/tickets/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/client/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <LayoutDashboard size={14} /> Dashboard
        </button>
        <button onClick={() => setShowForm(true)}
          className="text-sm text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={14} /> New Ticket
        </button>
      </Navbar>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <LifeBuoy size={20} className="text-primary-600" />
          <h1 className="text-xl font-semibold text-gray-800">Support Tickets</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">
            No tickets yet. Raised an issue with registration, betting, or your wallet? Open a ticket above.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {tickets.map(t => (
              <button key={t.id} onClick={() => navigate(`/client/tickets/${t.id}`)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.subject}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {t.category} · <MessageCircle size={11} className="inline -mt-0.5" /> {t.message_count} · {new Date(t.updated_at).toLocaleDateString('en-RW', { day: '2-digit', month: 'short' })}
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

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">New Support Ticket</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={createTicket} className="space-y-3">
              <input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="registration">Registration</option>
                  <option value="betting">Betting</option>
                  <option value="wallet">Wallet</option>
                  <option value="account">Account</option>
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <textarea placeholder="Describe the issue..." rows={4} value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" required />
              <button type="submit" disabled={saving}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                {saving ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
