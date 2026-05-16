import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Privacy Policy – TechMo' };

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/register" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated: January 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>When you register, we collect your name, phone number, email address, and password (stored as a secure hash). We also collect purchase history, repair records, and loyalty point transactions associated with your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>To manage your account and loyalty points</li>
              <li>To display your repair and order history</li>
              <li>To send important account notifications</li>
              <li>To improve our services and customer experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Data Sharing</h2>
            <p>We do not sell your personal information to third parties. Your data may be shared with TechMo service centres to fulfil repair or warranty requests, and with payment processors where applicable.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Data Security</h2>
            <p>We implement industry-standard security measures including password hashing, encrypted connections (HTTPS), and access controls to protect your personal data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Cookies</h2>
            <p>We use an HttpOnly cookie to maintain your session securely. This cookie is not accessible to JavaScript and helps protect your account from certain attacks.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data by contacting us. Account deletion will remove your profile but purchase and repair records may be retained for legal and warranty purposes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Contact</h2>
            <p>For privacy-related enquiries, contact us at <span className="text-slate-200">privacy@techmo.lk</span>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
