import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Terms of Service – TechMo' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/register" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated: January 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By creating an account on the TechMo Customer Portal, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Account Registration</h2>
            <p>You must provide accurate and complete information when creating your account. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Loyalty Points</h2>
            <p>TechMo loyalty points are earned on qualifying purchases at TechMo stores. Points have no cash value, are non-transferable, and may expire in accordance with our loyalty programme rules. TechMo reserves the right to modify or discontinue the loyalty programme at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Repairs & Warranties</h2>
            <p>Repair status and warranty information shown in the portal is for reference only. For official warranty claims, please visit a TechMo service centre with proof of purchase.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Acceptable Use</h2>
            <p>You agree not to misuse the portal, attempt unauthorised access to any systems, or use the service for any unlawful purpose.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Changes to Terms</h2>
            <p>TechMo may update these terms from time to time. Continued use of the portal after changes constitutes acceptance of the revised terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Contact</h2>
            <p>For questions about these terms, contact us at <span className="text-slate-200">support@techmo.lk</span>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
