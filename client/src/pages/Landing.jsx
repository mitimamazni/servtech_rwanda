import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  ShieldCheck, UserPlus, Users, Clock, ScanLine, Workflow, MessageSquare,
  Trophy, LifeBuoy, BarChart3, KeyRound, FileCheck2, ArrowRight, Wallet,
} from 'lucide-react';

const PIPELINE = [
  { label: 'Register', detail: 'Self, agent-assisted, or manual entry', stamp: 'RECEIVED' },
  { label: 'ID Verified', detail: 'OCR + national registry check, age compliance', stamp: 'VERIFIED' },
  { label: 'Wallet Funded', detail: 'Agent/admin top-up, simulated balance', stamp: 'FUNDED' },
  { label: 'Bet & Get Support', detail: 'Sportsbook access, ticket handling', stamp: 'ACTIVE' },
];

const MODULES = [
  { icon: ScanLine, title: 'Registration & KYC', desc: 'Self, agent, or manual registration with OCR scanning of Rwandan national IDs, live registry verification, age-compliance checks, and resubmission for rejected applicants.' },
  { icon: FileCheck2, title: 'Client Lifecycle', desc: 'Validate, reject, activate, or deactivate clients individually or in bulk, with a full document viewer and per-client activity timeline.' },
  { icon: Users, title: 'Agent Network', desc: 'Agents register clients in the field and manage their own portfolio; admins onboard, suspend, or remove agents and reset credentials.' },
  { icon: KeyRound, title: 'Security & Access', desc: 'JWT auth with two-factor authentication, role-based access control, blocked-IP management, and login attempt tracking.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'A visual rule builder for escalations, multi-step approval chains, and outbound webhooks — built and rearranged on a drag-and-drop canvas.' },
  { icon: MessageSquare, title: 'Communications', desc: 'Reusable message templates, bulk client messaging, and a full send log across SMS and email.' },
  { icon: Trophy, title: 'Sportsbook', desc: 'Verified clients browse live matches, place bets from their wallet, and see them settle automatically once an admin records a result.' },
  { icon: LifeBuoy, title: 'Support Tickets', desc: 'Clients raise tickets by category and priority; agents and admins reply in a threaded view, with email notifications at every step.' },
  { icon: BarChart3, title: 'Analytics & Compliance', desc: 'A live registration dashboard, a geographic heat map of Rwanda, a custom report builder, and QR-verified PDF regulatory reports.' },
  { icon: ShieldCheck, title: 'Full Audit Trail', desc: 'Every action in every module above — registrations, approvals, logins, bets, tickets — is logged and searchable in one place.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <nav className="border-b border-gray-100 bg-paper/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={36} showText={false} />
            <span className="text-lg font-display font-semibold"><span className="text-primary-600">Serv</span>Tech Rwanda</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-ink px-3 py-2">Sign in</Link>
            <Link to="/register" className="text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">Register as a client</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex items-center gap-2 mb-6">
          <span className="font-mono text-[11px] tracking-wide text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1">
            10 MODULES · ONE VERIFIED PIPELINE
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold max-w-3xl leading-[1.1] tracking-tight">
          One system, from a client's first form to their next bet.
        </h1>
        <p className="text-gray-500 mt-5 max-w-xl text-[15px] leading-relaxed">
          ServTech Rwanda verifies identity against the national registry, enforces age
          compliance, then carries that same client through wallet funding, live betting,
          and support — with every step logged for compliance.
        </p>
        <div className="flex items-center gap-3 mt-8 flex-wrap">
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-3 rounded-lg text-sm transition-colors">
            <UserPlus size={16} /> Register as a client
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-ink font-medium px-5 py-3 rounded-lg text-sm transition-colors">
            Agent / Admin sign in <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* Verification pipeline — signature element */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 sm:p-10">
          <p className="font-mono text-[11px] tracking-wide text-gray-400 mb-8">CLIENT JOURNEY</p>
          <div className="grid sm:grid-cols-4 gap-8 sm:gap-4 relative">
            <div className="hidden sm:block absolute top-6 left-[12.5%] right-[12.5%] border-t-2 border-dashed border-gray-200" />
            {PIPELINE.map((step, i) => (
              <div key={step.label} className="relative flex flex-col items-start sm:items-center sm:text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white border-2 border-primary-600 flex items-center justify-center font-display font-semibold text-primary-700 relative z-10">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-ink">{step.label}</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[160px] sm:mx-auto">{step.detail}</p>
                  <span className="inline-block mt-2 font-mono text-[10px] tracking-widest text-emerald-600 border border-emerald-200 rounded px-1.5 py-0.5 -rotate-3">
                    {step.stamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module overview grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-2">
          <h2 className="font-display text-2xl font-semibold">Everything in the system</h2>
          <p className="text-sm text-gray-400">A single back office for registration, compliance, betting, and support.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 hover:border-primary-200 transition-colors">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-primary-600" />
              </div>
              <h3 className="font-medium text-ink mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Secondary CTA strip */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="bg-ink rounded-2xl px-8 py-10 sm:px-12 flex items-center justify-between flex-wrap gap-6">
          <div>
            <h3 className="font-display text-white text-xl font-semibold mb-1">Already verified?</h3>
            <p className="text-gray-400 text-sm">Check your wallet, place a bet, or open a support ticket.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/login" className="inline-flex items-center gap-2 bg-white text-ink font-medium px-5 py-3 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              <Wallet size={16} /> Sign in to your account
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 pb-10">
        <span className="text-primary-600 font-medium">Serv</span>Tech Rwanda — Client Registration, Compliance & Sportsbook Platform
      </footer>
    </div>
  );
}
