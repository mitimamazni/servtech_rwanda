import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { ArrowLeft, Plus, Trash2, Loader, Users, Mail, Phone, Calendar, Check, X, Ban, PlayCircle, Eye } from 'lucide-react';

const StatusPill = ({ status }) => {
  const map = {
    active:    'bg-green-50 text-green-700 border-green-200',
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    suspended: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] || map.suspended}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

export default function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fetchAgents = () => {
    setLoading(true);
    axios.get('/agents')
      .then(r => setAgents(r.data))
      .catch(() => toast.error('Failed to load agents'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post('/agents', form);
      toast.success(res.data.message);
      setForm({ name: '', email: '', phone: '' });
      setShowForm(false);
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove agent ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await axios.delete(`/agents/${id}`);
      toast.success('Agent removed');
      fetchAgents();
    } catch {
      toast.error('Failed to remove agent');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatus = async (id, status) => {
    setBusyId(id);
    try {
      await axios.patch(`/agents/${id}/status`, { status });
      toast.success(`Agent ${status === 'active' ? 'approved' : status === 'suspended' ? 'deactivated' : 'updated'}`);
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = agents.filter(a => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Dashboard
        </button>
        <button onClick={() => setShowForm(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <Plus size={15} /> Add Agent
        </button>
      </Navbar>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Agent Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage system agents. New agents receive login credentials by email.
            {pendingCount > 0 && <span className="text-amber-600 font-medium"> {pendingCount} application{pendingCount > 1 ? 's' : ''} awaiting review.</span>}
          </p>
        </div>

        {/* Create agent form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-medium text-gray-800 mb-4">New Agent</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-400">*</span></label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Agent full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-400">*</span></label>
                  <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="agent@servtech.rw" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="07X XXX XXXX" />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                A secure temporary password will be generated and sent to the agent's email automatically.
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60">
                  {submitting ? <><Loader size={14} className="animate-spin" /> Creating...</> : <><Plus size={14} /> Create Agent</>}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-5 py-2.5 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agents table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">All Agents <span className="text-sm text-gray-400 font-normal">{agents.length} total</span></h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader size={20} className="animate-spin mr-2" /> Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agents yet</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-primary-600 text-sm hover:underline">Add your first agent</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {agents.map(agent => (
                <div key={agent.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 font-semibold text-sm">{agent.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 text-sm">{agent.name}</p>
                        <StatusPill status={agent.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={11} /> {agent.email}</span>
                        {agent.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} /> {agent.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{agent.clients_registered}</p>
                      <p className="text-xs text-gray-400">clients registered</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(agent.created_at).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <Link to={`/admin/agent/${agent.id}`}
                      className="text-gray-400 hover:text-primary-600 transition-colors p-1" title="View">
                      <Eye size={16} />
                    </Link>

                    {agent.status === 'pending' ? (
                      <>
                        <button onClick={() => handleStatus(agent.id, 'active')} disabled={busyId === agent.id}
                          className="text-green-600 hover:text-green-700 transition-colors disabled:opacity-40 p-1" title="Approve">
                          {busyId === agent.id ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                        </button>
                        <button onClick={() => handleStatus(agent.id, 'suspended')} disabled={busyId === agent.id}
                          className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 p-1" title="Reject">
                          <X size={16} />
                        </button>
                      </>
                    ) : agent.status === 'active' ? (
                      <button onClick={() => handleStatus(agent.id, 'suspended')} disabled={busyId === agent.id}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 p-1" title="Deactivate">
                        {busyId === agent.id ? <Loader size={16} className="animate-spin" /> : <Ban size={16} />}
                      </button>
                    ) : (
                      <button onClick={() => handleStatus(agent.id, 'active')} disabled={busyId === agent.id}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 p-1" title="Reactivate">
                        {busyId === agent.id ? <Loader size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                      </button>
                    )}

                    <button onClick={() => handleDelete(agent.id, agent.name)}
                      disabled={deletingId === agent.id}
                      className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 p-1" title="Delete permanently">
                      {deletingId === agent.id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
