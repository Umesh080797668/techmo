'use client';

/**
 * PasskeyManager — Admin UI component for WebAuthn / Passkey management.
 *
 * Renders in Admin → Settings → Security tab.
 * Allows managers to:
 *   - Register a new passkey (biometric on their device)
 *   - List existing passkeys
 *   - Revoke a passkey
 *   - Use passkey instead of manager PIN for sensitive actions
 */

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Lock, Smartphone, Key, Shield, RefreshCw, Fingerprint } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PasskeyRecord {
  id:         string;
  deviceType: string;
  createdAt:  string;
  lastUsed?:  string;
}

interface PasskeyManagerProps {
  /** The currently authenticated staff userId */
  userId:   string;
  username: string;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PasskeyManager({ userId, username, className = '' }: PasskeyManagerProps) {
  const [passkeys, setPasskeys]       = useState<PasskeyRecord[]>([]);
  const [loading, setLoading]         = useState(false);
  const [status, setStatus]           = useState<string | null>(null);
  const [statusType, setStatusType]   = useState<'success' | 'error' | 'info'>('info');

  const showStatus = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatus(msg);
    setStatusType(type);
    setTimeout(() => setStatus(null), 4000);
  };

  // ── Load passkeys ─────────────────────────────────────────────────────────

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await api.get(`/auth/webauthn/credentials/${userId}`);
      setPasskeys(res.data ?? []);
    } catch {
      /* silently ignore */
    }
  }, [userId]);

  useEffect(() => { loadPasskeys(); }, [loadPasskeys]);

  // ── Register passkey ──────────────────────────────────────────────────────

  const registerPasskey = async () => {
    if (!window.PublicKeyCredential) {
      showStatus('WebAuthn is not supported in this browser.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Get registration options from gateway
      const optRes = await api.post('/auth/webauthn/register/options');
      const options = optRes.data;

      // 2. Convert base64url fields to ArrayBuffer for browser API
      options.challenge = base64urlToBuffer(options.challenge);
      options.user.id   = base64urlToBuffer(options.user.id);
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map((c: { id: string }) => ({
          ...c, id: base64urlToBuffer(c.id),
        }));
      }

      // 3. Create credential on device (triggers biometric prompt)
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
      const response   = credential.response as AuthenticatorAttestationResponse;

      // 4. Send attestation to gateway for verification
      const verifyRes = await api.post('/auth/webauthn/register/verify', {
        userId,
        response: {
          id:       credential.id,
          rawId:    bufferToBase64url(credential.rawId),
          type:     credential.type,
          response: {
            clientDataJSON:    bufferToBase64url(response.clientDataJSON),
            attestationObject: bufferToBase64url(response.attestationObject),
            transports:        response.getTransports?.() ?? [],
          },
        },
      });

      if (verifyRes.status !== 200 && verifyRes.status !== 201) throw new Error('Verification failed');

      showStatus('Passkey registered! You can now use biometrics for manager actions.', 'success');
      await loadPasskeys();
    } catch (err) {
      if ((err as Error).name === 'NotAllowedError') {
        showStatus('Biometric prompt was cancelled or timed out.', 'error');
      } else {
        showStatus(`Registration failed: ${(err as Error).message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Revoke passkey ────────────────────────────────────────────────────────

  const revokePasskey = async (credentialId: string) => {
    if (!confirm('Remove this passkey? This cannot be undone.')) return;
    try {
      await api.delete(`/auth/webauthn/credentials/${credentialId}`);
      showStatus('Passkey removed.', 'info');
      await loadPasskeys();
    } catch {
      showStatus('Failed to remove passkey.', 'error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const DeviceIcon = ({ type }: { type: string }) => {
    const isDeviceBound = type.includes('platform') || type.includes('singleDevice');
    return isDeviceBound
      ? <Smartphone className="w-4 h-4 text-zinc-400" />
      : <Key className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className={`rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2"><Lock className="w-4 h-4 text-indigo-400" /> Passkeys / Biometric Auth</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Use Touch ID, Face ID, or Windows Hello instead of typing your manager PIN.
          </p>
        </div>
        <button
          onClick={registerPasskey}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                     text-white text-sm font-medium transition-colors"
        >
          {loading ? 'Activating…' : '+ Add Passkey'}
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`rounded-lg px-3 py-2 text-sm
            ${statusType === 'success' ? 'bg-green-900/40 text-green-400 border border-green-800' : ''}
            ${statusType === 'error'   ? 'bg-red-900/40   text-red-400   border border-red-800'   : ''}
            ${statusType === 'info'    ? 'bg-zinc-800     text-zinc-400  border border-zinc-700'   : ''}
          `}
        >
          {status}
        </div>
      )}

      {/* Passkey list */}
      {passkeys.length === 0 ? (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-4 py-8 text-center">
          <p className="text-zinc-500 text-sm">No passkeys registered yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Click "+ Add Passkey" to register your device biometrics.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <DeviceIcon type={pk.deviceType} />
                </div>
                <div>
                  <p className="text-sm text-white font-medium capitalize">{pk.deviceType}</p>
                  <p className="text-xs text-zinc-500">
                    Added {new Date(pk.createdAt).toLocaleDateString('en-GB')}
                    {pk.lastUsed && ` · Last used ${new Date(pk.lastUsed).toLocaleDateString('en-GB')}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => revokePasskey(pk.id)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-950/30"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Info footer */}
      <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-xs text-zinc-500 space-y-1.5">
        <p className="flex items-start gap-2"><Shield className="w-3 h-3 text-zinc-400 flex-shrink-0 mt-0.5" /> Passkeys are <strong className="text-zinc-300">phishing-resistant</strong> — private keys never leave your device.</p>
        <p className="flex items-start gap-2"><Smartphone className="w-3 h-3 text-zinc-400 flex-shrink-0 mt-0.5" /> Passkeys registered on iOS sync via <strong className="text-zinc-300">iCloud Keychain</strong>; Android via <strong className="text-zinc-300">Google Password Manager</strong>.</p>
        <p className="flex items-start gap-2"><RefreshCw className="w-3 h-3 text-zinc-400 flex-shrink-0 mt-0.5" /> Passkeys augment (not replace) manager PIN — both methods remain available.</p>
      </div>
    </div>
  );
}
