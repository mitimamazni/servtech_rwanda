import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';
import Captcha from '../components/Captcha';
import { CheckCircle2 } from 'lucide-react';

export default function AgentSelfRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [captcha, setCaptcha] = useState({ captcha_token: null, captcha_answer: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!captcha.captcha_answer) {
      toast.error('Please answer the CAPTCHA');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/agents/self-register', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        ...captcha,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Application failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
          <CheckCircle2 size={44} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Application submitted</h2>
          <p className="text-sm text-gray-500 mb-6">
            An administrator will review your application. You'll be able to log in with the
            email and password you set once your account is approved.
          </p>
          <button onClick={() => navigate('/login')}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} showText={false} />
          <h1 className="text-2xl font-semibold text-gray-800 mt-4">Become a ServTech Agent</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">Apply for an agent account. An admin will review it before you can log in.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input name="name" required value={form.name} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" name="email" required value={form.email} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
            <input name="phone" value={form.phone} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="07XXXXXXXX" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" required value={form.password} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input type="password" name="confirmPassword" required value={form.confirmPassword} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Re-enter your password" />
          </div>
          <Captcha onChange={setCaptcha} />
          <button type="submit" disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            {loading ? 'Submitting...' : 'Submit application'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
