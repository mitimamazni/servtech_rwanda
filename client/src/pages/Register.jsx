import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { extractIdData } from '../utils/ocr';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { Upload, CheckCircle, AlertCircle, Loader, ArrowLeft, ArrowRight, User } from 'lucide-react';

const STEPS = ['Scan ID', 'Verify Details', 'Contact Info', 'Confirm'];
const DISTRICTS = ['Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara','Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga','Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo','Rusizi','Rutsiro','Rwamagana'];

export default function Register() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef();
  const backPath = user?.role === 'admin' ? '/admin/dashboard' : '/agent/dashboard';

  const [step, setStep] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [form, setForm] = useState({ id_number:'', first_name:'', last_name:'', date_of_birth:'', gender:'', phone:'', district:'' });
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/jpg'].includes(file.type)) { toast.error('JPG or PNG only'); return; }
    if (file.size > 5*1024*1024) { toast.error('Image must be under 5MB'); return; }

    setImagePreview(URL.createObjectURL(file));
    setOcrLoading(true); setOcrProgress(0);
    try {
      toast('Scanning ID document...', { icon: '🔍' });
      const extracted = await extractIdData(file, setOcrProgress);
      setForm(prev => ({
        ...prev,
        id_number:     extracted.id_number     || prev.id_number,
        first_name:    extracted.first_name    || prev.first_name,
        last_name:     extracted.last_name     || prev.last_name,
        date_of_birth: extracted.date_of_birth || prev.date_of_birth,
      }));
      extracted.confidence > 70
        ? toast.success(`Scanned (${extracted.confidence.toFixed(0)}% confidence)`)
        : toast('Scan complete - please review fields', { icon: '⚠️' });
    } catch { toast.error('OCR failed - fill in manually'); }
    finally { setOcrLoading(false); }
  };

  const handleVerify = async () => {
    if (!form.id_number) { toast.error('Enter an ID number first'); return; }
    setVerifying(true); setVerificationStatus(null);
    try {
      const res = await axios.post('/verify-id', { id_number: form.id_number });
      if (res.data.verified) {
        setVerificationStatus('verified');
        const d = res.data.data;
        setForm(prev => ({
          ...prev,
          first_name:    prev.first_name    || d.first_name,
          last_name:     prev.last_name     || d.last_name,
          date_of_birth: prev.date_of_birth || d.date_of_birth?.split('T')[0],
          gender:        prev.gender        || d.gender,
          district:      prev.district      || d.district,
        }));
        toast.success('ID verified against national registry');
      }
    } catch (err) {
      if (err.response?.data?.underAge) {
        setVerificationStatus('underage');
        toast.error(err.response.data.message);
      } else {
        setVerificationStatus('not_found');
        toast('ID not found - will be marked pending', { icon: '⚠️' });
      }
    } finally { setVerifying(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await axios.post('/register', form);
      toast.success('Client registered successfully!');
      navigate(backPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(backPath)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
          <Logo size={32} showText={true} textClass="text-base" />
          <span className="text-gray-200">|</span>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">New Registration</h1>
            <p className="text-gray-500 text-sm">Step {step+1} of {STEPS.length} - {STEPS[step]}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-8">
          {STEPS.map((_,i) => <div key={i} className={`h-1 flex-1 rounded-full ${i<=step?'bg-primary-600':'bg-gray-200'}`} />)}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Upload ID Document</h2>
              <p className="text-sm text-gray-500">Take a clear photo of the client's national ID card.</p>
              <div onClick={() => fileRef.current.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                {imagePreview
                  ? <img src={imagePreview} alt="ID" className="max-h-48 mx-auto rounded-lg object-cover" />
                  : <div className="space-y-2"><Upload className="mx-auto text-gray-300" size={40} /><p className="text-sm text-gray-500">Click to upload</p><p className="text-xs text-gray-400">JPG or PNG, max 5MB</p></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleImageChange} />
              {ocrLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-500"><span>Scanning...</span><span>{ocrProgress}%</span></div>
                  <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-primary-500 rounded-full transition-all" style={{width:`${ocrProgress}%`}} /></div>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">No photo? <button onClick={() => setStep(1)} className="text-primary-600 underline">Enter manually</button></p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Review and Verify</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                <div className="flex gap-2">
                  <input value={form.id_number} onChange={e => update('id_number', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="16-digit ID number" />
                  <button onClick={handleVerify} disabled={verifying}
                    className="px-4 py-2.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60 flex items-center gap-2">
                    {verifying ? <Loader size={14} className="animate-spin" /> : null} Verify
                  </button>
                </div>
                {verificationStatus === 'verified' && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} /> Verified</p>}
                {verificationStatus === 'not_found' && <p className="text-amber-600 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> Not found - will be pending</p>}
                {verificationStatus === 'underage' && <p className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> Registration denied - under 18</p>}
              </div>
              {[{label:'First Name',field:'first_name',type:'text'},{label:'Last Name',field:'last_name',type:'text'},{label:'Date of Birth',field:'date_of_birth',type:'date'}].map(({label,field,type}) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={form[field]} onChange={e => update(field, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Igitsina</label>
                <select value={form.gender} onChange={e => update('gender', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="07X XXX XXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select value={form.district} onChange={e => update('district', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Confirm Registration</h2>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  <div className="bg-primary-100 rounded-full p-2"><User size={18} className="text-primary-600" /></div>
                  <div>
                    <p className="font-medium text-gray-800">{form.first_name} {form.last_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{form.id_number}</p>
                  </div>
                  {verificationStatus === 'verified' && <CheckCircle size={18} className="text-green-500 ml-auto" />}
                </div>
                {[['Date of Birth',form.date_of_birth],['Igitsina',form.gender],['Phone',form.phone],['District',form.district],['Status',verificationStatus==='verified'?'Will be verified':'Will be pending']].map(([label,value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value||'—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => step===0 ? navigate(backPath) : setStep(s=>s-1)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
            {step < STEPS.length-1 ? (
              <button onClick={() => setStep(s=>s+1)} disabled={ocrLoading || verificationStatus==='underage'}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-1 disabled:opacity-60">
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60">
                {submitting ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />} Register Client
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
