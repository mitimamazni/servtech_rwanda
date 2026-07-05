import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { SkeletonCard } from '../components/Skeleton';
import {
  Users, UserCheck, UserX, CalendarDays, Plus, Search,
  ChevronLeft, ChevronRight, BadgeCheck, Clock, XCircle,
  ShieldCheck, UserCog, BarChart2, Loader
} from 'lucide-react';

const StatusBadge = ({ status }) => {
  const map = {
    verified: 'bg-green-50 text-green-700 border-green-200',
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };
  const icons = { verified: <BadgeCheck size={12} />, pending: <Clock size={12} />, rejected: <XCircle size={12} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`rounded-xl p-3 ${color}`}><Icon size={22} className="text-white" /></div>
    <div>
      <p className="text-2xl font-semibold text-gray-800">{value ?? '—'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/stats').then(r => setStats(r.data)).catch(() => toast.error('Failed to load stats'));
  }, []);

  useEffect(() => {
    setLoading(true);
    axios.get('/clients', { params: { search, status: statusFilter, page } })
      .then(r => { setClients(r.data.clients); setTotal(r.data.total); setTotalPages(r.data.totalPages); })
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/agents')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <UserCog size={15} /> Agents
        </button>
        <button onClick={() => navigate('/admin/audit')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <ShieldCheck size={15} /> Audit Log
        </button>
        <button onClick={() => navigate('/admin/agent-register')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <Users size={15} /> Agent Register
        </button>
        <button onClick={() => navigate('/admin/register')} className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={15} /> New Client
        </button>
      </Navbar>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Admin Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Full system overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {stats ? (
            <>
              <StatCard label="Total Clients"    value={stats.total}    icon={Users}        color="bg-primary-600" />
              <StatCard label="Verified"         value={stats.verified} icon={UserCheck}    color="bg-green-500" />
              <StatCard label="Pending Review"   value={stats.pending}  icon={UserX}        color="bg-amber-500" />
              <StatCard label="Rejected"         value={stats.rejected} icon={XCircle}      color="bg-red-400" />
              <StatCard label="Registered Today" value={stats.today}    icon={CalendarDays} color="bg-indigo-500" />
            </>
          ) : [1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h3 className="font-medium text-gray-800">All Clients <span className="text-sm text-gray-400 font-normal">{total} total</span></h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 flex-1 sm:flex-none">
                <div className="relative flex-1 sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder="Search name or ID..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <button type="submit" className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700">Go</button>
              </form>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">All status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No clients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Client', 'ID Number', 'Igitsina', 'District', 'Registered By', 'Date', 'Status', 'Activity'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-gray-400">{c.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.id_number}</td>
                      <td className="px-4 py-3 text-gray-600">{c.gender || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.district || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 text-xs font-medium">{c.agent_name || '—'}</div>
                        <div className="text-gray-400 text-xs">{c.agent_phone || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/admin/client/${c.id}/activity`)}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
                          <BarChart2 size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
