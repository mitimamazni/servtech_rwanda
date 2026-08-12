import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { extractIdData } from '../utils/ocr';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SelfieCapture from '../components/SelfieCapture';
import { Upload, CheckCircle, AlertCircle, Loader, ArrowLeft, ArrowRight, User, ScanLine } from 'lucide-react';
import { yearMismatch } from '../utils/idValidation';

const STEPS = ['Scan ID', 'Verify Details', 'Contact Info', 'Selfie (optional)', 'Confirm'];
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
  const [elderly, setElderly] = useState(false);
  const [elderlyConfirmed, setElderlyConfirmed] = useState(false);
  const [form, setForm] = useState({ id_number:'', first_name:'', last_name:'', date_of_birth:'', gender:'', phone:'', district:'', email:'', selfie_data: null, id_document_data: null });
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const dobMismatch = yearMismatch(form.id_number, form.date_of_birth);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/jpg'].includes(file.type)) { toast.error('JPG or PNG only'); return; }
    if (file.size > 5*1024*1024) { toast.error('Image must be under 5MB'); return; }
    setImagePreview(URL.createObjectURL(file));
    setOcrLoading(true); setOcrProgress(0);

    // Keep a base64 copy of the ID document image for manual KYC review.
    const reader = new FileReader();
    reader.onload = () => update('id_document_data', reader.result);
    reader.readAsDataURL(file);

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
        : toast('Scan complete - please review and correct the fields below', { icon: '⚠️' });

      // OCR can't reliably read gender/district off the card layout, so as soon as
      // we have a plausible ID number, look it up against the national registry
      // to auto-fill those two fields (and confirm/override name + DOB) in one pass.
      if (extracted.id_number) {
        await handleVerify(extracted.id_number);
      }
    } catch { toast.error('OCR failed - please fill in manually'); }
    finally { setOcrLoading(false); }
  };

  const handleVerify = async (idOverride) => {
    const idToVerify = idOverride || form.id_number;
    if (!idToVerify) { toast.error('Enter an ID number first'); return; }
    setVerifying(true); setVerificationStatus(null);
    try {
      const res = await axios.post('/verify-id', { id_number: idToVerify });
      if (res.data.verified) {
        setVerificationStatus('verified');
        setElderly(!!res.data.elderly);
        const d = res.data.data;
        setForm(prev => ({
          ...prev,
          first_name:    prev.first_name    || d.first_name,
          last_name:     prev.last_name     || d.last_name,
          date_of_birth: prev.date_of_birth || d.date_of_birth?.split('T')[0],
          gender:        prev.gender        || d.gender,
          district:      prev.district      || d.district,
        }));
        toast.success('ID verified against national registry - all fields auto-filled');
        if (res.data.elderly) toast('Client is over 80 - identity confirmation will be required before submitting', { icon: '⚠️' });
      }
    } catch (err) {
      if (err.response?.data?.underAge) {
        setVerificationStatus('underage');
        toast.error(err.response.data.message);
      } else {
        setVerificationStatus('not_found');
        setElderly(!!err.response?.data?.elderly);
        toast('ID not found in registry - gender and district need to be entered manually', { icon: '⚠️' });
      }
    } finally { setVerifying(false); }
  };

  const handleSubmit = async () => {
    if (!form.email) { toast.error('Client email is required so they can log in'); return; }
    setSubmitting(true);
    try {
      await axios.post('/register', { ...form, elderly_confirmed: elderlyConfirmed });
      toast.success('Client registered successfully - login credentials sent to their email');
      navigate(backPath);
    } catch (err) {
      if (err.response?.data?.elderlyConfirmRequired) {
        setElderly(true);
        toast.error(err.response.data.message);
      } else if (err.response?.data?.yearMismatch) {
        setStep(1);
        toast.error(err.response.data.message, { duration: 6000 });
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

        {/* Agent registration header - distinct blue banner */}
        <div className="bg-primary-600 rounded-2xl p-5 mb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 rounded-xl p-2.5">
              <ScanLine size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">OCR Client Registration</h1>
              <p className="text-primary-200 text-sm">Scan a national ID to register a new client</p>
            </div>
          </div>
          <div className="flex gap-1 mt-4">
            {STEPS.map((s,i) => (
              <div key={i} className="flex-1">
                <div className={`h-1 rounded-full mb-1.5 ${i <= step ? 'bg-white' : 'bg-white bg-opacity-30'}`} />
                <p className={`text-xs ${i <= step ? 'text-white' : 'text-primary-300'}`}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Upload Client ID Document</h2>
              <p className="text-sm text-gray-500">Photograph the client's national ID card clearly. The system will extract their details automatically.</p>
              <div onClick={() => fileRef.current.click()}
                className="border-2 border-dashed border-primary-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                {imagePreview
                  ? <img src={imagePreview} alt="ID" className="max-h-48 mx-auto rounded-lg object-cover" />
                  : <div className="space-y-3">
                      <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="text-primary-500" size={24} />
                      </div>
                      <p className="text-sm text-gray-600 font-medium">Click to upload ID photo</p>
                      <p className="text-xs text-gray-400">JPG or PNG, max 5MB</p>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleImageChange} />
              {ocrLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-600 font-medium">Scanning document...</span>
                    <span className="text-gray-500">{ocrProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-primary-500 rounded-full transition-all" style={{width:`${ocrProgress}%`}} />
                  </div>
                </div>
              )}
              <button onClick={() => setStep(1)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-lg">
                Skip scan and enter details manually
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-800">Review Extracted Details</h2>
                <span className="text-xs bg-primary-50 text-primary-600 border border-primary-200 px-2 py-1 rounded-full">Agent view</span>
              </div>
              <p className="text-sm text-gray-500">Correct any fields the scan may have missed. Then click Verify to check the national registry.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                <div className="flex gap-2">
                  <input value={form.id_number} onChange={e => update('id_number', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="16-digit ID number" />
                  <button onClick={handleVerify} disabled={verifying}
                    className="px-4 py-2.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-60 flex items-center gap-2">
                    {verifying ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />} Verify
                  </button>
                </div>
                {verificationStatus === 'verified'  && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} /> Verified against national registry</p>}
                {verificationStatus === 'not_found' && <p className="text-amber-600 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> Not found - will be marked pending</p>}
                {verificationStatus === 'underage'  && <p className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> Registration denied - client is under 18</p>}
              </div>
              {[{l:'First Name',f:'first_name',t:'text'},{l:'Last Name',f:'last_name',t:'text'},{l:'Date of Birth',f:'date_of_birth',t:'date'}].map(({l,f,t}) => (
                <div key={f}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input type={t} value={form[f]} onChange={e => update(f, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}
              {dobMismatch && (
                <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> Birth year doesn't match the ID number (umwaka w'amavuko ntabwo uhura n'uwo muri ID). Please double-check the ID number and date of birth.
                </div>
              )}
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
              <h2 className="font-medium text-gray-800">Client Contact Information</h2>
              <p className="text-sm text-gray-500">Enter the client's phone number, district, and email. A login account will be created and credentials sent to this email.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="client@email.com" />
                <p className="text-xs text-gray-400 mt-1">We will send the client's login credentials to this email.</p>
              </div>
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
              <h2 className="font-medium text-gray-800">Identity Photo <span className="text-xs font-normal text-gray-400">(optional)</span></h2>
              <p className="text-sm text-gray-500">Since you're registering this client in person, a selfie is optional, but adding one strengthens the KYC record.</p>
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
              <h2 className="font-medium text-gray-800">Confirm and Submit</h2>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  {form.selfie_data ? (
                    <img src={form.selfie_data} alt="Client selfie" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="bg-primary-100 rounded-full p-2.5"><User size={18} className="text-primary-600" /></div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{form.first_name} {form.last_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{form.id_number}</p>
                  </div>
                  {verificationStatus === 'verified' && <CheckCircle size={18} className="text-green-500 ml-auto" />}
                  {verificationStatus === 'not_found' && <AlertCircle size={18} className="text-amber-500 ml-auto" />}
                </div>
                {[['Date of Birth',form.date_of_birth],['Igitsina',form.gender],['Phone',form.phone],['Email',form.email],['District',form.district],['Registry Status',verificationStatus==='verified'?'Verified':'Pending review']].map(([label,value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value||'N/A'}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                You are registering this client as a <strong>{user?.role}</strong>. This action will be logged in the audit trail.
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 text-sm text-primary-700">
                A login account will be created for this client and their credentials will be sent to <strong>{form.email || 'the email provided'}</strong>.
              </div>
              {dobMismatch && (
                <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> Birth year doesn't match the ID number. Go back to Review Extracted Details and fix the date of birth or ID number before submitting.
                </div>
              )}
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
              <button onClick={() => setStep(s=>s+1)} disabled={ocrLoading || verificationStatus==='underage' || (step===2 && !form.email)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60">
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || dobMismatch || (elderly && !elderlyConfirmed)}
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