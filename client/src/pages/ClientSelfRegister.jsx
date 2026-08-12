import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { extractIdData } from '../utils/ocr';
import Logo from '../components/Logo';
import SelfieCapture from '../components/SelfieCapture';
import Captcha from '../components/Captcha';
import TermsModal, { TERMS_VERSION } from '../components/TermsModal';
import { Upload, CheckCircle, AlertCircle, Loader, ArrowLeft, ArrowRight, User, Phone, FileText } from 'lucide-react';
import { yearMismatch } from '../utils/idValidation';
import { loadRegistrationDraft, saveRegistrationDraft, clearRegistrationDraft } from '../utils/registrationDraft';

const STEPS = ['Upload ID', 'Your Details', 'Contact Info', 'Selfie', 'Confirm'];
const DISTRICTS = ['Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara','Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga','Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo','Rusizi','Rutsiro','Rwamagana'];
const MAX_ATTEMPTS = 3;

export default function ClientSelfRegister() {
  const navigate = useNavigate();
  const fileRef = useRef();

  const [step, setStep] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState({ captcha_token: null, captcha_answer: '' });
  const [attempts, setAttempts] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verifyingId, setVerifyingId] = useState(false);
  const [tooManyAttempts, setTooManyAttempts] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [form, setForm] = useState({
    id_number: '', first_name: '', last_name: '',
    date_of_birth: '', gender: '', phone: '', district: '', email: '',
    selfie_data: null, id_document_data: null,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const dobMismatch = yearMismatch(form.id_number, form.date_of_birth);

  // Restore an in-progress draft (if any) once, on first mount.
  useEffect(() => {
    const draft = loadRegistrationDraft();
    if (draft) {
      setForm(prev => ({ ...prev, ...draft.form }));
      setStep(draft.step);
      setDraftRestored(true);
      toast('Continuing your saved registration draft', { icon: '📝' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave text-field progress (not photos) whenever it changes.
  useEffect(() => {
    saveRegistrationDraft(step, form);
  }, [step, form.id_number, form.first_name, form.last_name, form.date_of_birth, form.gender, form.phone, form.district, form.email]);

  const startOver = () => {
    clearRegistrationDraft();
    setForm({
      id_number: '', first_name: '', last_name: '',
      date_of_birth: '', gender: '', phone: '', district: '', email: '',
      selfie_data: null, id_document_data: null,
    });
    setStep(0);
    setDraftRestored(false);
    setImagePreview(null);
    toast('Starting fresh', { icon: '🔄' });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/jpg'].includes(file.type)) { toast.error('JPG or PNG only'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setImagePreview(URL.createObjectURL(file));
    setOcrLoading(true);
    setOcrProgress(0);

    // Keep a base64 copy of the ID document image for manual KYC review,
    // independent of what the OCR pass does with it.
    const reader = new FileReader();
    reader.onload = () => update('id_document_data', reader.result);
    reader.readAsDataURL(file);

    try {
      toast('Scanning your ID...', { icon: '🔍' });
      const extracted = await extractIdData(file, setOcrProgress);

      if (extracted.id_number) {
        const birthYear = parseInt(extracted.id_number.substring(1, 5));
        const age = new Date().getFullYear() - birthYear;
        if (age < 18) {
          toast.error('Registration denied. You must be 18 or older.');
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= MAX_ATTEMPTS) setTooManyAttempts(true);
          setOcrLoading(false);
          return;
        }
      }

      setForm(prev => ({
        ...prev,
        id_number:     extracted.id_number     || prev.id_number,
        first_name:    extracted.first_name    || prev.first_name,
        last_name:     extracted.last_name     || prev.last_name,
        date_of_birth: extracted.date_of_birth || prev.date_of_birth,
      }));

      if (extracted.confidence > 70) {
        toast.success(`Scanned successfully (${extracted.confidence.toFixed(0)}% confidence)`);
      } else {
        toast('Scan complete - please review the fields below', { icon: '⚠️' });
      }

      // OCR can only read what's printed and legible on the card - it can't reliably
      // pick up gender or district. Once we have an ID number, check it against the
      // national registry right away so those fields (and name/DOB) fill in automatically
      // instead of waiting for a separate manual "Verify" click.
      if (extracted.id_number) {
        await handleVerifyId(extracted.id_number);
      }
    } catch {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) setTooManyAttempts(true);
      else toast.error(`Scan failed. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleVerifyId = async (idOverride) => {
    const idToVerify = idOverride || form.id_number;
    if (!idToVerify) return;
    setVerifyingId(true);
    setVerificationStatus(null);
    try {
      const birthYear = parseInt(idToVerify.substring(1, 5));
      const age = new Date().getFullYear() - birthYear;
      if (age < 18) {
        setVerificationStatus('underage');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) setTooManyAttempts(true);
        return;
      }
      const res = await axios.post('/verify-id', { id_number: idToVerify, self: true });
      if (res.data.verified) {
        setVerificationStatus('registry_found');
        const d = res.data.data;
        setForm(prev => ({
          ...prev,
          first_name:    prev.first_name    || d.first_name,
          last_name:     prev.last_name     || d.last_name,
          date_of_birth: prev.date_of_birth || d.date_of_birth?.split('T')[0],
          gender:        prev.gender        || d.gender,
          district:      prev.district      || d.district,
        }));
        toast.success('All details auto-filled from registry');
      }
    } catch (err) {
      if (err.response?.data?.underAge) {
        setVerificationStatus('underage');
        toast.error(err.response.data.message);
      } else if (err.response?.data?.elderlyAssistRequired) {
        setVerificationStatus('elderly');
        toast.error(err.response.data.message, { duration: 6000 });
      } else {
        setVerificationStatus('not_found');
        toast('ID not found in registry - please fill in gender and district manually', { icon: '⚠️' });
      }
    } finally {
      setVerifyingId(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await axios.post('/client/register', {
        ...form, ...captcha,
        terms_accepted: termsAccepted,
        terms_version: TERMS_VERSION,
      });
      clearRegistrationDraft();
      toast.success('Registration successful! Check your email for login details.');
      navigate('/login');
    } catch (err) {
      if (err.response?.data?.elderlyAssistRequired) {
        toast.error(err.response.data.message, { duration: 6000 });
        return;
      }
      if (err.response?.data?.yearMismatch) {
        setStep(1);
        toast.error(err.response.data.message, { duration: 6000 });
        return;
      }
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setTooManyAttempts(true);
      } else {
        toast.error(err.response?.data?.message || 'Registration failed');
        if (err.response?.data?.duplicate) {
          toast('You are already registered. Try logging in instead.', { icon: 'ℹ️', duration: 5000 });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (tooManyAttempts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-md text-center">
          <Logo size={48} showText={false} className="mx-auto mb-4" />
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone size={24} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Need some help?</h2>
          <p className="text-gray-500 text-sm mb-6">
            You have reached the maximum number of self-registration attempts.
            Please visit a ServTech agent near you who will assist you in completing your registration.
          </p>
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-700 mb-6">
            <p className="font-semibold mb-1">Contact a ServTech Agent</p>
            <p>Visit any ServTech registered outlet and ask for assisted client registration.</p>
          </div>
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 underline">
            Already registered? Sign in here
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
          <Logo size={32} showText={true} textClass="text-base" />
          <span className="text-gray-200">|</span>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Client Registration</h1>
            <p className="text-gray-500 text-sm">Step {step + 1} of {STEPS.length} - {STEPS[step]}</p>
          </div>
        </div>

        {draftRestored && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><FileText size={15} /> Picking up where you left off</span>
            <button onClick={startOver} className="text-blue-700 underline text-xs shrink-0">Start over</button>
          </div>
        )}

        {attempts > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle size={15} />
            {MAX_ATTEMPTS - attempts} attempt(s) remaining before you will be directed to an agent.
          </div>
        )}

        <div className="flex gap-1 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {/* STEP 0 - Upload ID */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Upload your National ID</h2>
              <p className="text-sm text-gray-500">Take a clear photo of your national ID card. We will extract your details automatically.</p>

              <div onClick={() => fileRef.current.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                {imagePreview
                  ? <img src={imagePreview} alt="ID" className="max-h-48 mx-auto rounded-lg object-cover" />
                  : <div className="space-y-2">
                      <Upload className="mx-auto text-gray-300" size={40} />
                      <p className="text-sm text-gray-500">Click to upload your ID photo</p>
                      <p className="text-xs text-gray-400">JPG or PNG, max 5MB</p>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleImageChange} />

              {ocrLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Scanning...</span><span>{ocrProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-primary-500 rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                No photo?{' '}
                <button onClick={() => setStep(1)} className="text-primary-600 underline">Enter details manually</button>
              </p>
            </div>
          )}

          {/* STEP 1 - Your Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Your Details</h2>
              <p className="text-sm text-gray-500">
                Enter your ID number and click <strong>Verify</strong> to auto-fill your details from the national registry.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <input
                    value={form.id_number}
                    onChange={e => { update('id_number', e.target.value); setVerificationStatus(null); }}
                    maxLength={16}
                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="16-digit ID number"
                  />
                  <button
                    onClick={handleVerifyId}
                    disabled={verifyingId || !form.id_number}
                    className="px-4 py-2.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
                  >
                    {verifyingId ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Verify
                  </button>
                </div>

                {verificationStatus === 'underage' && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} /> You appear to be under 18. You can still submit, but registration will be rejected.
                  </p>
                )}
                {verificationStatus === 'elderly' && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} /> For clients over 80, please visit a ServTech agent for assisted registration.
                  </p>
                )}
                {verificationStatus === 'registry_found' && (
                  <p className="text-green-600 text-xs mt-1.5 flex items-center gap-1">
                    <CheckCircle size={12} /> Found in registry - details auto-filled below
                  </p>
                )}
                {verificationStatus === 'not_found' && (
                  <p className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} /> ID not found - please fill in your details manually
                  </p>
                )}
              </div>

              {dobMismatch && (
                <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={16} /> Birth year doesn't match the ID number (umwaka w'amavuko ntabwo uhura n'uwo muri ID). Please double-check the ID number and date of birth.
                </div>
              )}

              {[
                { label: 'First Name',    field: 'first_name',    type: 'text' },
                { label: 'Last Name',     field: 'last_name',     type: 'text' },
                { label: 'Date of Birth', field: 'date_of_birth', type: 'date' },
              ].map(({ label, field, type }) => (
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

          {/* STEP 2 - Contact Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Contact Information</h2>
              <p className="text-sm text-gray-500">We will send your login credentials to this email.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-400">*</span></label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="your@email.com" />
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

          {/* STEP 3 - Selfie */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Identity Photo</h2>
              <p className="text-sm text-gray-500">Take a live selfie so we can confirm it's really you registering.</p>
              <SelfieCapture value={form.selfie_data} onChange={v => update('selfie_data', v)} />
            </div>
          )}

          {/* STEP 4 - Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-medium text-gray-800">Confirm Registration</h2>
              <p className="text-sm text-gray-500">Review your details before submitting.</p>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  {form.selfie_data ? (
                    <img src={form.selfie_data} alt="Your selfie" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="bg-primary-100 rounded-full p-2"><User size={18} className="text-primary-600" /></div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{form.first_name} {form.last_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{form.id_number}</p>
                  </div>
                  {verificationStatus === 'registry_found' && <CheckCircle size={18} className="text-green-500 ml-auto" />}
                </div>
                {[
                  ['Date of Birth', form.date_of_birth],
                  ['Igitsina',      form.gender],
                  ['Email',         form.email],
                  ['Phone',         form.phone],
                  ['District',      form.district],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value || 'N/A'}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                After registration, your login credentials will be sent to <strong>{form.email}</strong>.
              </div>

              <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => setTermsModalOpen(true)} className="text-primary-600 underline">
                    Terms & Conditions
                  </button>.
                </span>
              </label>

              <Captcha onChange={setCaptcha} />

              <TermsModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={ocrLoading || (step === 3 && !form.selfie_data) || (step === 1 && dobMismatch)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-1 disabled:opacity-60">
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || !captcha.captcha_answer || !termsAccepted}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60">
                {submitting ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Submit Registration
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-primary-600 hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
