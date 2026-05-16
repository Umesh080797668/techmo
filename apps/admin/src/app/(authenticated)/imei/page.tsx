'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Printer, Search, CheckCircle2, Hash, QrCode, ClipboardList, Plus, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import JsBarcode from 'jsbarcode';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { imeiApi, productsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useKeyboardWedgeScanner } from '@/lib/useKeyboardWedgeScanner';

const SerialPortReader = dynamic(() => import('@/components/SerialPortReader'), { ssr: false });
// ─── Single-device barcode popup ─────────────────────────────────────────────
function DeviceBarcodePopup({ value, label, onClose }: { value: string; label: string; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 11,
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch { /* skip invalid */ }
    }
  }, [value]);

  const print = () => {
    const svgHtml = svgRef.current?.outerHTML ?? '';
    const win = window.open('', '_blank', 'width=400,height=280');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Label</title>
      <style>* { margin:0; padding:0; box-sizing:border-box; }
      @page { size:38mm 25mm; margin:0; }
      body { font-family:monospace; width:38mm; }
      p { font-size:6pt; padding:1mm; font-weight:bold; }
      .bc { display:flex; justify-content:center; }
      .bc svg { max-width:36mm; }</style></head><body>
      <p>${label}: ${value}</p>
      <div class="bc">${svgHtml}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <div className="w-full flex items-center justify-between">
          <p className="text-xs text-slate-500 font-mono">{label}: <strong>{value}</strong></p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <svg ref={svgRef} style={{ maxWidth: '100%' }} />
        <button onClick={print} className="btn-primary text-sm w-full flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Print This Label</button>
      </div>
    </div>
  );
}


interface ImeiRecord {
  id: string;
  imei: string;
  serialNumber?: string;
  productId: string;
  orderId?: string;
  product?: { name: string; sku: string };
  warrantyStatus?: string;
  createdAt: string;
}

// ── modal modes ──────────────────────────────────────────────────────────────
type ModalMode = 'single' | 'bulk';

