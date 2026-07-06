import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import SelfieCapture from '../components/SelfieCapture';
import { ArrowLeft, Loader, AlertCircle, Send } from 'lucide-react';

const DISTRICTS = [
  'Nyarugenge', 'Gasabo', 'Kicukiro', 'Nyanza', 'Gisagara', 'Nyaruguru', 'Huye',
  'Nyamagabe', 'Ruhango', 'Muhanga', 'Kamonyi', 'Karongi', 'Rutsiro', 'Rubavu',
  'Nyabihu', 'Ngororero', 'Rusizi', 'Nyamasheke', 'Rulindo', 'Gakenke', 'Musanze',
  'Burera', 'Gicumbi', 'Rwamagana', 'Nyagatare', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Bugesera',
];

export default function ClientResubmit() {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', gender: '', phone: '', district: '',
    selfie_data: null, id_document_data: null,
  });

  useEffect(() => {
    axios.get('/client/dashboard')
      .then(r => {
        const c = r.data.client;
        setClient(c);
        if (c.status !== 'rejected') {
          toast.error('Resubmission is only available for rejected applications.');
          navigate('/client/dashboard');
          return;
        }
        setForm(f => ({
          ...f,
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          date_of_birth: c.date_of_birth ? c.date_of_birth.slice(0, 10) : '',
          gender: c.gender || '',
          phone: c.phone || '',
          district: c.district || '',
        }));
      })
      .catch(() => toast.error('Failed to load your profile'))
      .finally(() => setLoading(false));
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleIdFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update('id_document_data', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.selfie_data) { setError('A selfie photo is required.'); return; }
    setSubmitting(true);
    try {
      await axios.post('/client/resubmit', form);
      toast.success('Resubmitted for review');
      navigate('/client/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Resubmission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate('/client/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-gray-800 mb-1">Resubmit for Verification</h1>
        <p className="text-sm text-gray-500 mb-6">
          {client?.rejection_reason
            ? <>Your previous submission was rejected: <span className="font-medium text-gray-700">{client.rejection_reason}</span>. Please review and correct the details below.</>
            : 'Please review your details below and resubmit for verification.'}
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">First name</label>
              <input value={form.first_name} onChange={e => update('first_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Last name</label>
              <input value={form.last_name} onChange={e => update('last_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date of birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Igitsina</label>
              <select value={form.gender} onChange={e => update('gender', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select...</option>
                <option value="Gabo">Gabo</option>
                <option value="Gore">Gore</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">District</label>
              <select value={form.district} onChange={e => update('district', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select...</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">ID document photo <span className="text-gray-300">(optional update)</span></label>
            <label className="border border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-50">
              {form.id_document_data ? 'Photo selected — click to replace' : 'Upload a new ID photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleIdFile} />
            </label>
          </div>

          <SelfieCapture value={form.selfie_data} onChange={v => update('selfie_data', v)} label="New selfie photo" />

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-2.5 flex items-start gap-2">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? 'Submitting...' : 'Resubmit for review'}
          </button>
        </div>
      </div>
    </div>
  );
}
