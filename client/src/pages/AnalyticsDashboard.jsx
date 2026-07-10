import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  ArrowLeft, Loader, TrendingUp, BadgeCheck, XCircle, Clock, MapPin, Trophy,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

const STATUS_COLORS = { verified: '#16a34a', pending: '#d97706', rejected: '#dc2626' };
const BAR_COLOR = '#4f46e5';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
    <div className={`rounded-lg p-2.5 ${color}`}><Icon size={18} className="text-white" /></div>
    <div>
      <p className="text-lg font-semibold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  </div>
);

const ChartCard = ({ title, children, action }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-medium text-gray-800 text-sm">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = (d = days) => {
    setLoading(true);
    axios.get(`/analytics/overview?days=${d}`)
      .then(r => setData(r.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(days); }, [days]);

  if (loading && !data) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading analytics...
      </div>
    </div>
  );

  const { registrationTrend, statusBreakdown, kyc, districtDistribution, agentLeaderboard, todayCount } = data || {};

  const trendData = (registrationTrend || []).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-RW', { day: '2-digit', month: 'short' }),
    count: d.count,
  }));

  const statusPieData = [
    { name: 'Verified', value: statusBreakdown?.verified || 0, key: 'verified' },
    { name: 'Pending', value: statusBreakdown?.pending || 0, key: 'pending' },
    { name: 'Rejected', value: statusBreakdown?.rejected || 0, key: 'rejected' },
  ].filter(d => d.value > 0);

  const totalClients = (statusBreakdown?.verified || 0) + (statusBreakdown?.pending || 0) + (statusBreakdown?.rejected || 0);

  const districtData = (districtDistribution || []).slice(0, 10);

  const topAgents = (agentLeaderboard || []).slice(0, 10);
  const maxAgentTotal = Math.max(1, ...topAgents.map(a => a.totalRegistered));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Reporting & Analytics</h1>
            <p className="text-sm text-gray-500">Registration performance and KYC outcomes</p>
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${days === d ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Registrations" value={todayCount ?? 0} icon={TrendingUp} color="bg-primary-600" />
          <StatCard label="Verified" value={statusBreakdown?.verified ?? 0} icon={BadgeCheck} color="bg-green-500" />
          <StatCard label="Rejected" value={statusBreakdown?.rejected ?? 0} icon={XCircle} color="bg-red-400" />
          <StatCard label="KYC Pass Rate" value={kyc?.passRate != null ? `${kyc.passRate}%` : 'N/A'} icon={Clock} color="bg-amber-500" />
        </div>

        {/* Registration trend */}
        <ChartCard title={`Registration Trend (last ${days} days)`}>
          {trendData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No registrations in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" name="Registrations" stroke={BAR_COLOR} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="grid md:grid-cols-2 gap-6">
          {/* KYC status breakdown */}
          <ChartCard title="KYC Status Breakdown">
            {totalClients === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No client data yet</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {statusPieData.map(entry => <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm">
                  {statusPieData.map(d => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[d.key] }} />
                      <span className="text-gray-600">{d.name}</span>
                      <span className="font-medium text-gray-800">{d.value}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 pt-1">{totalClients} total clients</p>
                </div>
              </div>
            )}
          </ChartCard>

          {/* Geographic distribution */}
          <ChartCard title="Registrations by District">
            {districtData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No district data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={districtData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="district" type="category" width={90} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Agent leaderboard */}
        <ChartCard title="Agent Performance Leaderboard" action={<Trophy size={16} className="text-amber-500" />}>
          {topAgents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No agents yet</p>
          ) : (
            <div className="space-y-3">
              {topAgents.map((agent, i) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <span className={`w-6 text-center text-xs font-semibold ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-300'}`}>
                    #{i + 1}
                  </span>
                  <div className="w-32 shrink-0 truncate text-sm text-gray-700 font-medium">{agent.name}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${(agent.totalRegistered / maxAgentTotal) * 100}%` }} />
                  </div>
                  <div className="w-14 text-right text-sm font-semibold text-gray-800">{agent.totalRegistered}</div>
                  <div className="w-24 text-right text-xs text-gray-400 hidden sm:block">
                    <span className="text-green-600">{agent.verified}✓</span>{' '}
                    <span className="text-red-500">{agent.rejected}✕</span>{' '}
                    <span className="text-amber-500">{agent.pending}⋯</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
