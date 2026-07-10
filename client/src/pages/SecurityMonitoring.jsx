import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  ArrowLeft, ShieldAlert, ShieldCheck, Ban, Loader, CheckCircle2, XCircle, Plus, Trash2,
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

export default function SecurityMonitoring() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/security/login-attempts'),
      axios.get('/security/alerts'),
      axios.get('/security/blocked-ips'),
    ]).then(([a, b, c]) => {
      setAttempts(a.data.attempts);
      setAlerts(b.data.alerts);
      setBlockedIps(c.data.blockedIps);
    }).catch(() => toast.error('Failed to load security data'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleBlock = async (ip, reason) => {
    if (!ip) return;
    setBlocking(true);
    try {
      await axios.post('/security/blocked-ips', { ip_address: ip, reason });
      toast.success(`Blocked ${ip}`);
      setNewIp(''); setNewReason('');
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
                    <button onClick={() => handleBlock(a.ip_address, `Auto-suggested: ${a.message}`)}
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
            <div className="flex gap-2 mb-4">
              <input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="IP address"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Reason (optional)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={() => handleBlock(newIp, newReason)} disabled={blocking || !newIp}
                className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg disabled:opacity-50">
                <Plus size={15} />
              </button>
            </div>
            {blockedIps.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No IPs currently blocked.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {blockedIps.map(b => (
                  <div key={b.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-mono text-gray-800">{b.ip_address}</p>
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
