import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';
import Captcha from '../components/Captcha';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState({ captcha_token: null, captcha_answer: '' });
  // Bumping this remounts <Captcha>, which fetches a fresh challenge — used
  // after a failed attempt since a captcha token is single-use/short-lived.
  const [captchaKey, setCaptchaKey] = useState(0);

  const goToDashboard = (user) => {
    toast.success(`Welcome back, ${user.name}`);
    if (user.role === 'admin')  navigate('/admin/dashboard');
    else if (user.role === 'agent')  navigate('/agent/dashboard');
    else if (user.role === 'client') navigate('/client/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password, captcha);
      if (result.requires2FA) {
        setPendingToken(result.pendingToken);
      } else {
        goToDashboard(result);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
      // A used/expired/wrong captcha token can't be resubmitted — force a fresh challenge.
      setCaptcha({ captcha_token: null, captcha_answer: '' });
      setCaptchaKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await verify2FA(pendingToken, code);
      goToDashboard(user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (pendingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-50 rounded-full p-3 mb-3">
              <ShieldCheck size={28} className="text-primary-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Two-factor verification</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">Enter the 6-digit code from your authenticator app</p>
          </div>
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <input type="text" inputMode="numeric" autoFocus required value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="000000" maxLength={6} />
            <button type="submit" disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setPendingToken(null); setCode(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1.5">
              <ArrowLeft size={13} /> Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} showText={false} />
          <h1 className="text-2xl font-semibold text-gray-800 mt-4">
            <span className="text-primary-600">Serv</span>Tech Rwanda
          </h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="you@servtech.rw" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••" />
          </div>
          <Captcha key={captchaKey} onChange={setCaptcha} />
          <button type="submit" disabled={loading || !captcha.captcha_answer}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-1.5">
          <p className="text-sm text-gray-500">New client?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">Register here</Link>
          </p>
          <p className="text-sm text-gray-500">Want to become an agent?{' '}
            <Link to="/agent-signup" className="text-primary-600 hover:underline font-medium">Apply here</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <span className="text-primary-600 font-medium">Serv</span>Tech Rwanda - Client Registration System
        </p>
      </div>
    </div>
  );
}

