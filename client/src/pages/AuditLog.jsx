import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader, ShieldCheck, LogIn, UserPlus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Logo from '../components/Logo';

const ACTION_STYLES = {
  LOGIN:           { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: <LogIn size={12} /> },
  REGISTER_CLIENT: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  icon: <UserPlus size={12} /> },
  VERIFY_CLIENT:   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <ShieldCheck size={12} /> },
};

const ActionBadge = ({ action }) => {
  const style = ACTION_STYLES[action] || {
    bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: null
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
      {style.icon}
      {action.replace('_', ' ')}
    </span>
  );
};

export default function AuditLog() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/audit-logs', {
        params: {
          page,
          action: actionFilter || undefined,
          user_id: userFilter || undefined,
        },
      });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { fetchLogs(); }, [page, actionFilter, userFilter]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-RW', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">

      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </button>
            <Logo size={32} showText={true} textClass="text-base" />
            <span className="text-gray-300">|</span>
            <div>
              <h1 className="text-base font-semibold text-gray-800">Audit Log</h1>
              <p className="text-xs text-gray-400">Full system activity record</p>
            </div>
          </div>
          <span className="text-sm text-gray-400">{total} total entries</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter size={14} />
              <span>Filter by</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={actionFilter}
                onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All actions</option>
                <option value="LOGIN">Login</option>
                <option value="REGISTER_CLIENT">Register Client</option>
                <option value="VERIFY_CLIENT">Verify Client</option>
              </select>

              <select
                value={userFilter}
                onChange={e => { setUserFilter(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>

              {(actionFilter || userFilter) && (
                <button
                  onClick={() => { setActionFilter(''); setUserFilter(''); setPage(1); }}
                  className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 border border-gray-200 rounded-lg"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader size={20} className="animate-spin mr-2" /> Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No audit log entries found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map(log => (
                <div key={log.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className="mt-1 w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionBadge action={log.action} />
                      <span className="text-sm font-medium text-gray-800">{log.user_name || 'Unknown user'}</span>
                      <span className="text-xs text-gray-400 capitalize">{log.user_role}</span>
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-500 mt-1 truncate">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
