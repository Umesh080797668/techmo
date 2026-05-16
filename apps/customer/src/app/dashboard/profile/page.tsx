'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi, myConsentApi } from '@/lib/api';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { UserCircle, Save, Pencil, Phone, Mail, MapPin, Star } from 'lucide-react';
import clsx from 'clsx';

const profileSchema = z.object({
  name:    z.string().min(2, 'Name must be at least 2 characters'),
  email:   z.string().email('Invalid email').or(z.literal('')).optional(),
  address: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { customer, setCustomer, refreshProfile } = useCustomerAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => customerApi.me().then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', address: '' },
  });

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name ?? '', email: profile.email ?? '', address: profile.address ?? '' });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => customerApi.update(data).then(r => r.data),
    onSuccess: (data) => {
      setCustomer(data);
      qc.invalidateQueries({ queryKey: ['customer-profile'] });
      toast.success('Profile updated!');
      setEditing(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to update profile');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  const data = profile ?? customer;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your personal information.</p>
        </div>
      </div>

      {/* Avatar + info card */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary flex-shrink-0">
          {data?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-white">{data?.name ?? '—'}</p>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Phone className="w-3.5 h-3.5" />
              {data?.phone ?? '—'}
            </span>
            {data?.email && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Mail className="w-3.5 h-3.5" />
                {data.email}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase',
              data?.tier === 'PREMIUM'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-primary/20 text-primary'
            )}>
              <Star className="w-3 h-3 mr-1" />
              {data?.tier ?? 'STANDARD'}
            </span>
            <span className="text-xs text-slate-400">{(data?.loyaltyPoints ?? 0).toLocaleString()} loyalty points</span>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm self-start"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing ? (
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">Edit Profile</h2>

          <div>
            <label className="label">Full Name</label>
            <input className={clsx('input', errors.name && 'border-red-500')} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Email Address <span className="text-slate-500 font-normal">(optional)</span></label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                className={clsx('input pl-9', errors.email && 'border-red-500')}
                type="email"
                placeholder="email@example.com"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Address <span className="text-slate-500 font-normal">(optional)</span></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <textarea
                className="input pl-9 min-h-[80px] resize-y"
                placeholder="Your address…"
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={mutation.isPending || !isDirty}
            >
              {mutation.isPending ? <span className="loader" /> : <><Save className="w-4 h-4" />Save Changes</>}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setEditing(false); reset(); }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Account Details</h2>
          <dl className="space-y-4">
            <DetailRow label="Phone" icon={<Phone className="w-4 h-4 text-slate-500" />} value={data?.phone ?? '—'} />
            <DetailRow label="Email" icon={<Mail className="w-4 h-4 text-slate-500" />} value={data?.email ?? 'Not set'} />
            <DetailRow
              label="Address"
              icon={<MapPin className="w-4 h-4 text-slate-500" />}
              value={data?.address ?? 'Not set'}
            />
          </dl>

          {/* Non-editable info */}
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Read-Only</p>
            <dl className="space-y-2">
              <DetailRow label="Phone" icon={<Phone className="w-4 h-4 text-slate-500" />} value={data?.phone ?? '—'} />
            </dl>
            <p className="text-xs text-slate-600 mt-2">
              Phone number cannot be changed. Visit a TechMo store if you need to update it.
            </p>
          </div>
        </div>
      )}

      {/* Consent Preferences */}
      {data?.id && <ConsentSection customerId={data.id} />}
    </div>
  );
}

function DetailRow({ label, icon, value }: { label: string; icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <dt className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
        <dd className="text-sm text-white">{value}</dd>
      </div>
    </div>
  );
}

const CONSENT_TYPES = [
  { type: 'MARKETING_SMS',      label: 'Marketing SMS',       description: 'Receive promotional offers via SMS' },
  { type: 'MARKETING_EMAIL',    label: 'Marketing Email',     description: 'Receive newsletters and offers by email' },
  { type: 'MARKETING_WHATSAPP', label: 'Marketing WhatsApp',  description: 'Receive offers via WhatsApp' },
  { type: 'DATA_ANALYTICS',     label: 'Usage Analytics',     description: 'Help us improve by sharing anonymised usage data' },
] as const;

function ConsentSection({ customerId }: { customerId: string }) {
  const { data: consents = [], refetch } = useQuery({
    queryKey: ['my-consents', customerId],
    queryFn: () => myConsentApi.getAll(customerId).then(r => r.data),
    enabled: !!customerId,
  });

  const mutation = useMutation({
    mutationFn: ({ type, granted }: { type: string; granted: boolean }) =>
      myConsentApi.record({ customerId, type: type as any, granted }),
    onSuccess: () => { refetch(); toast.success('Preference saved'); },
    onError:   () => toast.error('Failed to save preference'),
  });

  const isGranted = (type: string): boolean => {
    const c = (consents as any[]).find(c => c.type === type);
    return c?.granted ?? false;
  };

  return (
    <div className="mt-6 rounded-xl bg-slate-800/60 border border-slate-700/50 p-5">
      <h2 className="text-sm font-semibold text-white mb-4">Communication Preferences</h2>
      <div className="space-y-4">
        {CONSENT_TYPES.map(({ type, label, description }) => (
          <div key={type} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <button
              role="switch"
              aria-checked={isGranted(type)}
              onClick={() => mutation.mutate({ type, granted: !isGranted(type) })}
              disabled={mutation.isPending}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full',
                'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-800',
                isGranted(type) ? 'bg-primary' : 'bg-slate-700',
              )}
            >
              <span className={clsx(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow absolute top-0.5 left-0.5',
                'transition-transform duration-200 ease-in-out',
                isGranted(type) ? 'translate-x-[20px]' : 'translate-x-0',
              )} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 mt-4">
        You can change these preferences at any time. We will never share your data without consent.
      </p>
    </div>
  );
}
