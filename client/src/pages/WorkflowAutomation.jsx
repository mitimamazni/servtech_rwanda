import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import ReactFlow, { Background, Controls, Handle, Position, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, Loader, History, Workflow, X, Plus, Trash2, AlarmClock,
  ShieldCheck, Webhook as WebhookIcon, Play, GripVertical, ChevronRight,
} from 'lucide-react';

const ACTION_LABELS = {
  flag_for_review: 'Flags for manual review',
  auto_verify: 'Auto-verifies',
  send_notification: 'Sends notification',
};
const ACTION_COLORS = {
  flag_for_review: 'border-amber-300 bg-amber-50',
  auto_verify: 'border-green-300 bg-green-50',
  send_notification: 'border-blue-300 bg-blue-50',
};
const STAGE_LABELS = {
  client_registered: 'Client Registered',
  kyc_reviewed: 'KYC Reviewed',
};
const TABS = [
  { id: 'designer', label: 'Flow Designer', icon: Workflow },
  { id: 'escalations', label: 'Escalation Rules', icon: AlarmClock },
  { id: 'chains', label: 'Approval Chains', icon: ShieldCheck },
  { id: 'integrations', label: 'Integrations', icon: WebhookIcon },
  { id: 'log', label: 'Execution Log', icon: History },
];

// ── Custom canvas nodes ──────────────────────────────────────────────────

