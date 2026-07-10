import { X } from 'lucide-react';

export const TERMS_VERSION = 'v1-2026-07';

export default function TermsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Terms & Conditions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-sm text-gray-600 space-y-4">
          <p className="text-xs text-gray-400">Version {TERMS_VERSION}</p>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">1. Eligibility</h3>
            <p>You must be at least 18 years old to register as a client. ServTech Rwanda verifies age against the ID number and date of birth you provide, and against Rwanda's national identity registry where a match is found. Providing false age or identity information is grounds for immediate account rejection or suspension.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">2. Identity Verification (KYC)</h3>
            <p>To comply with Know Your Customer regulations for betting services, you consent to ServTech Rwanda collecting and processing your national ID number, photo ID, a live selfie for face-match verification, and related personal details. This data is used solely for identity verification, fraud prevention, and regulatory compliance.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">3. Accuracy of Information</h3>
            <p>You confirm that all information you submit is accurate and belongs to you. One account per person is permitted; attempting to register multiple client accounts, or an account under someone else's identity, will result in rejection or suspension.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">4. Data Protection</h3>
            <p>Your personal and biometric data is stored securely and is only accessible to authorized ServTech Rwanda staff for verification and compliance purposes. It will not be sold or shared with third parties outside of applicable legal or regulatory requirements.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">5. Account Security</h3>
            <p>Login credentials generated for you are personal and must not be shared. You are responsible for any activity that occurs under your account once issued.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">6. Responsible Engagement</h3>
            <p>ServTech Rwanda supports responsible use of betting services. If you or someone you know needs support managing gambling-related concerns, please contact a ServTech agent for guidance and available resources.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">7. Changes to These Terms</h3>
            <p>These terms may be updated from time to time. Continued use of your account after an update constitutes acceptance of the revised terms.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
