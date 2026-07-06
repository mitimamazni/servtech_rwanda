import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SelfieCapture from '../components/SelfieCapture';
import { ArrowLeft, CheckCircle, AlertCircle, Loader, User, ClipboardList } from 'lucide-react';

const STEPS = ['ID Lookup', 'Personal Details', 'Contact Info', 'Selfie (optional)', 'Confirm'];
const DISTRICTS = ['Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara','Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga','Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo','Rusizi','Rutsiro','Rwamagana'];

export default function ManualClientRegister() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const backPath = user?.role === 'admin' ? '/admin/dashboard' : '/agent/dashboard';

  const [step, setStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [elderly, setElderly] = useState(false);
  const [elderlyConfirmed, setElderlyConfirmed] = useState(false);
  const [form, setForm] = useState({ id_number:'', first_name:'', last_name:'', date_of_birth:'', gender:'', phone:'', district:'', selfie_data: null });
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleVerify = async () => {
    if (!form.id_number) { toast.error('Enter an ID number first'); return; }
    setVerifying(true); setVerificationStatus(null);
    try {
      const res = await axios.post('/verify-id', { id_number: form.id_number });
      if (res.data.verified) {
        setVerificationStatus('verified');
        setElderly(!!res.data.elderly);
        const d = res.data.data;
        setForm(prev => ({
          ...prev,
          first_name:    d.first_name    || prev.first_name,
          last_name:     d.last_name     || prev.last_name,
          date_of_birth: d.date_of_birth?.split('T')[0] || prev.date_of_birth,
          gender:        d.gender        || prev.gender,
          district:      d.district      || prev.district,
        }));
        toast.success('ID found - details auto-filled');
        if (res.data.elderly) toast('Client is over 80 - identity confirmation will be required before submitting', { icon: '⚠️' });
        setStep(1);
      }
    } catch (err) {
      if (err.response?.data?.underAge) {
        setVerificationStatus('underage');
        toast.error(err.response.data.message);
      } else {
        setVerificationStatus('not_found');
        setElderly(!!err.response?.data?.elderly);
        toast('ID not found - fill in details manually', { icon: '⚠️' });
        setStep(1);
      }
    } finally { setVerifying(false); }
  };

  const handleSubmit = async () => {
    if (!form.id_number || !form.first_name || !form.last_name) {
      toast.error('ID number, first name and last name are required'); return;
    }
    setSubmitting(true);
    try {
      await axios.post('/register', { ...form, elderly_confirmed: elderlyConfirmed });
      toast.success('Client registered successfully');
      navigate(backPath);
    } catch (err) {
      if (err.response?.data?.elderlyConfirmRequired) {
        setElderly(true);
        toast.error(err.response.data.message);
      } else {
        toast.error(err.response?.data?.message || 'Registration failed');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar>
        <button onClick={() => navigate(backPath)} className="text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ArrowLeft size={15} /> Back
        </button>
      </Navbar>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Manual registration header - distinct green banner */}
        <div className="bg-gray-800 rounded-2xl p-5 mb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-10 rounded-xl p-2.5">
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Manual Client Registration</h1>
              <p className="text-gray-400 text-sm">Register a client by entering their ID number directly</p>
            </div>
          </div>
          <div className="flex gap-1 mt-4">
            {STEPS.map((s,i) => (
              <div key={i} className="flex-1">
                <div className={`h-1 rounded-full mb-1.5 ${i <= step ? 'bg-white' : 'bg-white bg-opacity-20'}`} />
                <p className={`text-xs ${i <= step ? 'text-white' : 'text-gray-500'}`}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Client ID Lookup</h2>
              <p className="text-sm text-gray-500">Enter the client's 16-digit national ID number. The system will check the registry and auto-fill their details if found.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National ID Number <span className="text-red-400">*</span></label>
                <input value={form.id_number} onChange={e => update('id_number', e.target.value)} maxLength={16}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="1 9 9 X X X X X X X X X X X X X" />
              </div>

              {verificationStatus === 'verified' && (
                <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle size={16} /> ID verified - details have been auto-filled
                </div>
              )}
              {verificationStatus === 'not_found' && (
                <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> ID not found in registry - registration will be marked pending
                </div>
              )}
              {verificationStatus === 'underage' && (
                <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> Registration denied - client must be 18 or older
                </div>
              )}

              <button onClick={handleVerify} disabled={verifying || !form.id_number || verificationStatus === 'underage'}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                {verifying ? <><Loader size={14} className="animate-spin" /> Checking registry...</> : 'Look up ID in Registry'}
              </button>
              <button onClick={() => setStep(1)} disabled={verificationStatus === 'underage'}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-lg disabled:opacity-40">
                Skip lookup and fill manually
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-800">Personal Details</h2>
                {verificationStatus === 'verified' && (
                  <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={11} /> Auto-filled from registry
                  </span>
                )}
              </div>
              {[{l:'First Name',f:'first_name',t:'text',r:true},{l:'Last Name',f:'last_name',t:'text',r:true},{l:'Date of Birth',f:'date_of_birth',t:'date',r:false}].map(({l,f,t,r}) => (
                <div key={f}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{l} {r && <span className="text-red-400">*</span>}</label>
                  <input type={t} value={form[f]} onChange={e => update(f, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Igitsina</label>
                <select value={form.gender} onChange={e => update('gender', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500">
                  <option value="">Hitamo igitsina</option>
                  <option value="Gabo">Gabo</option>
                  <option value="Gore">Gore</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Contact Information</h2>
              <p className="text-sm text-gray-500">Enter the client's contact details.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="07X XXX XXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select value={form.district} onChange={e => update('district', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500">
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Identity Photo <span className="text-xs font-normal text-gray-400">(optional)</span></h2>
              <p className="text-sm text-gray-500">Since you're registering this client in person, a selfie is optional — but adding one strengthens the KYC record.</p>
              <SelfieCapture value={form.selfie_data} onChange={v => update('selfie_data', v)} label="Client photo" required={false} />
              {!form.selfie_data && (
                <button onClick={() => setStep(4)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-lg">
                  Skip this step
                </button>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Confirm Registration</h2>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  {form.selfie_data ? (
                    <img src={form.selfie_data} alt="Client selfie" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="bg-gray-200 rounded-full p-2.5"><User size={18} className="text-gray-700" /></div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{form.first_name} {form.last_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{form.id_number}</p>
                  </div>
                  {verificationStatus === 'verified' && <CheckCircle size={18} className="text-green-500 ml-auto" />}
                  {verificationStatus === 'not_found' && <AlertCircle size={18} className="text-amber-500 ml-auto" />}
                </div>
                {[['Date of Birth',form.date_of_birth],['Igitsina',form.gender],['Phone',form.phone],['District',form.district],['Status',verificationStatus==='verified'?'Verified':'Pending review']].map(([label,value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value||'Not provided'}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
                By submitting you confirm you have verified the client's identity in person. This registration will be logged under your account.
              </div>
              {elderly && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={elderlyConfirmed} onChange={e => setElderlyConfirmed(e.target.checked)} className="mt-0.5" />
                    <span>This client is over 80 years old. I confirm I have verified their identity in person before registering them.</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <button onClick={() => step===0 ? navigate(backPath) : setStep(s=>s-1)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
            {step < STEPS.length-1 ? (
              <button onClick={() => setStep(s=>s+1)} disabled={verificationStatus==='underage'}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-5 py-2.5 rounded-lg disabled:opacity-60 transition-colors">
                Continue
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || (elderly && !elderlyConfirmed)}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60">
                {submitting ? <><Loader size={14} className="animate-spin" /> Saving...</> : <><CheckCircle size={14} /> Register Client</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
