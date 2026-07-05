import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { SkeletonCard } from '../components/Skeleton';
import Logo from '../components/Logo';
import {
  Users, UserCheck, UserX, CalendarDays,
  Plus, Search, ChevronLeft, ChevronRight,
  LogOut, Loader, BadgeCheck, Clock, XCircle, ShieldCheck, User
} from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    verified: 'bg-green-50 text-green-700 border-green-200',
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };
  const icons = {
    verified: <BadgeCheck size={12} />,
    pending:  <Clock size={12} />,
    rejected: <XCircle size={12} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`rounded-xl p-3 ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-semibold text-gray-800">{value ?? '—'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  const fetchStats = async () => {
    try {
      const res = await axios.get('/stats');
      setStats(res.data);
    } catch {
      toast.error('Failed to load stats');
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/clients', {
        params: { search, status: statusFilter, page },
      });
      setClients(res.data.clients);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchClients(); }, [search, statusFilter, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} showText={true} textClass="text-lg" />
            <span className="text-gray-300 hidden sm:block">|</span>
            <p className="text-xs text-gray-400 hidden sm:block">Client Registration System</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {user?.name} - <span className="capitalize">{user?.role}</span>
            </span>
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/audit')}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <ShieldCheck size={16} /> Audit Log
              </button>
            )}
            <button
              onClick={() => navigate('/agent-register')}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <User size={16} /> Agent Register
            </button>
            <button
              onClick={() => navigate('/register')}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> New Client
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats ? (
            <>
              <StatCard label="Total Clients"    value={stats.total}    icon={Users}        color="bg-primary-600" />
              <StatCard label="Verified"         value={stats.verified} icon={UserCheck}    color="bg-green-500" />
              <StatCard label="Pending Review"   value={stats.pending}  icon={UserX}        color="bg-amber-500" />
              <StatCard label="Registered Today" value={stats.today}    icon={CalendarDays} color="bg-indigo-500" />
            </>
          ) : (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-medium text-gray-800">
              All Clients
              <span className="ml-2 text-sm text-gray-400 font-normal">{total} total</span>
            </h2>

            <div className="flex gap-2 w-full sm:w-auto">
              <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-none">
                <div className="relative flex-1 sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Search name or ID..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                >
                  Go
                </button>
              </form>

              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader size={20} className="animate-spin mr-2" /> Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No clients found</p>
              <button
                onClick={() => navigate('/register')}
                className="mt-3 text-primary-600 text-sm hover:underline"
              >
                Register your first client
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Client', 'ID Number', 'Gender', 'District', 'Registered By', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-800">
                          {client.first_name} {client.last_name}
                        </div>
                        <div className="text-xs text-gray-400">{client.phone || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 font-mono text-xs">{client.id_number}</td>
                      <td className="px-5 py-4 text-gray-600">{client.gender || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{client.district || '—'}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs">{client.agent_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs">
                        {new Date(client.created_at).toLocaleDateString('en-RW', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={client.status} />
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
