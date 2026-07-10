import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  ArrowLeft, Loader, Pencil, Check, X, Ban, PlayCircle, BadgeCheck, Clock, XCircle,
} from 'lucide-react';

const ClientStatusPill = ({ status }) => {
  if (status === 'verified') return <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-xs font-medium"><BadgeCheck size={11} /> Verified</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium"><XCircle size={11} /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-medium"><Clock size={11} /> Pending</span>;
};

export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`/agents/${id}`)
      .then(r => {
        setData(r.data);
        setEditForm({ name: r.data.agent.name, phone: r.data.agent.phone || '' });
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load agent'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await axios.put(`/agents/${id}`, editForm);
      toast.success('Agent updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (status) => {
    setBusy(true);
    try {
      await axios.patch(`/agents/${id}/status`, { status });
      toast.success(`Agent status set to ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading agent...
      </div>
    </div>
  );

  const { agent, clients } = data || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/agents')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-bold">{agent?.name?.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{agent?.name}</h2>
                <p className="text-xs text-gray-500">{agent?.email}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              agent?.status === 'active' ? 'bg-green-50 text-green-700 border-green-200'
              : agent?.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {agent?.status?.charAt(0).toUpperCase() + agent?.status?.slice(1)}
            </span>
          </div>

          {!editing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
              <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium text-gray-700">{agent?.phone || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-400">Clients registered</p><p className="font-medium text-gray-700">{clients?.length || 0}</p></div>
              <div><p className="text-xs text-gray-400">Joined</p><p className="font-medium text-gray-700">{agent?.created_at ? new Date(agent.created_at).toLocaleDateString() : 'N/A'}</p></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-gray-100">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                  <Check size={14} /> Save changes
                </button>
                <button onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg">
                  <X size={14} /> Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg">
                <Pencil size={14} /> Edit details
              </button>
            )}

            {!editing && agent?.status === 'pending' && (
              <>
                <button onClick={() => handleStatus('active')} disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                  <Check size={14} /> Approve
                </button>
                <button onClick={() => handleStatus('suspended')} disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg disabled:opacity-60">
                  <X size={14} /> Reject
                </button>
              </>
            )}

            {!editing && agent?.status === 'active' && (
              <button onClick={() => handleStatus('suspended')} disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto disabled:opacity-60">
                <Ban size={14} /> Deactivate
              </button>
            )}

            {!editing && agent?.status === 'suspended' && (
              <button onClick={() => handleStatus('active')} disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto disabled:opacity-60">
                <PlayCircle size={14} /> Reactivate
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">Clients registered by this agent</h3>
          </div>
          {!clients?.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">No clients registered yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Name', 'ID Number', 'Status', 'Registered', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{c.first_name} {c.last_name}</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.id_number}</td>
                      <td className="px-5 py-3"><ClientStatusPill status={c.status} /></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/admin/client/${c.id}/activity`} className="text-primary-600 hover:underline text-xs font-medium">View</Link>
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
