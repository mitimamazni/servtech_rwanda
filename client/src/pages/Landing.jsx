import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { ShieldCheck, UserPlus, Users, Clock } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={36} showText={false} />
            <span className="text-lg font-semibold text-gray-800"><span className="text-primary-600">Serv</span>Tech Rwanda</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">Sign in</Link>
            <Link to="/register" className="text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">Register as a client</Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl mx-auto leading-tight">
          Fast, secure client registration for Rwanda's service industry
        </h1>
        <p className="text-gray-500 mt-4 max-w-xl mx-auto">
          ServTech Rwanda verifies identity against the national registry, enforces age
          compliance, and gives agents and administrators a clear view of every registration.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-3 rounded-lg text-sm">
            <UserPlus size={16} /> Register as a client
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid sm:grid-cols-3 gap-6">
        {[
          { icon: ShieldCheck, title: 'ID Verification', desc: 'Every registration is checked against the national identity registry before it is approved.' },
          { icon: Clock, title: 'Age Compliance', desc: 'Minors are automatically blocked, and elderly clients get an agent-assisted, in-person confirmation step.' },
          { icon: Users, title: 'Agent Network', desc: 'Agents register clients in the field and manage their own portfolio once onboarded by an administrator.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
              <Icon size={20} className="text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1.5">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="text-center text-xs text-gray-400 pb-10">
        <span className="text-primary-600 font-medium">Serv</span>Tech Rwanda: Client Registration System
      </footer>
    </div>
  );
}
