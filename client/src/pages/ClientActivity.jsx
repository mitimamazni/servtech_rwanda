import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, BadgeCheck, Clock, XCircle, TrendingUp, TrendingDown, DollarSign, Target, Loader,
  Pencil, Ban, PlayCircle, Check, X, Image as ImageIcon, ShieldAlert,
} from 'lucide-react';

const REJECTION_REASONS = [
  'ID document unclear or unreadable',
  'Selfie does not match ID photo',
  'Selfie missing or invalid',
  'Details do not match national registry',
  'Suspected duplicate or fraudulent application',
  'Other (specify below)',
];

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

const StatusBadge = ({ status }) => {
  if (status === 'verified') return <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-medium"><BadgeCheck size={13} /> Verified</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-medium"><XCircle size={13} /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-medium"><Clock size={13} /> Pending</span>;
};

export default function ClientActivity() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonOther, setRejectReasonOther] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const backPath = user?.role === 'admin' ? '/admin/dashboard' : '/agent/dashboard';

  const load = () => {
    setLoading(true);
    axios.get(`/client/${clientId}/activity`)
      .then(r => {
        setData(r.data);
        setEditForm({
          first_name: r.data.client.first_name,
          last_name: r.data.client.last_name,
          phone: r.data.client.phone || '',
          district: r.data.client.district || '',
          gender: r.data.client.gender || '',
          date_of_birth: r.data.client.date_of_birth ? r.data.client.date_of_birth.slice(0, 10) : '',
        });
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load client activity'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [clientId]);

  const canManage = data?.client && (user?.role === 'admin' || (user?.role === 'agent' && data.client.agent_id === user.id));

  const handleSaveEdit = async () => {
    setBusy(true);
    try {
      await axios.put(`/clients/${clientId}`, editForm);
      toast.success('Client updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    setBusy(true);
    try {
      await axios.patch(`/clients/${clientId}/validate`);
      toast.success('Client verified');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const loadDocuments = () => {
    if (documents || documentsLoading) { setShowDocuments(s => !s); return; }
    setDocumentsLoading(true);
    setShowDocuments(true);
    axios.get(`/clients/${clientId}/documents`)
      .then(r => setDocuments(r.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load KYC documents'))
      .finally(() => setDocumentsLoading(false));
  };

  const handleToggleOptIn = async (field) => {
    const current = data?.client?.[field];
    try {
      const res = await axios.put(`/clients/${clientId}`, { [field]: !current });
      setData(d => ({ ...d, client: { ...d.client, [field]: res.data.client[field] } }));
      toast.success('Preference updated');
    } catch (err) {
      toast.error('Failed to update preference');
    }
  };

  const handleReject = async () => {
    const reason = rejectReason === 'Other (specify below)' ? rejectReasonOther : rejectReason;
    setBusy(true);
    try {
      await axios.patch(`/clients/${clientId}/reject`, { reason: reason || undefined });
      toast.success('Client rejected');
      setShowRejectBox(false);
      setRejectReason('');
      setRejectReasonOther('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (nextActive) => {
    setBusy(true);
    try {
      await axios.patch(`/clients/${clientId}/active`, { is_active: nextActive });
      toast.success(nextActive ? 'Client activated' : 'Client deactivated');
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
        <Loader size={20} className="animate-spin mr-2" /> Loading client data...
      </div>
    </div>
  );

  const { client, bets, stats } = data || {};
  const winRate = stats?.total_bets > 0 ? Math.round((stats.wins / stats.total_bets) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate(backPath)}
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
                {client?.email && <p className="text-xs text-gray-400">{client.email}</p>}
                {!client?.is_active && (
                  <span className="inline-block mt-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Deactivated</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={client?.status} />
              {client?.elderly_assisted && (
                <span className="text-xs text-gray-400">Elderly - agent identity confirmed</span>
              )}
            </div>
          </div>

          {client?.status === 'rejected' && client?.rejection_reason && (
            <div className="mt-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-2.5">
              <span className="font-medium">Rejection reason:</span> {client.rejection_reason}
            </div>
          )}

          {(client?.face_match_score != null || client?.document_authenticity_score != null || client?.sanctions_flag) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <ShieldAlert size={12} /> Automated KYC Screening <span className="text-gray-300">(simulated for demo)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {client?.face_match_score != null && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${client.face_match_score >= 60 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    Face match: {client.face_match_score}%
                  </span>
                )}
                {client?.document_authenticity_score != null && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${client.document_authenticity_score >= 50 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    Document authenticity: {client.document_authenticity_score}%
                  </span>
                )}
                {client?.sanctions_flag && (
                  <span className="text-xs px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
                    ⚠ Sanctions/PEP match: {client.sanctions_match_name}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!client?.email_opt_in} onChange={() => handleToggleOptIn('email_opt_in')} className="rounded border-gray-300" />
              Email opt-in
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!client?.sms_opt_in} onChange={() => handleToggleOptIn('sms_opt_in')} className="rounded border-gray-300" />
              SMS opt-in
            </label>
          </div>

          {(client?.has_selfie || client?.has_id_document) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={loadDocuments}
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <ImageIcon size={15} /> {showDocuments ? 'Hide' : 'View'} KYC documents
              </button>

              {showDocuments && (
                <div className="mt-3 grid grid-cols-2 gap-4 max-w-md">
                  {documentsLoading ? (
                    <div className="col-span-2 flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                      <Loader size={16} className="animate-spin" /> Loading documents...
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Selfie</p>
                        {documents?.selfie_data ? (
                          <img src={documents.selfie_data} alt="Client selfie" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                        ) : (
                          <div className="w-full aspect-square rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
                            Not provided
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">ID document</p>
                        {documents?.id_document_data ? (
                          <img src={documents.id_document_data} alt="ID document" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                        ) : (
                          <div className="w-full aspect-square rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
                            Not provided
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing ? (
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
              <div>
                <label className="block text-xs text-gray-400 mb-1">First name</label>
                <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Last name</label>
                <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">District</label>
                <input value={editForm.district} onChange={e => setEditForm({ ...editForm, district: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Igitsina</label>
                <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="Gabo">Gabo</option>
                  <option value="Gore">Gore</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date of birth</label>
                <input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {/* Action bar */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-gray-100">
              {editing ? (
                <>
                  <button onClick={handleSaveEdit} disabled={busy}
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

              {user?.role === 'admin' && client?.status === 'pending' && !editing && (
                <>
                  <button onClick={handleValidate} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                    <BadgeCheck size={14} /> Validate
                  </button>
                  {!showRejectBox ? (
                    <button onClick={() => setShowRejectBox(true)}
                      className="inline-flex items-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg">
                      <XCircle size={14} /> Reject
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="">Select a reason...</option>
                        {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {rejectReason === 'Other (specify below)' && (
                        <input value={rejectReasonOther} onChange={e => setRejectReasonOther(e.target.value)}
                          placeholder="Specify reason"
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48" />
                      )}
                      <button onClick={handleReject} disabled={busy}
                        className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">Confirm</button>
                      <button onClick={() => setShowRejectBox(false)} className="text-sm text-gray-500 px-2">Cancel</button>
                    </div>
                  )}
                </>
              )}

              {!editing && (
                client?.is_active ? (
                  <button onClick={() => handleToggleActive(false)} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto disabled:opacity-60">
                    <Ban size={14} /> Deactivate
                  </button>
                ) : (
                  <button onClick={() => handleToggleActive(true)} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto disabled:opacity-60">
                    <PlayCircle size={14} /> Reactivate
                  </button>
                )
              )}
            </div>
          )}
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
