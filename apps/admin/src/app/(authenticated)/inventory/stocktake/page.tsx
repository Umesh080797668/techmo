'use client';
import StocktakeScanner from '@/components/StocktakeScanner';
import { useAuth } from '@/contexts/AuthContext';

export default function StocktakePage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background p-4">
      <StocktakeScanner
        branchId={(user as any)?.branchId ?? 'default'}
        staffId={user?.id ?? 'unknown'}
      />
    </div>
  );
}
