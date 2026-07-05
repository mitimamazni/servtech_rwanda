import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import ClientDashboard from './pages/ClientDashboard';
import Register from './pages/Register';
import AgentRegister from './pages/AgentRegister';
import ClientSelfRegister from './pages/ClientSelfRegister';
import AgentSelfRegister from './pages/AgentSelfRegister';
import AuditLog from './pages/AuditLog';
import AgentsPage from './pages/AgentsPage';
import AgentDetail from './pages/AgentDetail';
import ClientActivity from './pages/ClientActivity';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading...
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();

  const dashboardRedirect = () => {
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'admin')  return <Navigate to="/admin/dashboard" />;
    if (user.role === 'agent')  return <Navigate to="/agent/dashboard" />;
    if (user.role === 'client') return <Navigate to="/client/dashboard" />;
    return <Navigate to="/login" />;
  };

  return (
    <Routes>
      <Route path="/login"        element={user ? dashboardRedirect() : <Login />} />
      <Route path="/register"     element={<ClientSelfRegister />} />
      <Route path="/agent-signup" element={<AgentSelfRegister />} />
      <Route path="/"             element={user ? dashboardRedirect() : <Landing />} />

      {/* Admin only routes */}
      <Route path="/admin/dashboard"              element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/agents"                 element={<PrivateRoute roles={['admin']}><AgentsPage /></PrivateRoute>} />
      <Route path="/admin/agent/:id"               element={<PrivateRoute roles={['admin']}><AgentDetail /></PrivateRoute>} />
      <Route path="/admin/audit"                  element={<PrivateRoute roles={['admin']}><AuditLog /></PrivateRoute>} />
      <Route path="/admin/client/:clientId/activity" element={<PrivateRoute roles={['admin']}><ClientActivity /></PrivateRoute>} />
      <Route path="/admin/register"               element={<PrivateRoute roles={['admin']}><Register /></PrivateRoute>} />
      <Route path="/admin/agent-register"         element={<PrivateRoute roles={['admin']}><AgentRegister /></PrivateRoute>} />

      {/* Agent only routes — no agent-register route for agents */}
      <Route path="/agent/dashboard" element={<PrivateRoute roles={['agent']}><AgentDashboard /></PrivateRoute>} />
      <Route path="/agent/register"  element={<PrivateRoute roles={['agent']}><Register /></PrivateRoute>} />
      <Route path="/agent/client/:clientId/activity" element={<PrivateRoute roles={['agent']}><ClientActivity /></PrivateRoute>} />

      {/* Client only routes */}
      <Route path="/client/dashboard" element={<PrivateRoute roles={['client']}><ClientDashboard /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}