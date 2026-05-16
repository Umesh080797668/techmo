'use client';
/**
 * useOnlineStatus
 * ---------------
 * Reactive hook that mirrors the browser's online/offline state.
 * Returns `true` when the network is available, `false` when offline.
 *
 * Uses the Window `online` / `offline` events which fire whenever the
 * browser transitions between the two states.
 */

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    function handleOnline()  { setOnline(true);  }
    function handleOffline() { setOnline(false); }

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
