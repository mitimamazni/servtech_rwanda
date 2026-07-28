import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { ArrowLeft, ShieldCheck, ShieldOff, Loader, Copy, Check } from 'lucide-react';

export default function SecuritySettings() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null); // { qrDataUrl, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disableInput, setDisableInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get('/auth/me')
      .then(r => setMe(r.data))
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to load security settings');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await axios.post('/auth/2fa/setup');
      setSetupData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start setup');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    try {
      await axios.post('/auth/2fa/confirm', { code });
      toast.success('Two-factor authentication enabled');
      setSetupData(null);
      setCode('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect code');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!window.confirm('Turn off two-factor authentication for your account?')) return;
    setBusy(true);
    try {
      await axios.post('/auth/2fa/disable', { code: disableInput });
      toast.success('Two-factor authentication disabled');
      setDisableInput('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill in all password fields'); return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters'); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match'); return;
    }
    setPwBusy(true);
    try {
      await axios.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-gray-800 mb-1">Security</h1>
        <p className="text-sm text-gray-500 mb-6">Manage your password and two-factor authentication.</p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="font-medium text-gray-800 mb-1">Change password</p>
          <p className="text-xs text-gray-500 mb-4">If you were given a temporary password, set a permanent one here.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Current password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <button onClick={changePassword} disabled={pwBusy}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-2.5 rounded-lg font-medium disabled:opacity-60">
              {pwBusy ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {me?.totp_enabled ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-50 rounded-full p-2.5"><ShieldCheck size={20} className="text-green-600" /></div>
                <div>
                  <p className="font-medium text-gray-800">Two-factor authentication is on</p>
                  <p className="text-xs text-gray-500">Your account requires an authenticator code at login.</p>
                </div>
              </div>
              <label className="block text-xs text-gray-400 mb-1.5">Enter a current code to disable</label>
              <input value={disableInput} onChange={e => setDisableInput(e.target.value)}
                placeholder="6-digit code"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3" />
              <button onClick={disable} disabled={busy}
                className="w-full bg-red-50 hover:bg-red-100 text-red-700 text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                <ShieldOff size={15} /> Disable two-factor authentication
              </button>
            </>
          ) : setupData ? (
            <>
              <p className="text-sm text-gray-600 mb-4">Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.</p>
              <div className="flex justify-center mb-4">
                <img src={setupData.qrDataUrl} alt="2FA QR code" className="w-44 h-44 border border-gray-200 rounded-lg" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 truncate">{setupData.secret}</code>
                <button onClick={copySecret} className="border border-gray-200 rounded-lg p-2 text-gray-500 hover:text-primary-600" title="Copy secret">
                  {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                </button>
              </div>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter 6-digit code"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 text-center tracking-widest font-mono" maxLength={6} />
              <div className="flex gap-2">
                <button onClick={() => setSetupData(null)} className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-lg py-2.5">Cancel</button>
                <button onClick={confirmSetup} disabled={busy || code.length !== 6}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm py-2.5 rounded-lg font-medium disabled:opacity-60">
                  {busy ? 'Verifying...' : 'Confirm & enable'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gray-100 rounded-full p-2.5"><ShieldOff size={20} className="text-gray-500" /></div>
                <div>
                  <p className="font-medium text-gray-800">Two-factor authentication is off</p>
                  <p className="text-xs text-gray-500">Add an extra layer of protection to your account.</p>
                </div>
              </div>
              <button onClick={startSetup} disabled={busy}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-2.5 rounded-lg font-medium disabled:opacity-60">
                {busy ? 'Starting...' : 'Enable two-factor authentication'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
