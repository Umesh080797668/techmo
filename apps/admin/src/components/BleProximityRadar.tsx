'use client';
/**
 * BleProximityRadar.tsx
 * ----------------------
 * Web Bluetooth "Find My Part" — scans for nearby BLE beacons (iBeacon / Eddystone)
 * and shows a proximity radar to help staff locate high-value bins in a large warehouse.
 *
 * Uses cheap BLE beacons (~$3–$5 each, e.g. Feasycom / Minew S1) tagged to
 * storage bins / shelves. No gateway or hub required — the browser reads directly.
 *
 * Browser support: Chrome 56+, Edge 79+, Opera 43+  (HTTPS required)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Radio } from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name?: string;
  uuids?: string[];
  watchAdvertisements?: () => Promise<void>;
  addEventListener: (type: string, listener: (e: Event) => void) => void;
}

interface BluetoothAdvertisingEvent extends Event {
  rssi?: number;
}

export interface BeaconDevice {
  id: string;
  name: string;
  rssi: number;           // dBm signal strength
  distance: 'near' | 'medium' | 'far' | 'unknown';
  distanceM: number;      // estimated metres
  lastSeen: Date;
  binLabel?: string;      // mapped from beacon name
  uuids?: string[];
}

export interface Props {
  /** Mapping from BLE device name → bin label */
  binMap?: Record<string, string>;
  /** Filter: only show beacons whose name starts with this prefix */
  namePrefix?: string;
  onSelect?: (beacon: BeaconDevice) => void;
}

function rssiToDistance(rssi: number, txPower = -59): number {
  if (rssi === 0) return -1;
  const ratio = rssi / txPower;
  if (ratio < 1.0) return Math.pow(ratio, 10);
  return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
}

function distanceLabel(m: number): BeaconDevice['distance'] {
  if (m < 0)   return 'unknown';
  if (m < 0.5) return 'near';
  if (m < 3)   return 'medium';
  return 'far';
}

const DISTANCE_COLORS: Record<BeaconDevice['distance'], string> = {
  near:    'text-green-400',
  medium:  'text-amber-400',
  far:     'text-red-400',
  unknown: 'text-gray-500',
};
const DISTANCE_PULSE: Record<BeaconDevice['distance'], string> = {
  near:    'bg-green-500',
  medium:  'bg-amber-500',
  far:     'bg-red-500',
  unknown: 'bg-gray-600',
};

export default function BleProximityRadar({ binMap = {}, namePrefix = '', onSelect }: Props) {
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const [beacons, setBeacons] = useState<Map<string, BeaconDevice>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateBeacon = useCallback((device: BluetoothDevice, rssi: number) => {
    setBeacons(prev => {
      const map = new Map(prev);
      const distM = rssiToDistance(rssi);
      map.set(device.id, {
        id:       device.id,
        name:     device.name ?? 'Unknown',
        rssi,
        distance: distanceLabel(distM),
        distanceM: Math.max(0, +distM.toFixed(1)),
        lastSeen: new Date(),
        binLabel: device.name ? (binMap[device.name] ?? device.name) : undefined,
        uuids:    device.uuids,
      });
      return map;
    });
  }, [binMap]);

  async function scan() {
    if (!supported) return;
    setError('');
    setScanning(true);

    try {
      const filters = namePrefix
        ? [{ namePrefix }]
        : [{ services: ['battery_service'] }, { namePrefix: 'TechMo' }];

      const device = await (navigator as Navigator & {
        bluetooth: {
          requestDevice: (opts: object) => Promise<BluetoothDevice & { rssi?: number }>;
        };
      }).bluetooth.requestDevice({
        filters,
        optionalServices: ['battery_service', '0000180f-0000-1000-8000-00805f9b34fb'],
        // acceptAllDevices: true  // uncomment to see ALL nearby BLE devices
      });

      // Chrome only exposes RSSI through advertisement events (Web Bluetooth watchAdvertisements)
      if ('watchAdvertisements' in device) {
        await (device as BluetoothDevice & { watchAdvertisements: () => Promise<void> }).watchAdvertisements();
        device.addEventListener('advertisementreceived', (e: Event) => {
          const ev = e as BluetoothAdvertisingEvent;
          updateBeacon(device, ev.rssi ?? -80);
        });
      } else {
        // Fallback — device selected but no RSSI stream
        updateBeacon(device, -70);
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'NotFoundError') {
        setError((e as Error).message ?? 'Bluetooth error');
      }
    } finally {
      setScanning(false);
    }
  }

  // Prune stale beacons (not seen in 30 s)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setBeacons(prev => {
        const map = new Map(prev);
        const cutoff = Date.now() - 30_000;
        for (const [id, b] of map) {
          if (b.lastSeen.getTime() < cutoff) map.delete(id);
        }
        return map;
      });
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const sorted = [...beacons.values()].sort((a, b) => b.rssi - a.rssi);

  if (!supported) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-3 text-sm text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        Web Bluetooth not available. Use Chrome or Edge over HTTPS for BLE proximity scanning.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><Radio className="w-4 h-4" /> BLE Proximity Radar</h3>
        <button
          onClick={scan}
          disabled={scanning}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {scanning ? 'Scanning…' : '+ Add Beacon'}
        </button>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      {sorted.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No beacons detected. Click "Add Beacon" to scan for nearby BLE devices.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect?.(b)}
              className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition text-left"
            >
              {/* Pulse dot */}
              <span className="relative flex h-3 w-3">
                {b.distance === 'near' && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${DISTANCE_PULSE[b.distance]} opacity-75`} />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${DISTANCE_PULSE[b.distance]}`} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{b.binLabel}</div>
                <div className="text-xs text-gray-400">{b.id.slice(0, 12)}…</div>
              </div>

              <div className={`text-right text-sm font-mono ${DISTANCE_COLORS[b.distance]}`}>
                <div>{b.distanceM} m</div>
                <div className="text-xs">{b.rssi} dBm</div>
              </div>

              <div className={`text-xs px-2 py-0.5 rounded-full ${
                b.distance === 'near'   ? 'bg-green-900/50 text-green-300' :
                b.distance === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                'bg-red-900/50 text-red-300'
              }`}>
                {b.distance}
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Attach cheap BLE beacons (Feasycom / Minew S1) to storage bins.
        Signal updates every ~5 s.
      </p>
    </div>
  );
}
