import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  ArrowLeft, Loader, Mail, MessageSquare, Plus, Trash2, Send, History, X,
} from 'lucide-react';

const TABS = ['Send Message', 'Templates', 'History'];

export default function Communications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Send Message');
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [messageLog, setMessageLog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Send form state
  const [channel, setChannel] = useState('email');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [sending, setSending] = useState(false);

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', channel: 'email', subject: '', body: '' });

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      axios.get('/communications/templates'),
      axios.get('/clients?limit=200'),
      axios.get('/communications/log'),
    ]).then(([t, c, m]) => {
      if (t.status === 'fulfilled') setTemplates(t.value.data.templates);
      if (c.status === 'fulfilled') setClients(c.value.data.clients || []);
      if (m.status === 'fulfilled') setMessageLog(m.value.data.messages);

      const failed = [t, c, m].filter(r => r.status === 'rejected').length;
      if (failed === 3) toast.error('Failed to load communications data');
      else if (failed > 0) toast.error('Some communications data failed to load — showing what loaded successfully');
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const channelTemplates = templates.filter(t => t.channel === channel);

  const toggleClient = (id) => {
    setSelectedClients(sel => sel.includes(id) ? sel.filter(c => c !== id) : [...sel, id]);
  };

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.id_number}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSend = async () => {
    if (selectedClients.length === 0) return toast.error('Select at least one client');
    const usingTemplate = !!selectedTemplate;
    if (!usingTemplate && !customBody.trim()) return toast.error('Write a message or select a template');

    setSending(true);
    try {
      const res = await axios.post('/communications/send', {
        clientIds: selectedClients,
        channel,
        templateId: usingTemplate ? selectedTemplate : null,
        subject: usingTemplate ? undefined : customSubject,
        body: usingTemplate ? undefined : customBody,
      });
      const s = res.data.summary;
      toast.success(`Sent: ${s.sent || 0} · Failed: ${s.failed || 0} · Skipped (opted out): ${s.skipped_opt_out || 0}`);
      setSelectedClients([]); setCustomBody(''); setCustomSubject(''); setSelectedTemplate('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.name || !templateForm.body) return toast.error('Name and body are required');
    try {
      await axios.post('/communications/templates', templateForm);
      toast.success('Template created');
      setShowTemplateForm(false);
      setTemplateForm({ name: '', channel: 'email', subject: '', body: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`/communications/templates/${id}`);
      toast.success('Template deleted');
      load();
    } catch {
      toast.error('Failed to delete template');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/admin/dashboard')} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Client Communication</h1>
          <p className="text-sm text-gray-500">Templates, bulk messaging, and communication history</p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-2 inline-block">
            SMS delivery is simulated for this demo. Messages are logged as sent but not delivered to a real network.
          </p>
        </div>

        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-4 py-1.5 rounded-md font-medium transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Send Message' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex gap-2">
                {['email', 'sms'].map(c => (
                  <button key={c} onClick={() => { setChannel(c); setSelectedTemplate(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border ${channel === c ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                    {c === 'email' ? <Mail size={14} /> : <MessageSquare size={14} />} {c === 'email' ? 'Email' : 'SMS'}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Use a template (optional)</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Write custom message...</option>
                  {channelTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {!selectedTemplate && (
                <>
                  {channel === 'email' && (
                    <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Subject"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  )}
                  <textarea value={customBody} onChange={e => setCustomBody(e.target.value)} rows={4}
                    placeholder="Message body. Use {first_name}, {last_name}, {id_number} as placeholders."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </>
              )}

              <button onClick={handleSend} disabled={sending}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                Send to {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-xs text-gray-400 mb-2">Recipients</label>
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search clients..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filteredClients.map(c => (
                  <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedClients.includes(c.id)} onChange={() => toggleClient(c.id)}
                      className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700 flex-1">{c.first_name} {c.last_name}</span>
                    <span className="text-xs text-gray-400 font-mono">{c.id_number}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Templates' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-800 text-sm">Message Templates</h3>
              <button onClick={() => setShowTemplateForm(true)} className="text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Plus size={14} /> New
              </button>
            </div>

            {showTemplateForm && (
              <div className="border border-gray-200 rounded-xl p-4 mb-4 space-y-3 bg-gray-50">
                <div className="flex gap-3">
                  <input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <select value={templateForm.channel} onChange={e => setTemplateForm(f => ({ ...f, channel: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                {templateForm.channel === 'email' && (
                  <input value={templateForm.subject} onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                )}
                <textarea value={templateForm.body} onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))} rows={3}
                  placeholder="Body (use {first_name}, {last_name}, {id_number}, {rejection_reason})"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                <div className="flex gap-2">
                  <button onClick={handleCreateTemplate} className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-2 rounded-lg">Save</button>
                  <button onClick={() => setShowTemplateForm(false)} className="text-sm text-gray-500 px-3">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-start justify-between border border-gray-100 rounded-lg px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {t.channel === 'email' ? <Mail size={13} className="text-gray-400" /> : <MessageSquare size={13} className="text-gray-400" />}
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    </div>
                    {t.subject && <p className="text-xs text-gray-500 mt-1">{t.subject}</p>}
                    <p className="text-xs text-gray-400 mt-1">{t.body}</p>
                  </div>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'History' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-medium text-gray-800 text-sm mb-4 flex items-center gap-2"><History size={15} /> Communication History</h3>
            {messageLog.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No messages sent yet.</p>
            ) : (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto">
                {messageLog.map(m => (
                  <div key={m.id} className="border-b border-gray-50 pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.channel === 'email' ? <Mail size={13} className="text-gray-400" /> : <MessageSquare size={13} className="text-gray-400" />}
                        <span className="text-sm text-gray-700">{m.first_name ? `${m.first_name} ${m.last_name}` : m.recipient}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          m.status === 'sent' ? 'bg-green-50 text-green-700 border-green-200' :
                          m.status === 'skipped_opt_out' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                          'bg-red-50 text-red-700 border-red-200'}`}>
                          {m.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    {m.subject && <p className="text-xs text-gray-600 mt-1 font-medium">{m.subject}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{m.body}</p>
                    {m.status === 'failed' && m.error_detail && (
                      <p className="text-xs text-red-500 mt-1">⚠ {m.error_detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
