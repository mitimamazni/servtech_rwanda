import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send, Loader } from 'lucide-react';

const STATUS_COLORS = {
  open:        'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved:    'bg-green-50 text-green-700 border-green-200',
  closed:      'bg-gray-100 text-gray-600 border-gray-200',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

export default function TicketThread() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const isStaff = user?.role === 'admin' || user?.role === 'agent';
  const backPath = isStaff ? '/admin/tickets' : '/client/tickets';

  const load = () => {
    axios.get(`/tickets/${id}`)
      .then(res => { setTicket(res.data.ticket); setMessages(res.data.messages); })
      .catch(() => toast.error('Failed to load ticket'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await axios.post(`/tickets/${id}/messages`, { message: reply.trim() });
      setReply('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      await axios.patch(`/tickets/${id}/status`, { status });
      toast.success(`Marked as ${STATUS_LABEL[status]}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading ticket...
      </div>
    </div>
  );

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar>
        <button onClick={() => navigate(backPath)}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
      </Navbar>

      <div className="max-w-3xl mx-auto w-full px-6 py-6 flex-1 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">{ticket.subject}</h1>
              <p className="text-xs text-gray-400 capitalize mt-0.5">
                {ticket.category} · {ticket.priority} priority
                {isStaff && <> · {ticket.first_name} {ticket.last_name} ({ticket.id_number})</>}
                {ticket.assigned_to_name && <> · assigned to {ticket.assigned_to_name}</>}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </span>
          </div>

          {isStaff && ticket.status !== 'closed' && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
              <span className="text-xs text-gray-400">Mark as:</span>
              {['in_progress', 'resolved', 'closed'].filter(s => s !== ticket.status).map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
          {messages.map(m => {
            const mine = m.sender_role === (isStaff ? user.role : 'client') && m.sender_id === user.id;
            const staffMsg = m.sender_role === 'admin' || m.sender_role === 'agent';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? 'bg-primary-600 text-white' : staffMsg ? 'bg-primary-50 text-gray-800 border border-primary-100' : 'bg-white border border-gray-100 text-gray-800'
                }`}>
                  <p className={`text-[11px] mb-0.5 ${mine ? 'text-primary-100' : 'text-gray-400'}`}>
                    {m.sender_name || 'Client'} · {new Date(m.created_at).toLocaleString('en-RW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="whitespace-pre-wrap">{m.message}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {ticket.status !== 'closed' ? (
          <form onSubmit={sendReply} className="flex items-end gap-2 sticky bottom-4">
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2} placeholder="Type a reply..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-sm" />
            <button type="submit" disabled={sending || !reply.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors">
              <Send size={16} />
            </button>
          </form>
        ) : (
          <p className="text-center text-xs text-gray-400 py-2">This ticket is closed.</p>
        )}
      </div>
    </div>
  );
}
