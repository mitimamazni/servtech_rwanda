import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, AlertCircle, Loader, User } from 'lucide-react';

const DISTRICTS = [
  'Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara',
  'Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga',
  'Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamasheke',
  'Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo',
  'Rusizi','Rutsiro','Rwamagana'
];

const STEPS = ['ID Lookup', 'Personal Details', 'Contact Info', 'Confirm'];

export default function AgentRegister() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);

  const [form, setForm] = useState({
    id_number: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    district: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleVerify = async () => {
    if (!form.id_number) {
      toast.error('Please enter an ID number first');
      return;
    }
    setVerifying(true);
    setVerificationStatus(null);
    try {
      const res = await axios.post('/verify-id', { id_number: form.id_number });
      if (res.data.verified) {
        setVerificationStatus('verified');
        const d = res.data.data;
        setForm(prev => ({
          ...prev,
          first_name:    d.first_name    || prev.first_name,
          last_name:     d.last_name     || prev.last_name,
          date_of_birth: d.date_of_birth?.split('T')[0] || prev.date_of_birth,
          gender:        d.gender        || prev.gender,
          district:      d.district      || prev.district,
        }));
        toast.success('ID found in registry, details auto-filled');
        setStep(1);
      }
    } catch {
      setVerificationStatus('not_found');
      toast('ID not found in registry, please fill details manually', { icon: '⚠️' });
      setStep(1);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.id_number || !form.first_name || !form.last_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/register', form);
      toast.success('Client registered successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Agent Registration</h1>
            <p className="text-gray-500 text-sm">Step {step + 1} of {STEPS.length} - {STEPS[step]}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Client ID Lookup</h2>
              <p className="text-sm text-gray-500">
                Enter the client's national ID number. The system will check the registry and auto-fill their details if found.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  National ID Number <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.id_number}
                  onChange={e => update('id_number', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="16-digit ID number"
                  maxLength={16}
                />
              </div>

              {verificationStatus === 'verified' && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle size={16} /> ID verified against national registry
                </div>
              )}

              {verificationStatus === 'not_found' && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> ID not found, registration will be marked as pending
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying || !form.id_number}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
              >
                {verifying
                  ? <><Loader size={14} className="animate-spin" /> Checking registry...</>
                  : 'Look up ID'
                }
              </button>

              <button
                onClick={() => setStep(1)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
              >
                Skip lookup and enter manually
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-800">Personal Details</h2>
                {verificationStatus === 'verified' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Auto-filled from registry
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">Review the details below and correct anything if needed.</p>

              {[
                { label: 'First Name', field: 'first_name', type: 'text', required: true },
                { label: 'Last Name', field: 'last_name', type: 'text', required: true },
                { label: 'Date of Birth', field: 'date_of_birth', type: 'date', required: false },
              ].map(({ label, field, type, required }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} {required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={type}
                    value={form[field]}
                    onChange={e => update(field, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={form.gender}
                  onChange={e => update('gender', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Contact Information</h2>
              <p className="text-sm text-gray-500">Enter the client's phone number and district of residence.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="07X XXX XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select
                  value={form.district}
                  onChange={e => update('district', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Confirm Registration</h2>
              <p className="text-sm text-gray-500">Review all details with the client before submitting.</p>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  <div className="bg-primary-100 rounded-full p-2">
                    <User size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{form.first_name} {form.last_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{form.id_number}</p>
                  </div>
                  {verificationStatus === 'verified' && (
                    <CheckCircle size={18} className="text-green-500 ml-auto" />
                  )}
                  {verificationStatus === 'not_found' && (
                    <AlertCircle size={18} className="text-amber-500 ml-auto" />
                  )}
                </div>

                {[
                  ['Date of Birth', form.date_of_birth],
                  ['Gender', form.gender],
                  ['Phone', form.phone],
                  ['District', form.district],
                  ['Verification', verificationStatus === 'verified' ? 'Verified' : 'Pending review'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value || 'Not provided'}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                By submitting, you confirm that you have verified the client's identity in person and that the details above are accurate.
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button
              onClick={() => step === 0 ? navigate('/dashboard') : setStep(s => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60 transition-colors"
              >
                {submitting
                  ? <><Loader size={14} className="animate-spin" /> Saving...</>
                  : <><CheckCircle size={14} /> Register Client</>
                }
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
