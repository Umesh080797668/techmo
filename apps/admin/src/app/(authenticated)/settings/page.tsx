'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mailerApi, settingsApi, parseApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Mail, Building2, Bell, Lock, Monitor, Settings as SettingsIcon,
  Send, Lightbulb, KeyRound, LockKeyhole, Play, ExternalLink,
  CheckCircle2, Trash2, Download, AlertOctagon, Info,
} from 'lucide-react';

const PasskeyManager = dynamic(() => import('@/components/PasskeyManager'), { ssr: false });

const TABS = [
  { id: 'email',         label: 'Email & SMTP',     Icon: Mail },
  { id: 'business',      label: 'Business Info',    Icon: Building2 },
  { id: 'notifications', label: 'Notifications',    Icon: Bell },
  { id: 'security',      label: 'Security',         Icon: Lock },
  { id: 'kiosk',         label: 'Kiosk Mode',       Icon: Monitor },
  { id: 'system',        label: 'System',           Icon: SettingsIcon },
];

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-hd">
        <p className="settings-section-title">{title}</p>
        {description && <p className="settings-section-desc">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="field-row">
      <div className="field-label-col">
        <label className="field-label">{label}</label>
        {hint && <p className="field-hint">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Default values ───────────────────────────────────────────────────────────
const SMTP_DEFAULT     = { host: '', port: '587', user: '', from: '', alertEmail: '', secure: false };
const BUSINESS_DEFAULT = {
  name: 'TechMo', tagline: "Sri Lanka's Premier Device Repair & Retail",
  phone: '', email: '', address: '', city: '', country: 'Sri Lanka',
  regNumber: '', vatNumber: '', logo: '',
  currency: 'LKR', timezone: 'Asia/Colombo', dateFormat: 'DD/MM/YYYY',
};
const NOTIF_DEFAULT = {
  lowStockThreshold: '5', sendLowStockAlert: true,
  sendRepairUpdates: true, sendInvoiceEmail: true,
  dailyReportEmail: '', adminAlertEmail: '',
};
const KIOSK_DEFAULT = { exitPin: '1234', idleSeconds: 60 };

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('email');
  const router   = useRouter();
  const { user } = useAuth();
  const qc       = useQueryClient();

  // ── Load all settings from backend ──────────────────────────────────────
  const { data: smtpData }  = useQuery({
    queryKey: ['settings-smtp'],
    queryFn:  () => settingsApi.getSmtp().then(r => r.data),
  });
  const { data: bizData }   = useQuery({
    queryKey: ['settings-business'],
    queryFn:  () => settingsApi.getBusiness().then(r => r.data),
  });
  const { data: notifData } = useQuery({
    queryKey: ['settings-notifications'],
    queryFn:  () => settingsApi.getNotifications().then(r => r.data),
  });
  const { data: kioskData } = useQuery({
    queryKey: ['settings-kiosk'],
    queryFn:  () => settingsApi.getKiosk().then(r => r.data),
  });

  // ── Local form state — seeded from API once it arrives ───────────────────
  const [smtp,          setSmtp]     = useState(SMTP_DEFAULT);
  const [business,      setBusiness] = useState(BUSINESS_DEFAULT);
  const [notifications, setNotif]    = useState(NOTIF_DEFAULT);
  const [kiosk,         setKiosk]    = useState(KIOSK_DEFAULT);
  const [testEmail,     setTestEmail]     = useState('');
  const [testLoading,   setTestLoading]   = useState(false);

  const [smtpReady,  setSmtpReady]  = useState(false);
  const [bizReady,   setBizReady]   = useState(false);
  const [notifReady, setNotifReady] = useState(false);
  const [kioskReady, setKioskReady] = useState(false);

  useEffect(() => { if (smtpData  && !smtpReady)  { setSmtp(smtpData);    setSmtpReady(true);  } }, [smtpData]);
  useEffect(() => { if (bizData   && !bizReady)   { setBusiness(bizData); setBizReady(true);   } }, [bizData]);
  useEffect(() => { if (notifData && !notifReady) { setNotif(notifData);  setNotifReady(true); } }, [notifData]);
  useEffect(() => { if (kioskData && !kioskReady) { setKiosk(kioskData);  setKioskReady(true); } }, [kioskData]);

  // ── Manager PIN ──────────────────────────────────────────────────────────
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const { data: pinData, isLoading: pinLoading } = useQuery({
    queryKey: ['manager-pin'],
    queryFn:  () => settingsApi.getManagerPin().then(r => r.data as { pin: string }),
  });

  const savePinMutation = useMutation({
    mutationFn: (pin: string) => settingsApi.setManagerPin(pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-pin'] });
      toast.success('Manager PIN updated');
      setNewPin(''); setConfirmPin('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update PIN'),
  });

  // ── Save SMTP ────────────────────────────────────────────────────────────
  const saveSmtpMutation = useMutation({
    mutationFn: () => settingsApi.saveSmtp(smtp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-smtp'] });
      toast.success('SMTP settings saved');
    },
    onError: (e) => toast.error(parseApiError(e).message),
  });

  // ── Test email ───────────────────────────────────────────────────────────
  const sendTestEmailMutation = useMutation({
    mutationFn: () => mailerApi.sendInvoiceEmail({
      to: testEmail, customerName: 'Test Customer',
      invoiceNo: 'TEST-0001', pdfUrl: '',
    }),
    onSuccess: () => toast.success(`Test email sent to ${testEmail}`),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Email failed — check SMTP config'),
  });

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error('Enter a test email address'); return; }
    setTestLoading(true);
    try { await sendTestEmailMutation.mutateAsync(); }
    finally { setTestLoading(false); }
  };

  // ── Save Business ────────────────────────────────────────────────────────
  const saveBusinessMutation = useMutation({
    mutationFn: () => settingsApi.saveBusiness(business),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-business'] });
      toast.success('Business info saved');
    },
    onError: (e) => toast.error(parseApiError(e).message),
  });

  // ── Save Notifications ───────────────────────────────────────────────────
  const saveNotifMutation = useMutation({
    mutationFn: () => settingsApi.saveNotifications(notifications),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-notifications'] });
      toast.success('Notification settings saved');
    },
    onError: (e) => toast.error(parseApiError(e).message),
  });

  // ── Save Kiosk ───────────────────────────────────────────────────────────
  const saveKioskMutation = useMutation({
    mutationFn: () => settingsApi.saveKiosk(kiosk),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-kiosk'] });
      toast.success('Kiosk settings saved');
    },
    onError: (e) => toast.error(parseApiError(e).message),
  });

  // ── Clear cache / Export ─────────────────────────────────────────────────
  const clearCacheMutation = useMutation({
    mutationFn: () => settingsApi.clearCache(),
    onSuccess: (res) => toast.success((res.data as any)?.message ?? 'Cache cleared'),
    onError: (e) => toast.error(parseApiError(e).message),
  });

  const exportDataMutation = useMutation({
    mutationFn: () => settingsApi.exportData(),
    onSuccess: (res) => toast.success((res.data as any)?.message ?? 'Export queued — check your email'),
    onError: (e) => toast.error(parseApiError(e).message),
  });

  const handleSavePin = () => {
    if (!newPin || newPin.length < 4) { toast.error('PIN must be at least 4 characters'); return; }
    if (newPin !== confirmPin)        { toast.error('PINs do not match'); return; }
    savePinMutation.mutate(newPin);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your TechMo system preferences</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="seg-switcher flex-wrap !w-auto sm:!w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={activeTab === t.id ? 'seg-btn-on' : 'seg-btn-off'}>
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Email & SMTP */}
      {activeTab === 'email' && (
        <div className="space-y-5">
          <Section title="SMTP Configuration" description="Configure the outbound email server used for notifications and invoices.">
            <FieldRow label="SMTP Host" hint="e.g. smtp.gmail.com">
              <input className="input" placeholder="smtp.gmail.com" value={smtp.host}
                onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} />
            </FieldRow>
            <FieldRow label="SMTP Port" hint="587 for STARTTLS, 465 for SSL">
              <input className="input" type="number" value={smtp.port}
                onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Username / Email">
              <input className="input" type="email" placeholder="mailer@techmo.lk" value={smtp.user}
                onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} />
            </FieldRow>
            <FieldRow label="From Email" hint="Displayed as sender address">
              <input className="input" type="email" placeholder="no-reply@techmo.lk" value={smtp.from}
                onChange={e => setSmtp(s => ({ ...s, from: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Alert Email" hint="Receives system alert emails">
              <input className="input" type="email" placeholder="admin@techmo.lk" value={smtp.alertEmail}
                onChange={e => setSmtp(s => ({ ...s, alertEmail: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Encryption">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={smtp.secure}
                  onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked }))} />
                <span className="text-sm text-slate-700">Use SSL/TLS (port 465)</span>
              </label>
            </FieldRow>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Runtime SMTP config is stored in Redis and overrides the default environment variables
              (<code className="font-mono text-xs">SMTP_HOST</code>, <code className="font-mono text-xs">SMTP_USER</code>,{' '}
              <code className="font-mono text-xs">SMTP_PASS</code>) for the next email send.</span>
            </div>

            <div className="flex justify-end">
              <button onClick={() => saveSmtpMutation.mutate()}
                disabled={saveSmtpMutation.isPending}
                className="btn-primary text-sm disabled:opacity-50">
                {saveSmtpMutation.isPending ? 'Saving…' : 'Save SMTP Config'}
              </button>
            </div>
          </Section>

          <Section title="Test Email" description="Send a test email to verify your SMTP configuration is working.">
            <FieldRow label="Test Recipient">
              <div className="flex gap-2">
                <input className="input flex-1" type="email" placeholder="you@example.com"
                  value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                <button onClick={handleTestEmail} disabled={testLoading}
                  className="btn-secondary text-sm px-4 whitespace-nowrap flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {testLoading ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </FieldRow>
          </Section>
        </div>
      )}

      {/* Business Info */}
      {activeTab === 'business' && (
        <div className="space-y-5">
          <Section title="Business Details" description="These details appear on invoices, receipts, and emails.">
            <FieldRow label="Business Name">
              <input className="input" value={business.name}
                onChange={e => setBusiness(b => ({ ...b, name: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Tagline">
              <input className="input" value={business.tagline}
                onChange={e => setBusiness(b => ({ ...b, tagline: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Phone">
              <input className="input" placeholder="+94 11 234 5678" value={business.phone}
                onChange={e => setBusiness(b => ({ ...b, phone: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Email">
              <input className="input" type="email" placeholder="info@techmo.lk" value={business.email}
                onChange={e => setBusiness(b => ({ ...b, email: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Address">
              <input className="input" placeholder="123 Main St" value={business.address}
                onChange={e => setBusiness(b => ({ ...b, address: e.target.value }))} />
            </FieldRow>
            <FieldRow label="City">
              <input className="input" placeholder="Colombo" value={business.city}
                onChange={e => setBusiness(b => ({ ...b, city: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Country">
              <input className="input" value={business.country}
                onChange={e => setBusiness(b => ({ ...b, country: e.target.value }))} />
            </FieldRow>
          </Section>

          <Section title="Legal & Tax">
            <FieldRow label="Registration No.">
              <input className="input" placeholder="PV/00000" value={business.regNumber}
                onChange={e => setBusiness(b => ({ ...b, regNumber: e.target.value }))} />
            </FieldRow>
            <FieldRow label="VAT Number">
              <input className="input" placeholder="VAT-000000000" value={business.vatNumber}
                onChange={e => setBusiness(b => ({ ...b, vatNumber: e.target.value }))} />
            </FieldRow>
          </Section>

          <Section title="Regional Settings">
            <FieldRow label="Currency">
              <select className="input" value={business.currency}
                onChange={e => setBusiness(b => ({ ...b, currency: e.target.value }))}>
                {['LKR', 'USD', 'EUR', 'GBP', 'AUD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Timezone">
              <select className="input" value={business.timezone}
                onChange={e => setBusiness(b => ({ ...b, timezone: e.target.value }))}>
                {['Asia/Colombo', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Singapore'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Date Format">
              <select className="input" value={business.dateFormat}
                onChange={e => setBusiness(b => ({ ...b, dateFormat: e.target.value }))}>
                {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(f => <option key={f}>{f}</option>)}
              </select>
            </FieldRow>
          </Section>

          <div className="flex justify-end">
            <button onClick={() => saveBusinessMutation.mutate()}
              disabled={saveBusinessMutation.isPending}
              className="btn-primary text-sm disabled:opacity-50">
              {saveBusinessMutation.isPending ? 'Saving…' : 'Save Business Info'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <Section title="Automated Notifications" description="Control which emails are automatically sent by the system.">
            <FieldRow label="Low Stock Threshold" hint="Alert when stock falls below this level">
              <input className="input" type="number" min="1" value={notifications.lowStockThreshold}
                onChange={e => setNotif(n => ({ ...n, lowStockThreshold: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Alert Email" hint="Receives low-stock and system alerts">
              <input className="input" type="email" placeholder="admin@techmo.lk"
                value={notifications.adminAlertEmail}
                onChange={e => setNotif(n => ({ ...n, adminAlertEmail: e.target.value }))} />
            </FieldRow>
            <FieldRow label="Daily Report Email" hint="Summary report sent each morning">
              <input className="input" type="email" placeholder="reports@techmo.lk"
                value={notifications.dailyReportEmail}
                onChange={e => setNotif(n => ({ ...n, dailyReportEmail: e.target.value }))} />
            </FieldRow>
          </Section>

          <Section title="Email Triggers">
            {([
              { key: 'sendLowStockAlert', label: 'Low Stock Alerts',      desc: 'Email when inventory falls below threshold' },
              { key: 'sendRepairUpdates', label: 'Repair Status Updates', desc: 'Email customers when repair status changes' },
              { key: 'sendInvoiceEmail',  label: 'Invoice Emails',         desc: 'Email invoice PDF to customer after order' },
            ] as const).map(({ key, label, desc }) => (
              <FieldRow key={key} label={label} hint={desc}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setNotif(n => ({ ...n, [key]: !n[key] }))}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      notifications[key] ? 'bg-primary' : 'bg-slate-300'
                    }`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifications[key] ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="text-sm text-slate-600">
                    {notifications[key] ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </FieldRow>
            ))}
          </Section>

          <div className="flex justify-end">
            <button onClick={() => saveNotifMutation.mutate()}
              disabled={saveNotifMutation.isPending}
              className="btn-primary text-sm disabled:opacity-50">
              {saveNotifMutation.isPending ? 'Saving…' : 'Save Notification Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <Section
            title="Manager PIN"
            description="The 4–8 digit PIN required to authorise protected discounts at the POS terminal. Managers and super_admin can change this.">
            <FieldRow label="Current PIN" hint="Always stored securely — shown masked">
              <div className="flex items-center gap-2">
                <code className="text-sm bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-mono tracking-widest">
                  {pinLoading ? '…' : pinData?.pin ? '•'.repeat(pinData.pin.length) : '————'}
                </code>
                <span className="text-xs text-slate-400">
                  {pinLoading ? 'Loading…' : `(${pinData?.pin?.length ?? 0} characters)`}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="New PIN" hint="4–8 digits or characters">
              <input
                className="input"
                type="password"
                maxLength={8}
                placeholder="Enter new PIN"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Confirm New PIN">
              <input
                className="input"
                type="password"
                maxLength={8}
                placeholder="Re-enter new PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
              />
            </FieldRow>
          </Section>

          <div className="card p-4 bg-amber-50 border border-amber-100 text-sm text-amber-700 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <span><strong>How it works:</strong> When a cashier scans a product with a pricing rule marked
            "Requires Manager PIN", the POS will pause and show a PIN prompt. The manager enters this PIN
            to approve the discounted sale. If cancelled, the item is not added to the cart.</span>
          </div>

          {user && (
            <Section title="Passkeys (WebAuthn)" description="Register biometric or hardware passkeys as a PIN-free way to authorise protected actions.">
              <PasskeyManager userId={user.id} username={user.name ?? user.email ?? user.id} />
            </Section>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSavePin}
              disabled={savePinMutation.isPending || !newPin || !confirmPin}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5">
              <LockKeyhole className="w-4 h-4" />
              {savePinMutation.isPending ? 'Saving…' : 'Update Manager PIN'}
            </button>
          </div>
        </div>
      )}

      {/* Kiosk Mode */}
      {activeTab === 'kiosk' && (
        <div className="space-y-5">
          <Section title="Kiosk Mode" description="Launch a self-service customer check-in and repair tracking terminal on this device.">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4 items-start">
              <Monitor className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Self-Service Customer Kiosk</p>
                <p className="text-sm text-slate-600 mt-1">
                  Customers can check in for repairs, track existing tickets using their phone number, and view repair status — without needing staff assistance.
                </p>
                <ul className="text-sm text-slate-600 mt-2 list-disc list-inside space-y-1">
                  <li>New repair check-in with customer phone &amp; device details</li>
                  <li>Repair status lookup by phone number or ticket number</li>
                  <li>Secure exit via manager PIN — screen locks when unattended</li>
                  <li>Auto-reset to welcome screen after 60 seconds of inactivity</li>
                </ul>
              </div>
            </div>

            <FieldRow label="Launch Kiosk" hint="Opens full-screen kiosk on this browser tab">
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/kiosk')}
                  className="btn-primary text-sm flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Launch Kiosk on This Device
                </button>
                <button
                  onClick={() => window.open('/kiosk', '_blank')}
                  className="btn-secondary text-sm flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                </button>
              </div>
            </FieldRow>
          </Section>

          <Section title="Kiosk PIN & Timeout" description="Configure the exit PIN and auto-reset timeout for kiosk mode.">
            <FieldRow label="Exit PIN" hint="4–6 digit PIN managers use to exit kiosk mode">
              <input
                className="input w-32 tracking-widest font-mono"
                type="password"
                maxLength={6}
                placeholder="••••"
                value={kiosk.exitPin}
                onChange={e => setKiosk(k => ({ ...k, exitPin: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Idle Timeout" hint="Seconds of inactivity before auto-returning to welcome screen">
              <div className="flex items-center gap-2">
                <input
                  className="input w-24"
                  type="number"
                  min={10}
                  max={600}
                  value={kiosk.idleSeconds}
                  onChange={e => setKiosk(k => ({ ...k, idleSeconds: Number(e.target.value) }))}
                />
                <span className="text-xs text-slate-400">seconds (10–600)</span>
              </div>
            </FieldRow>
            <div className="flex justify-end">
              <button
                onClick={() => saveKioskMutation.mutate()}
                disabled={saveKioskMutation.isPending || kiosk.exitPin.length < 4}
                className="btn-primary text-sm disabled:opacity-50">
                {saveKioskMutation.isPending ? 'Saving…' : 'Save Kiosk Settings'}
              </button>
            </div>
          </Section>

          <Section title="Recommended Setup" description="Tips for deploying a dedicated kiosk terminal.">
            <div className="space-y-2 text-sm text-slate-600">
              {[
                'Use a dedicated tablet or touchscreen monitor at the service counter',
                'Enable browser full-screen mode (F11) before launching',
                'Disable browser address bar / navigation for kiosk mode (use kiosk browser apps)',
                'Set screen timeout to Never in OS display settings',
                'Mount the device at customer counter height (100–110 cm)',
              ].map(tip => (
                <p key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {tip}
                </p>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* System */}
      {activeTab === 'system' && (
        <div className="space-y-5">
          <Section title="System Information" description="Read-only environment and version information.">
            {[
              { label: 'Application', value: 'TechMo Enterprise POS' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Environment', value: process.env.NODE_ENV ?? 'development' },
              { label: 'API Gateway', value: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000' },
              { label: 'Node.js', value: typeof process !== 'undefined' ? process.version : 'N/A' },
            ].map(({ label, value }) => (
              <FieldRow key={label} label={label}>
                <code className="text-sm bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-mono">{value}</code>
              </FieldRow>
            ))}
          </Section>

          <Section title="Maintenance">
            <FieldRow label="Clear Cache" hint="Flush application cache keys — may briefly slow responses">
              <button
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
                className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {clearCacheMutation.isPending ? 'Clearing…' : 'Clear Cache'}
              </button>
            </FieldRow>
            <FieldRow label="Export Data" hint="Queue a full JSON export — download link sent to your email">
              <button
                onClick={() => exportDataMutation.mutate()}
                disabled={exportDataMutation.isPending}
                className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                {exportDataMutation.isPending ? 'Queuing…' : 'Export Data'}
              </button>
            </FieldRow>
          </Section>

          <div className="card p-4 bg-red-50 border border-red-100">
            <h4 className="font-semibold text-red-700 mb-1">Danger Zone</h4>
            <p className="text-sm text-red-600 mb-3">These actions are irreversible. Proceed with caution.</p>
            <button onClick={() => toast.error('This action requires super-admin privileges')}
              className="text-sm bg-red-600 text-white rounded-xl px-4 py-2 hover:bg-red-700 transition flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" /> Reset System Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
