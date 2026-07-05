import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}`);
      if (user.role === 'admin')  navigate('/admin/dashboard');
      else if (user.role === 'agent')  navigate('/agent/dashboard');
      else if (user.role === 'client') navigate('/client/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
          <button type="submit" disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

<<<<<<< HEAD
        <div className="mt-6 text-center space-y-1.5">
          <p className="text-sm text-gray-500">New client?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">Register here</Link>
          </p>
          <p className="text-sm text-gray-500">Want to become an agent?{' '}
            <Link to="/agent-signup" className="text-primary-600 hover:underline font-medium">Apply here</Link>
          </p>
=======
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">New client?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">Register here</Link>
          </p>
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <span className="text-primary-600 font-medium">Serv</span>Tech Rwanda - Client Registration System
        </p>
      </div>
    </div>
  );
}
