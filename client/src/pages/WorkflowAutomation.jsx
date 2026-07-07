import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { ArrowLeft, Loader, GripVertical, History, Workflow } from 'lucide-react';

const ACTION_LABELS = {
  flag_for_review: 'Flags for manual review',
  auto_verify: 'Auto-verifies',
  send_notification: 'Sends notification',
};

const STAGE_LABELS = {
  client_registered: 'On Registration',
  kyc_reviewed: 'On Admin Review',
};

export default function WorkflowAutomation() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const load = () => {
    setLoading(true);
    Promise.all([axios.get('/automation/rules'), axios.get('/automation/log')])
      .then(([r, l]) => { setRules(r.data.rules); setLog(l.data.log); })
      .catch(() => toast.error('Failed to load automation data'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleToggle = async (id) => {
    // Optimistic update
    setRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    try {
      await axios.patch(`/automation/rules/${id}/toggle`);
    } catch (err) {
      toast.error('Failed to toggle rule');
      load();
    }
  };

  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (index) => { dragOverItem.current = index; };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null; dragOverItem.current = null;
      return;
    }
    const reordered = [...rules];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, moved);
    setRules(reordered);
    dragItem.current = null; dragOverItem.current = null;

    try {
      const res = await axios.post('/automation/rules/reorder', { orderedIds: reordered.map(r => r.id) });
      setRules(res.data.rules);
    } catch (err) {
      toast.error('Failed to save new order');
      load();
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
    </div>
  );

  const registrationRules = rules.filter(r => r.trigger_event === 'client_registered');
  const reviewRules = rules.filter(r => r.trigger_event === 'kyc_reviewed');

  const RuleRow = ({ rule, index, globalIndex }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(globalIndex)}
      onDragEnter={() => handleDragEnter(globalIndex)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3.5 cursor-grab active:cursor-grabbing transition-opacity ${!rule.enabled ? 'opacity-60' : ''}`}
    >
      <GripVertical size={16} className="text-gray-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{rule.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
        <span className="inline-block mt-1.5 text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
          {ACTION_LABELS[rule.action] || rule.action}
        </span>
      </div>
      <button onClick={() => handleToggle(rule.id)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${rule.enabled ? 'bg-primary-600' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Workflow size={18} className="text-primary-600" /> Workflow Automation</h1>
          <p className="text-sm text-gray-500">Drag to reorder priority. Rules run top-to-bottom — the first matching rule decides the outcome.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{STAGE_LABELS.client_registered}</h3>
          <div className="space-y-2">
            {registrationRules.map((rule, i) => <RuleRow key={rule.id} rule={rule} index={i} globalIndex={rules.indexOf(rule)} />)}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{STAGE_LABELS.kyc_reviewed}</h3>
          <div className="space-y-2">
            {reviewRules.map((rule, i) => <RuleRow key={rule.id} rule={rule} index={i} globalIndex={rules.indexOf(rule)} />)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-medium text-gray-800 text-sm mb-4 flex items-center gap-2"><History size={15} /> Execution History</h3>
          {log.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No automation rules have fired yet.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {log.map(entry => (
                <div key={entry.id} className="border-b border-gray-50 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{entry.rule_name}</span>
                    <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{entry.result_summary}</p>
                  {entry.first_name && (
                    <p className="text-xs text-gray-400 mt-1">Client: {entry.first_name} {entry.last_name} ({entry.id_number})</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