function TriggerNodeView({ data }) {
  return (
    <div className="rounded-xl border-2 border-gray-700 bg-gray-800 text-white px-4 py-3 w-48 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">Trigger</p>
      <p className="text-sm font-medium">{data.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}

function RuleNodeView({ data }) {
  return (
    <div
      onClick={data.onClick}
      className={`rounded-xl border-2 px-4 py-3 w-56 shadow-sm cursor-pointer transition-opacity ${ACTION_COLORS[data.action] || 'border-gray-200 bg-white'} ${data.enabled ? '' : 'opacity-40'}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-400">Priority {data.sortOrder}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${data.enabled ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
          {data.enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-800 leading-snug">{data.name}</p>
      <p className="text-xs text-gray-500 mt-1">{ACTION_LABELS[data.action] || data.action}</p>
      {data.threshold != null && <p className="text-xs text-gray-400 mt-1">Threshold: {data.threshold}%</p>}
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes = { trigger: TriggerNodeView, rule: RuleNodeView };

// ── Flow Designer tab ────────────────────────────────────────────────────

function FlowDesigner({ rules, reload }) {
  const [selectedRule, setSelectedRule] = useState(null);
  const [panelThreshold, setPanelThreshold] = useState('');
  const [panelDescription, setPanelDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openPanel = (rule) => {
    setSelectedRule(rule);
    setPanelThreshold(rule.config?.threshold != null ? String(rule.config.threshold) : '');
    setPanelDescription(rule.description || '');
  };

  const buildGraph = useCallback(() => {
    const triggerEvents = [...new Set(rules.map(r => r.trigger_event))];
    const nodes = [];
    const edges = [];

    triggerEvents.forEach((event, rowIndex) => {
      const triggerId = `trigger-${event}`;
      nodes.push({
        id: triggerId, type: 'trigger', position: { x: 20, y: rowIndex * 220 + 20 },
        data: { label: STAGE_LABELS[event] || event }, draggable: false,
      });

      const rulesForEvent = rules.filter(r => r.trigger_event === event).sort((a, b) => a.sort_order - b.sort_order);
      let prevId = triggerId;
      rulesForEvent.forEach((rule, i) => {
        const nodeId = `rule-${rule.id}`;
        nodes.push({
          id: nodeId, type: 'rule',
          position: rule.position_x != null ? { x: rule.position_x, y: rule.position_y } : { x: 300 + i * 280, y: rowIndex * 220 + 10 },
          data: {
            name: rule.name, action: rule.action, enabled: rule.enabled, sortOrder: rule.sort_order,
            threshold: rule.config?.threshold, ruleId: rule.id,
            onClick: () => openPanel(rule),
          },
        });
        edges.push({ id: `${prevId}-${nodeId}`, source: prevId, target: nodeId, animated: rule.enabled, style: { stroke: rule.enabled ? '#4f46e5' : '#d1d5db' } });
        prevId = nodeId;
      });
    });

    return { nodes, edges };
  }, [rules]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph();
    setNodes(n);
    setEdges(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const onNodeDragStop = async (_evt, node) => {
    if (node.type !== 'rule') return;
    try {
      await axios.post('/automation/rules/positions', {
        positions: [{ id: node.data.ruleId, position_x: Math.round(node.position.x), position_y: Math.round(node.position.y) }],
      });
    } catch {
      toast.error('Failed to save node position');
    }
  };

  const handleToggle = async (rule) => {
    try {
      await axios.patch(`/automation/rules/${rule.id}/toggle`);
      toast.success(`Rule ${rule.enabled ? 'disabled' : 'enabled'}`);
      reload();
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const config = panelThreshold !== '' ? { threshold: Number(panelThreshold) } : selectedRule.config;
      await axios.patch(`/automation/rules/${selectedRule.id}/config`, { config, description: panelDescription });
      toast.success('Rule updated');
      setSelectedRule(null);
      reload();
    } catch {
      toast.error('Failed to save rule configuration');
    } finally {
      setSaving(false);
    }
  };

  const showsThreshold = selectedRule && (selectedRule.config?.threshold != null || ['face_match_flag', 'doc_authenticity_flag'].includes(selectedRule.code));

  return (
    <div className="relative">
      <div style={{ height: '60vh' }} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={onNodeDragStop}
          fitView proOptions={{ hideAttribution: true }} nodesConnectable={false}
        >
          <Background gap={20} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-xs text-gray-400 mt-2">Drag nodes to rearrange the canvas. Click a rule to configure it. Rules run in priority order — the first whose condition matches decides the outcome.</p>

      {selectedRule && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelectedRule(null)}>
          <div className="bg-white w-full max-w-sm h-full shadow-xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Configure Rule</h3>
              <button onClick={() => setSelectedRule(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <p className="text-sm font-medium text-gray-800">{selectedRule.name}</p>
            <p className="text-xs text-gray-400 mb-4">{STAGE_LABELS[selectedRule.trigger_event]} &rarr; {ACTION_LABELS[selectedRule.action]}</p>

            <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-lg px-3 py-2.5">
              <span className="text-sm text-gray-600">Enabled</span>
              <button onClick={() => { handleToggle(selectedRule); setSelectedRule(r => ({ ...r, enabled: !r.enabled })); }}
                className={`w-10 h-5.5 rounded-full transition-colors relative ${selectedRule.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${selectedRule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <textarea value={panelDescription} onChange={e => setPanelDescription(e.target.value)} rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />

            {showsThreshold && (
              <>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Threshold (%)</label>
                <input type="number" min="0" max="100" value={panelThreshold} onChange={e => setPanelThreshold(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
                <p className="text-xs text-gray-400 -mt-3 mb-4">Applications scoring below this are flagged for manual review instead of proceeding automatically.</p>
              </>
            )}

            <button onClick={handleSaveConfig} disabled={saving}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-60">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Escalation Rules tab ─────────────────────────────────────────────────

function EscalationRules() {
  const [rules, setRules] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', condition_status: 'pending', threshold_hours: 48, notify_role: 'admin' });
  const [checking, setChecking] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get('/automation/escalations')
      .then(r => { setRules(r.data.rules); setRecent(r.data.recent); })
      .catch(() => toast.error('Failed to load escalation rules'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name || !form.threshold_hours) return toast.error('Name and threshold hours are required');
    try {
      await axios.post('/automation/escalations', form);
      toast.success('Escalation rule created');
      setShowForm(false);
      setForm({ name: '', condition_status: 'pending', threshold_hours: 48, notify_role: 'admin' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create rule');
    }
  };

  const handleToggle = async (id) => {
    try { await axios.patch(`/automation/escalations/${id}/toggle`); load(); }
    catch { toast.error('Failed to toggle rule'); }
  };

  const handleDelete = async (id) => {
    try { await axios.delete(`/automation/escalations/${id}`); toast.success('Rule deleted'); load(); }
    catch { toast.error('Failed to delete rule'); }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await axios.post('/automation/escalations/check');
      toast.success(res.data.message);
      load();
    } catch {
      toast.error('Escalation check failed');
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader className="animate-spin text-primary-600" size={24} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Flags clients that have been sitting in a given status too long, and emails the configured role.</p>
        <div className="flex gap-2">
          <button onClick={handleCheckNow} disabled={checking}
            className="inline-flex items-center gap-1.5 text-xs border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg disabled:opacity-60">
            <Play size={13} /> {checking ? 'Checking...' : 'Check now'}
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg">
            <Plus size={13} /> New rule
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
          <input placeholder="Rule name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
          <select value={form.condition_status} onChange={e => setForm({ ...form, condition_status: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="pending">Pending</option>
          </select>
          <input type="number" placeholder="Hours threshold" value={form.threshold_hours}
            onChange={e => setForm({ ...form, threshold_hours: Number(e.target.value) })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <select value={form.notify_role} onChange={e => setForm({ ...form, notify_role: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="admin">Notify: Admins</option>
            <option value="agent">Notify: Agents</option>
          </select>
          <button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg py-2">Create</button>
        </div>
      )}

      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{r.name}</p>
              <p className="text-xs text-gray-400">If {r.condition_status} &gt; {r.threshold_hours}h &rarr; notify {r.notify_role}s</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => handleToggle(r.id)}
                className={`w-9 h-5 rounded-full relative transition-colors ${r.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No escalation rules configured</p>}
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recently escalated</h4>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing escalated yet</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map(e => (
              <div key={e.id} className="text-sm text-gray-600 flex justify-between border-b border-gray-50 py-1.5">
                <span>{e.first_name} {e.last_name} ({e.id_number}) &mdash; {Math.round(e.hours_pending)}h via "{e.rule_name}"</span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approval Chains tab ──────────────────────────────────────────────────

function ApprovalChains() {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSteps, setEditingSteps] = useState({});
  const [saving, setSaving] = useState(null);

  const load = () => {
    setLoading(true);
    axios.get('/automation/approval-chains')
      .then(r => setChains(r.data.chains))
      .catch(() => toast.error('Failed to load approval chains'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startEdit = (chain) => setEditingSteps(prev => ({ ...prev, [chain.id]: chain.steps.map(s => ({ ...s })) }));

  const updateStep = (chainId, idx, field, value) => {
    setEditingSteps(prev => ({
      ...prev,
      [chainId]: prev[chainId].map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const addStep = (chainId) => {
    setEditingSteps(prev => ({
      ...prev,
      [chainId]: [...prev[chainId], { required_role: 'admin', label: `Step ${prev[chainId].length + 1}` }],
    }));
  };

  const removeStep = (chainId, idx) => {
    setEditingSteps(prev => ({ ...prev, [chainId]: prev[chainId].filter((_, i) => i !== idx) }));
  };

  const saveSteps = async (chainId) => {
    setSaving(chainId);
    try {
      await axios.put(`/automation/approval-chains/${chainId}/steps`, { steps: editingSteps[chainId] });
      toast.success('Approval chain updated');
      setEditingSteps(prev => { const next = { ...prev }; delete next[chainId]; return next; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save steps');
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (id) => {
    try { await axios.patch(`/automation/approval-chains/${id}/toggle`); load(); }
    catch { toast.error('Failed to toggle chain'); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader className="animate-spin text-primary-600" size={24} /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Clients matching a chain's trigger condition (sanctions match or elderly-assisted) require sign-off at every step below before they're verified — a single "Validate" click only advances one step.</p>

      {chains.map(chain => {
        const editing = editingSteps[chain.id];
        const steps = editing || chain.steps;
        return (
          <div key={chain.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{chain.name}</p>
                <p className="text-xs text-gray-400">Trigger: {chain.trigger_condition.replace(/_/g, ' ')}</p>
              </div>
              <button onClick={() => handleToggle(chain.id)}
                className={`w-9 h-5 rounded-full relative transition-colors ${chain.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${chain.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={s.id || i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Step {i + 1}</span>
                  {editing ? (
                    <>
                      <input value={s.label} onChange={e => updateStep(chain.id, i, 'label', e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                      <select value={s.required_role} onChange={e => updateStep(chain.id, i, 'required_role', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                      </select>
                      <button onClick={() => removeStep(chain.id, i)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      {s.label} <ChevronRight size={11} className="text-gray-300" /> <span className="text-xs text-gray-400">{s.required_role}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              {editing ? (
                <>
                  <button onClick={() => addStep(chain.id)} className="text-xs text-primary-600 flex items-center gap-1"><Plus size={12} /> Add step</button>
                  <button onClick={() => saveSteps(chain.id)} disabled={saving === chain.id}
                    className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg ml-auto disabled:opacity-60">
                    {saving === chain.id ? 'Saving...' : 'Save steps'}
                  </button>
                  <button onClick={() => setEditingSteps(prev => { const n = { ...prev }; delete n[chain.id]; return n; })}
                    className="text-xs text-gray-400">Cancel</button>
                </>
              ) : (
                <button onClick={() => startEdit(chain)} className="text-xs text-primary-600">Edit steps</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Integrations (Webhooks) tab ──────────────────────────────────────────

function Integrations() {
  const [webhooks, setWebhooks] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', trigger_event: 'client_registered' });

  const load = () => {
    setLoading(true);
    axios.get('/automation/webhooks')
      .then(r => { setWebhooks(r.data.webhooks); setLog(r.data.log); })
      .catch(() => toast.error('Failed to load integrations'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name || !form.url) return toast.error('Name and URL are required');
    try {
      await axios.post('/automation/webhooks', form);
      toast.success('Webhook added');
      setShowForm(false);
      setForm({ name: '', url: '', trigger_event: 'client_registered' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add webhook');
    }
  };

  const handleToggle = async (id) => {
    try { await axios.patch(`/automation/webhooks/${id}/toggle`); load(); }
    catch { toast.error('Failed to toggle webhook'); }
  };

  const handleDelete = async (id) => {
    try { await axios.delete(`/automation/webhooks/${id}`); toast.success('Webhook deleted'); load(); }
    catch { toast.error('Failed to delete webhook'); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader className="animate-spin text-primary-600" size={24} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Fires an HTTP POST to an external URL whenever the selected event happens — point this at a compliance system, chat webhook, or a tool like webhook.site to see it live.</p>
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg shrink-0">
          <Plus size={13} /> New webhook
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
          <input placeholder="Name (e.g. Compliance Slack channel)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
          <input placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
          <select value={form.trigger_event} onChange={e => setForm({ ...form, trigger_event: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2">
            <option value="client_registered">On client registered</option>
            <option value="kyc_reviewed">On KYC reviewed</option>
            <option value="escalation">On escalation</option>
          </select>
          <button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg py-2 col-span-2">Add webhook</button>
        </div>
      )}

      <div className="space-y-2">
        {webhooks.map(w => (
          <div key={w.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{w.name}</p>
              <p className="text-xs text-gray-400 truncate">{w.url} &middot; {w.trigger_event}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <button onClick={() => handleToggle(w.id)}
                className={`w-9 h-5 rounded-full relative transition-colors ${w.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${w.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <button onClick={() => handleDelete(w.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No webhooks configured</p>}
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recent deliveries</h4>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400">No delivery attempts yet</p>
        ) : (
          <div className="space-y-1.5">
            {log.map(l => (
              <div key={l.id} className="text-sm flex justify-between border-b border-gray-50 py-1.5">
                <span className={l.status === 'sent' ? 'text-gray-600' : 'text-red-500'}>
                  {l.webhook_name} {l.status === 'sent' ? `→ ${l.status_code}` : `failed (${l.error_detail || l.status_code})`}
                  {l.id_number ? ` · ${l.id_number}` : ''}
                </span>
                <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Execution Log tab ─────────────────────────────────────────────────────

function ExecutionLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/automation/log')
      .then(r => setLog(r.data.log))
      .catch(() => toast.error('Failed to load execution log'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader className="animate-spin text-primary-600" size={24} /></div>;
  if (log.length === 0) return <p className="text-sm text-gray-400 text-center py-10">No automation activity yet</p>;

  return (
    <div className="space-y-1.5">
      {log.map(entry => (
        <div key={entry.id} className="flex items-start justify-between border-b border-gray-50 py-2.5 text-sm">
          <div>
            <span className="font-medium text-gray-800">{entry.rule_name}</span>
            {entry.first_name && <span className="text-gray-400"> &middot; {entry.first_name} {entry.last_name} ({entry.id_number})</span>}
            <p className="text-gray-500 text-xs mt-0.5">{entry.result_summary}</p>
          </div>
          <span className="text-xs text-gray-400 shrink-0 ml-3">{new Date(entry.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function WorkflowAutomation() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('designer');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRules = () => {
    axios.get('/automation/rules')
      .then(r => setRules(r.data.rules))
      .catch(() => toast.error('Failed to load automation rules'))
      .finally(() => setLoading(false));
  };
  useEffect(loadRules, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Workflow className="text-primary-600" size={20} />
          <h1 className="text-xl font-semibold text-gray-800">Workflow Automation</h1>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {tab === 'designer' && (
            loading
              ? <div className="flex justify-center py-16"><Loader className="animate-spin text-primary-600" size={24} /></div>
              : <FlowDesigner rules={rules} reload={loadRules} />
          )}
          {tab === 'escalations' && <EscalationRules />}
          {tab === 'chains' && <ApprovalChains />}
          {tab === 'integrations' && <Integrations />}
          {tab === 'log' && <ExecutionLog />}
        </div>
      </div>
    </div>
  );
}