export default function ImeiPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('bulk');
  const [serialScanOpen, setSerialScanOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // single mode
  const [singleForm, setSingleForm] = useState({ imei: '', serialNumber: '', productId: '', orderId: '' });
  // Track which field is currently "active" for wedge scanner input in single mode
  const [singleActiveField, setSingleActiveField] = useState<'imei' | 'serialNumber' | null>('imei');

  // bulk mode
  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<{ registered: number; duplicates: number; errors: number } | null>(null);

  // lookup
  const [lookupImei, setLookupImei] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState('');

  // ── USB keyboard-wedge scanner for modal ──────────────────────────────────
  // When the registration modal is open, the wedge scanner fills the active IMEI/serial field.
  // In bulk mode it appends a new line to the textarea.
  useKeyboardWedgeScanner({
    onScan: (value) => {
      if (!showModal) return;
      const trimmed = value.trim();
      if (!trimmed) return;

      if (modalMode === 'single') {
        if (singleActiveField === 'imei') {
          setSingleForm(f => ({ ...f, imei: trimmed }));
          toast.success(`Scanned IMEI: ${trimmed}`);
        } else if (singleActiveField === 'serialNumber') {
          setSingleForm(f => ({ ...f, serialNumber: trimmed }));
          toast.success(`Scanned S/N: ${trimmed}`);
        }
      } else {
        // Bulk: append line
        setBulkText(prev => prev ? `${prev}\n${trimmed}` : trimmed);
        toast.success(`Scanned: ${trimmed}`);
      }
    },
    disabled: !showModal,
    minLength: 4,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['imei-list', search],
    queryFn: () => imeiApi.list({ search: search || undefined }).then((r) => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-mini'],
    queryFn: () => productsApi.list({ limit: 200 }).then((r) => r.data),
  });

  const singleMut = useMutation({
    mutationFn: (data: any) => imeiApi.register(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imei-list'] });
      toast.success('Device registered');
      setShowModal(false);
      setSingleForm({ imei: '', serialNumber: '', productId: '', orderId: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to register'),
  });

  const bulkMut = useMutation({
    mutationFn: (data: any) => imeiApi.bulkRegister(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['imei-list'] });
      const d = res.data;
      setBulkResult({ registered: d.registered, duplicates: d.duplicates, errors: d.errors });
      toast.success(`${d.registered} device${d.registered !== 1 ? 's' : ''} registered`);
      setBulkText('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Bulk registration failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (imei: string) => imeiApi.updateStatus(imei, 'SCRAPPED'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imei-list'] }),
  });

  const products: any[] = useMemo(
    () => productsData?.items ?? productsData?.data ?? [],
    [productsData],
  );

  // ── URL-driven product filter (from inventory "View Devices" links) ─────────
  const urlProductId = searchParams.get('productId') ?? '';
  const [productFilter, setProductFilter] = useState(urlProductId);
  const [barcodeRecord, setBarcodeRecord] = useState<ImeiRecord | null>(null);

  // Auto-open bulk modal AND set filter when arriving from inventory with ?productId=
  useEffect(() => {
    const pid = searchParams.get('productId');
    if (pid && products.length > 0) {
      setBulkProductId(pid);
      setProductFilter(pid);
      setModalMode('bulk');
      setShowModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, searchParams]);

  // derive if selected product needs IMEI vs serial
  const selectedSingleProduct = products.find((p) => p.id === singleForm.productId);
  const selectedBulkProduct = products.find((p) => p.id === bulkProductId);

  const bulkMode: 'imei' | 'serial' =
    selectedBulkProduct?.requiresImei ? 'imei' : 'serial';

  const bulkNumbers = useMemo(
    () => bulkText.split('\n').map((l) => l.trim()).filter(Boolean),
    [bulkText],
  );

  const handleLookup = async () => {
    if (!lookupImei.trim()) return;
    setLookupResult(null);
    setLookupError('');
    try {
      const res = await imeiApi.lookup(lookupImei.trim());
      setLookupResult(res.data);
    } catch {
      setLookupError('Not found in registry.');
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { imei: singleForm.imei.trim(), productId: singleForm.productId };
    if (singleForm.serialNumber.trim()) payload.serialNumber = singleForm.serialNumber.trim();
    if (singleForm.orderId.trim()) payload.orderId = singleForm.orderId.trim();
    singleMut.mutate(payload);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkProductId) { toast.error('Select a product first'); return; }
    if (bulkNumbers.length === 0) { toast.error('Enter at least one number'); return; }
    setBulkResult(null);
    bulkMut.mutate({ productId: bulkProductId, numbers: bulkNumbers, mode: bulkMode });
  };

  const allRecords: ImeiRecord[] = Array.isArray(listData) ? listData : (listData?.data ?? []);
  // Apply product filter when navigating from inventory
  const records: ImeiRecord[] = productFilter
    ? allRecords.filter(r => r.productId === productFilter)
    : allRecords;
  const filteredProduct = productFilter ? products.find(p => p.id === productFilter) : null;

  const warrantyBadge = (status?: string) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      VALID:    'bg-green-100 text-green-700',
      EXPIRED:  'bg-red-100 text-red-700',
      CLAIMED:  'bg-yellow-100 text-yellow-700',
      VOIDED:   'bg-gray-100 text-gray-500',
      NO_WARRANTY: 'bg-gray-100 text-gray-400',
    };
    const labels: Record<string, string> = {
      VALID:    'Valid',
      EXPIRED:  'Expired',
      CLAIMED:  'Claimed',
      VOIDED:   'Voided',
      NO_WARRANTY: 'No Warranty',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  // helper: label for a product
  const unitLabel = (p: any | undefined) =>
    p?.requiresImei ? 'IMEI' : 'Serial Number';

  const closeModal = () => {
    setShowModal(false);
    setBulkResult(null);
    setBulkText('');
    setBulkProductId('');
    setSingleForm({ imei: '', serialNumber: '', productId: '', orderId: '' });
    setSingleActiveField('imei');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">IMEI &amp; Serial Registry</h1>
          <p className="page-subtitle">Register IMEIs for smartphones · Serial numbers for other trackable equipment</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSerialScanOpen(s => !s)}
            className="btn-secondary flex items-center gap-2 text-sm">
            <QrCode className="w-4 h-4" /> USB Scan
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary">
            + Register Devices
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How IMEI / Serial tracking works</p>
        <ul className="list-disc ml-5 space-y-0.5 text-blue-700">
          <li><strong>Smartphones</strong> — have a 15-digit IMEI. Enable <em>requiresImei</em> on the product.</li>
          <li><strong>Other equipment</strong> (laptops, TVs, accessories) — use a manufacturer Serial Number. Enable <em>requiresSerial</em>.</li>
          <li><strong>Accessories / consumables</strong> — no individual tracking needed; leave both flags off.</li>
          <li>When you receive a batch (e.g. 20 phones), use <strong>Bulk Register</strong> — paste all 20 IMEIs at once (one per line).</li>
          <li>Warranty period starts from the <strong>sale date</strong> and runs for the <strong>Warranty Months</strong> set on the product.</li>
        </ul>
      </div>

      {/* USB Serial Reader — Web Serial API */}
      {serialScanOpen && (
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><QrCode className="w-4 h-4" /> USB / Serial Scanner</h2>
            <button onClick={() => setSerialScanOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
          </div>
          <p className="text-sm text-slate-500">
            Connect a USB barcode scanner or IMEI reader. Each scanned line is automatically
            detected and can be pasted into the Bulk Register form above.
          </p>
          <SerialPortReader
            deviceLabel="USB IMEI / Barcode Scanner"
            baudRate={9600}
            onData={(msg) => {
              const raw = msg.raw.trim();
              if (raw.length >= 8) {
                // If single mode is open, fill IMEI field
                setSingleForm(f => ({ ...f, imei: raw }));
                toast.success(`Scanned: ${raw}`);
              }
            }}
          />
        </div>
      )}

      {/* Quick Lookup */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Search className="w-5 h-5" /> Quick Lookup</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={lookupImei}
            onChange={(e) => setLookupImei(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="Enter IMEI or serial number…"
            className="input flex-1"
          />
          <button
            onClick={handleLookup}
            disabled={!lookupImei.trim()}
            className="btn-secondary shrink-0"
          >
            Lookup
          </button>
        </div>
        {lookupError && <p className="text-red-500 text-sm mt-2">{lookupError}</p>}
        {lookupResult && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-900 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Found</span>
              {warrantyBadge(lookupResult.warrantyStatus)}
              <span className="ml-auto text-gray-500 font-mono text-xs">{lookupResult.status}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
              {lookupResult.imei !== lookupResult.serialNumber && (
                <div><span className="text-gray-500">IMEI:</span> <span className="font-mono">{lookupResult.imei}</span></div>
              )}
              {lookupResult.serialNumber && (
                <div><span className="text-gray-500">S/N:</span> <span className="font-mono">{lookupResult.serialNumber}</span></div>
              )}
              <div><span className="text-gray-500">Product:</span> {lookupResult.product?.name ?? lookupResult.productId}</div>
              <div><span className="text-gray-500">SKU:</span> {lookupResult.product?.sku ?? '—'}</div>
              {lookupResult.orderId && <div><span className="text-gray-500">Sold in order:</span> {lookupResult.orderId.slice(0, 8)}…</div>}
              <div><span className="text-gray-500">Registered:</span> {new Date(lookupResult.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3 flex-wrap">
          {filteredProduct && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-blue-800 font-medium">
              <Search className="w-3.5 h-3.5" />
              <span>Showing devices for: <strong>{filteredProduct.name}</strong> ({filteredProduct.sku})</span>
              <button
                onClick={() => setProductFilter('')}
                className="ml-2 text-blue-400 hover:text-blue-700 font-bold text-base leading-none"
                title="Show all devices"
              >
                ×
              </button>
            </div>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IMEI, serial, product…"
            className="input flex-1 sm:max-w-sm"
          />
          <span className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? 's' : ''}{productFilter && allRecords.length !== records.length ? ` (of ${allRecords.length} total)` : ''}</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Hash className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>No records yet. Register your first batch of devices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">IMEI / S/N</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Warranty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {/* If imei === serialNumber, it's a serial-only device */}
                    {rec.imei === rec.serialNumber ? (
                      <span><span className="text-gray-400 text-xs mr-1">S/N</span>{rec.serialNumber}</span>
                    ) : (
                      <div>
                        <div>{rec.imei}</div>
                        {rec.serialNumber && <div className="text-gray-400"><span className="text-xs mr-1">S/N</span>{rec.serialNumber}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{rec.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{rec.product?.sku ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      (rec as any).status === 'SOLD' ? 'bg-blue-100 text-blue-700' :
                      (rec as any).status === 'SCRAPPED' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>{(rec as any).status ?? 'IN_STOCK'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {rec.warrantyStatus
                      ? warrantyBadge(rec.warrantyStatus)
                      : (rec as any).status === 'SOLD'
                        ? <span className="text-xs text-gray-400 italic">Checking…</span>
                        : (rec as any).product?.warrantyMonths > 0
                          ? <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{(rec as any).product.warrantyMonths}mo from sale</span>
                          : <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">No warranty</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(rec.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBarcodeRecord(rec)}
                        title="View barcode"
                        className="text-slate-400 hover:text-indigo-600 text-base transition-colors flex items-center"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Remove from Registry',
                          message: `Remove ${rec.imei} from the IMEI registry? This cannot be undone.`,
                          onConfirm: () => { deleteMut.mutate(rec.imei); setConfirmDialog(d => ({ ...d, open: false })); },
                        })}
                        className="text-red-500 hover:underline text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Register Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h2 className="modal-title">Register Devices</h2>
              <button onClick={closeModal} className="btn-icon text-base">✕</button>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b">
              {(['bulk', 'single'] as ModalMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModalMode(m)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    modalMode === m
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'bulk' ? <><ClipboardList className="w-4 h-4 mr-1.5 inline" />Bulk Register (Recommended)</> : <><Plus className="w-4 h-4 mr-1.5 inline" />Single Register</>}
                </button>
              ))}
            </div>

            {/* ── BULK MODE ── */}
            {modalMode === 'bulk' && (
              <form onSubmit={handleBulkSubmit}>
                <div className="modal-body space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    Use this when you receive a shipment. Select the product, then paste all IMEI/serial numbers — one per line.
                  </div>

                  {/* Wedge scanner hint */}
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    <QrCode className="w-4 h-4 flex-shrink-0" />
                    <span>
                      <strong>USB / Bluetooth Scanner:</strong> select the product above, then scan each device one-by-one —
                      each scan automatically appends a new line below.
                    </span>
                  </div>

                  <div>
                    <label className="label">Product *</label>
                    <select
                      required
                      value={bulkProductId}
                      onChange={(e) => { setBulkProductId(e.target.value); setBulkResult(null); }}
                      className="input"
                    >
                      <option value="">— Select Product —</option>
                      {products
                        .filter((p: any) => p.requiresImei || p.requiresSerial)
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — {p.requiresImei ? 'IMEI' : 'Serial'}
                          </option>
                        ))}
                    </select>
                    {selectedBulkProduct && (
                      <p className="text-xs text-gray-500 mt-1">
                        This product uses <strong>{unitLabel(selectedBulkProduct)}</strong> tracking.
                        {selectedBulkProduct.warrantyMonths > 0
                          ? ` Warranty: ${selectedBulkProduct.warrantyMonths} months from sale date.`
                          : ' No warranty set.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label">
                      {unitLabel(selectedBulkProduct)} Numbers *
                      {bulkNumbers.length > 0 && (
                        <span className="ml-2 text-blue-600 font-normal">{bulkNumbers.length} entered</span>
                      )}
                    </label>
                    <textarea
                      rows={8}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`Paste ${unitLabel(selectedBulkProduct)} numbers here, one per line:\n352999111234567\n352999111234568\n352999111234569\n...`}
                      className="input font-mono resize-y"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      You can paste directly from Excel / Notepad. Empty lines are ignored.
                    </p>
                  </div>

                  {/* Result summary */}
                  {bulkResult && (
                    <div className={`rounded-lg p-3 text-sm ${bulkResult.errors > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      <p className="font-semibold text-green-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {bulkResult.registered} registered</p>
                      {bulkResult.duplicates > 0 && (
                        <p className="text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {bulkResult.duplicates} already existed (skipped)</p>
                      )}
                      {bulkResult.errors > 0 && (
                        <p className="text-red-700 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> {bulkResult.errors} failed</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-ft">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={bulkMut.isPending || !bulkProductId || bulkNumbers.length === 0}
                    className="btn-primary flex-1"
                  >
                    {bulkMut.isPending ? 'Registering…' : `Register ${bulkNumbers.length > 0 ? bulkNumbers.length : ''} Device${bulkNumbers.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            )}

            {/* ── SINGLE MODE ── */}
            {modalMode === 'single' && (
              <form onSubmit={handleSingleSubmit}>
                <div className="modal-body space-y-4">
                  {/* Wedge scanner hint */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
                    <QrCode className="w-4 h-4 flex-shrink-0" />
                    <span>
                      <strong>USB Scanner:</strong> click the IMEI or Serial field first, then scan.
                      The scanner will fill the focused field automatically.
                    </span>
                  </div>

                  <div>
                    <label className="label">Product *</label>
                    <select
                      required
                      value={singleForm.productId}
                      onChange={(e) => setSingleForm((f) => ({ ...f, productId: e.target.value }))}
                      className="input"
                    >
                      <option value="">— Select Product —</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      {unitLabel(selectedSingleProduct) ?? 'IMEI'} *
                    </label>
                    <div className="relative">
                      <input
                        required
                        value={singleForm.imei}
                        onChange={(e) => setSingleForm((f) => ({ ...f, imei: e.target.value }))}
                        onFocus={() => setSingleActiveField('imei')}
                        placeholder={selectedSingleProduct?.requiresImei ? '15-digit IMEI (e.g. 352999…)' : 'Serial number'}
                        className={`input font-mono pr-20 ${
                          singleActiveField === 'imei' ? 'ring-2 ring-blue-400 border-blue-400' : ''
                        }`}
                      />
                      {singleActiveField === 'imei' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium pointer-events-none">
                          active
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedSingleProduct?.requiresImei && (
                    <div>
                      <label className="label">Serial Number (optional)</label>
                      <div className="relative">
                        <input
                          value={singleForm.serialNumber}
                          onChange={(e) => setSingleForm((f) => ({ ...f, serialNumber: e.target.value }))}
                          onFocus={() => setSingleActiveField('serialNumber')}
                          placeholder="Manufacturer S/N if available"
                          className={`input font-mono pr-20 ${
                            singleActiveField === 'serialNumber' ? 'ring-2 ring-blue-400 border-blue-400' : ''
                          }`}
                        />
                        {singleActiveField === 'serialNumber' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium pointer-events-none">
                            active
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label">Order ID (optional)</label>
                    <input
                      value={singleForm.orderId}
                      onChange={(e) => setSingleForm((f) => ({ ...f, orderId: e.target.value }))}
                      onFocus={() => setSingleActiveField(null)}
                      placeholder="Link to a sale order"
                      className="input"
                    />
                  </div>
                </div>
                <div className="modal-ft">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={singleMut.isPending}
                    className="btn-primary flex-1"
                  >
                    {singleMut.isPending ? 'Registering…' : 'Register'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />

      {/* 🔲 Per-device barcode popup */}
      {barcodeRecord && (
        <DeviceBarcodePopup
          value={barcodeRecord.imei || barcodeRecord.serialNumber || ''}
          label={barcodeRecord.imei !== barcodeRecord.serialNumber ? 'IMEI' : 'S/N'}
          onClose={() => setBarcodeRecord(null)}
        />
      )}
    </div>
  );
}
