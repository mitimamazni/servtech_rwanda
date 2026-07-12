import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  ArrowLeft, ShieldAlert, ShieldCheck, Ban, Loader, CheckCircle2, XCircle, Plus, Trash2, AlertTriangle, Clock,
} from 'lucide-react';

const ReasonBadge = ({ reason, success }) => {
  const labels = {
    invalid_credentials: 'Invalid credentials',
    account_pending: 'Account pending',
    account_suspended: 'Account suspended',
    password_ok_awaiting_2fa: 'Password OK, awaiting 2FA',
    login_success: 'Login success',
    invalid_2fa_code: 'Invalid 2FA code',
    '2fa_verified': '2FA verified',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      {success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {labels[reason] || reason}
    </span>
  );
};

// Minutes-based durations, defaulting to 1 minute — short expiries make the
// feature demo-able without leaving a real block lying around afterward.
const DURATION_OPTIONS = [
  { label: '1 minute (demo)', value: '1' },
  { label: '5 minutes', value: '5' },
  { label: '1 hour', value: '60' },
  { label: '24 hours', value: '1440' },
  { label: '7 days', value: '10080' },
  { label: 'Permanent', value: '' },
];
const durationLabel = (minutes) => DURATION_OPTIONS.find(d => d.value === minutes)?.label || (minutes ? `${minutes} minute(s)` : 'Permanent');

const ExpiryBadge = ({ b }) => {
  if (!b.expires_at) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Permanent</span>;
  if (b.is_expired) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Expired</span>;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
      <Clock size={9} /> Until {new Date(b.expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </span>
  );
};

export default function SecurityMonitoring() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newDuration, setNewDuration] = useState('1');
  const [blocking, setBlocking] = useState(false);

  // Stage 1: always shown before anything is sent to the server at all.
  // Nothing happens until this is confirmed — Cancel just closes it.
  const [confirmDraft, setConfirmDraft] = useState(null); // { ip, reason, duration_minutes }
  // Stage 2: only appears if the server reports the IP is shared with other
  // accounts — a second, more specific confirmation before actually blocking.
  const [pendingBlock, setPendingBlock] = useState(null); // { ip, reason, duration_minutes, message, accounts }

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      axios.get('/security/login-attempts'),
      axios.get('/security/alerts'),
      axios.get('/security/blocked-ips'),
    ]).then(([a, b, c]) => {
      if (a.status === 'fulfilled') setAttempts(a.value.data.attempts);
      if (b.status === 'fulfilled') setAlerts(b.value.data.alerts);
      if (c.status === 'fulfilled') setBlockedIps(c.value.data.blockedIps);

      const failed = [a, b, c].filter(r => r.status === 'rejected').length;
      if (failed === 3) toast.error('Failed to load security data');
      else if (failed > 0) toast.error('Some security data failed to load — showing what loaded successfully');
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Opens the stage-1 "are you sure" modal — no request is made yet.
  const requestBlock = (ip, reason, duration_minutes = '') => {
    if (!ip) return;
    setConfirmDraft({ ip, reason, duration_minutes });
  };

  // Actually calls the API. `confirm` skips the shared-account re-check
  // (used when the person has already confirmed the stage-2 warning).
  const executeBlock = async ({ ip, reason, duration_minutes }, confirm = false) => {
    setBlocking(true);
    try {
      const res = await axios.post('/security/blocked-ips', {
        ip_address: ip, reason, duration_minutes: duration_minutes || undefined, confirm,
      });
      if (res.data.warning) {
        setPendingBlock({ ip, reason, duration_minutes, message: res.data.message, accounts: res.data.accounts });
        return;
      }
      toast.success(`Blocked ${ip}`);
      setNewIp(''); setNewReason(''); setPendingBlock(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block IP');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (id, ip) => {
    try {
      await axios.delete(`/security/blocked-ips/${id}`);
      toast.success(`Unblocked ${ip}`);
      load();
    } catch (err) {
      toast.error('Failed to unblock IP');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Security & Access Control</h1>
          <p className="text-sm text-gray-500">Login monitoring, threat alerts, and network access control</p>
        </div>

        {/* Stage 1: generic confirm-before-anything-happens modal */}
        {confirmDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setConfirmDraft(null)}>
            <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3 text-gray-800">
                <Ban size={18} className="text-red-500" />
                <h3 className="font-semibold">Block this IP?</h3>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
                <p><span className="text-gray-400">IP:</span> <span className="font-mono">{confirmDraft.ip}</span></p>
                <p><span className="text-gray-400">Reason:</span> {confirmDraft.reason || '—'}</p>
                <p><span className="text-gray-400">Duration:</span> {durationLabel(confirmDraft.duration_minutes)}</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">Nothing happens until you confirm. This will block every request from this IP, for every account, until it expires or you unblock it.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDraft(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm rounded-lg py-2 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => { executeBlock(confirmDraft, false); setConfirmDraft(null); }}
                  disabled={blocking}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg py-2 disabled:opacity-60">
                  Confirm block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: shared-account warning, only if the server finds other successful logins from this IP */}
        {pendingBlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setPendingBlock(null)}>
            <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3 text-amber-600">
                <AlertTriangle size={18} />
                <h3 className="font-semibold text-gray-800">This IP looks shared</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">{pendingBlock.message}</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 mb-4 bg-gray-50 rounded-lg p-3">
                {pendingBlock.accounts.map((a, i) => (
                  <p key={i} className="text-xs text-gray-600">{a.name || a.email} <span className="text-gray-400">({a.role || 'unknown role'})</span></p>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-4">If these accounts are on the same network as whoever you're trying to block, they'll be locked out too.</p>
              <div className="flex gap-2">
                <button onClick={() => setPendingBlock(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm rounded-lg py-2 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => executeBlock(pendingBlock, true)}
                  disabled={blocking}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg py-2 disabled:opacity-60">
                  Block anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-medium text-gray-800 text-sm mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className={alerts.length ? 'text-red-500' : 'text-green-500'} /> Security Alerts
          </h3>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <ShieldCheck size={16} className="text-green-500" /> No active alerts. No suspicious login patterns detected in the last 15 minutes.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm text-red-800 font-medium">{a.message}</p>
                    <p className="text-xs text-red-500 mt-0.5">Last attempt: {new Date(a.last_attempt).toLocaleString()}</p>
                  </div>
                  {a.ip_address && (
                    <button onClick={() => requestBlock(a.ip_address, `Auto-suggested: ${a.message}`, '1')}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0">
                      <Ban size={12} /> Block IP
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* IP Blocklist */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-medium text-gray-800 text-sm mb-4">IP Blocklist</h3>
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="IP address"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={newDuration} onChange={e => setNewDuration(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm">
                  {DURATION_OPTIONS.map(d => <option key={d.label} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Reason (optional)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button onClick={() => requestBlock(newIp, newReason, newDuration)} disabled={blocking || !newIp}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg disabled:opacity-50">
                  <Plus size={15} />
                </button>
              </div>
            </div>
            {blockedIps.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No IPs currently blocked.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {blockedIps.map(b => (
                  <div key={b.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${b.is_expired ? 'border-gray-100 opacity-50' : 'border-gray-100'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-gray-800">{b.ip_address}</p>
                        <ExpiryBadge b={b} />
                      </div>
                      {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
                    </div>
                    <button onClick={() => handleUnblock(b.id, b.ip_address)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Login attempts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-medium text-gray-800 text-sm mb-4">Recent Login Attempts</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {attempts.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">No login attempts recorded yet.</p>
              ) : attempts.map(a => (
                <div key={a.id} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                  <div>
                    <p className="text-sm text-gray-700">{a.email}</p>
                    <p className="text-xs text-gray-400 font-mono">{a.ip_address} · {new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <ReasonBadge reason={a.reason} success={a.success} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
