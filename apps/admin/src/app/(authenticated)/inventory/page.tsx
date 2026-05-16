'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import JsBarcode from 'jsbarcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, productsApi, imeiApi, fetchUserMap } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Tag, Package, Loader2, Smartphone, Hash, Printer, Barcode, Pin, ArrowLeftRight } from 'lucide-react';

const ThermalLabel = dynamic(() => import('@/components/ThermalLabel'), { ssr: false });

// ─── Per-Device Barcode label card (one IMEI/serial = one barcode) ─────────────────────────
// Isolated component so each device renders its own JsBarcode SVG independently.
function DeviceLabelCard({
  device,
  productName,
  price,
  isImei,
  onRendered,
}: {
  device: any;
  productName: string;
  price?: number;
  isImei: boolean;
  onRendered: (id: string, svgHtml: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcodeValue: string = device.imei || device.serialNumber || '';
  const label = isImei ? 'IMEI' : 'S/N';

  useEffect(() => {
    if (svgRef.current && barcodeValue) {
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.4,
          height: 36,
          displayValue: true,
          fontSize: 9,
          margin: 3,
          background: '#ffffff',
          lineColor: '#000000',
        });
        onRendered(device.id ?? barcodeValue, svgRef.current.outerHTML);
      } catch { /* invalid value — skip */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeValue]);

  const printSingle = () => {
    const svgHtml = svgRef.current?.outerHTML ?? '';
    const win = window.open('', '_blank', 'width=420,height=280');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Label</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        @page { size:38mm 25mm; margin:0; }
        body { width:38mm; font-family:monospace; }
        .name { font-size:6pt; font-weight:bold; padding:1mm 1mm 0; }
        .id   { font-size:5pt; padding:0 1mm; color:#555; }
        .bc   { display:flex; justify-content:center; }
        .bc svg { max-width:36mm; }
        .price{ font-size:7pt; font-weight:bold; text-align:right; padding:0 1mm; }
      </style></head><body>
      <p class="name">${productName}</p>
      <p class="id">${label}: ${barcodeValue}</p>
      <div class="bc">${svgHtml}</div>
      ${price ? `<p class="price">LKR ${Number(price).toLocaleString()}</p>` : ''}
      <script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script>
      </body></html>`);
    win.document.close();
  };

  const statusColors: Record<string, string> = {
    SOLD: 'bg-blue-100 text-blue-700',
    SCRAPPED: 'bg-red-100 text-red-700',
    IN_STOCK: 'bg-green-100 text-green-700',
    RETURNED: 'bg-amber-100 text-amber-700',
  };
  const status: string = device.status ?? 'IN_STOCK';

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[status] ?? 'bg-gray-100 text-gray-600'}`}>
          {status}
        </span>
        <button onClick={printSingle} className="text-[11px] text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded px-1.5 py-0.5 transition-all flex items-center gap-1">
          <Printer className="w-3 h-3" /> Print
        </button>
      </div>
      <p className="text-[11px] text-slate-500 font-mono truncate">
        <span className="text-slate-400">{label}: </span>{barcodeValue}
      </p>
      <div className="flex justify-center bg-white rounded overflow-hidden">
        <svg ref={svgRef} style={{ maxWidth: '100%' }} />
      </div>
    </div>
  );
}

// ─── Per-Device Labels Modal ───────────────────────────────────────────────────────────
function DeviceLabelsModal({
  item,
  productsMap,
  onClose,
}: {
  item: any;
  productsMap: Record<string, any>;
  onClose: () => void;
}) {
  const prod = item.product ?? productsMap[item.productId];
  const productName = prod?.name ?? item.sku;
  const price: number | undefined = prod?.sellingPrice ? Number(prod.sellingPrice) : undefined;
  const isImei = !!(prod?.requiresImei);

  const svgCache = useRef<Map<string, string>>(new Map());
  const handleRendered = (id: string, svgHtml: string) => {
    svgCache.current.set(id, svgHtml);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['imei-devices', item.productId],
    queryFn: () => imeiApi.getByProduct(item.productId).then(r => r.data),
  });
  const devices: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const inStock = devices.filter(d => !d.status || d.status === 'IN_STOCK');

  const printAll = (devList: any[]) => {
    const rows = devList.map(d => {
      const val = d.imei || d.serialNumber || '';
      const svg = svgCache.current.get(d.id ?? val) ?? '';
      return `
        <div class="label">
          <p class="name">${productName}</p>
          <p class="id">${isImei ? 'IMEI' : 'S/N'}: ${val}</p>
          <div class="bc">${svg}</div>
          ${price ? `<p class="price">LKR ${price.toLocaleString()}</p>` : ''}
        </div>`;
    }).join('');
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Device Labels</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        @page { size:38mm 25mm; margin:0; }
        body { font-family:monospace; background:#fff; }
        .label { width:38mm; height:25mm; overflow:hidden; display:inline-flex; flex-direction:column;
                 border:0.5pt solid #ccc; page-break-inside:avoid; break-inside:avoid; }
        .name  { font-size:6pt; font-weight:bold; padding:1mm 1mm 0; white-space:nowrap; overflow:hidden; }
        .id    { font-size:5pt; padding:0 1mm; color:#555; }
        .bc    { display:flex; justify-content:center; flex:1; }
        .bc svg{ max-width:36mm; max-height:14mm; }
        .price { font-size:7pt; font-weight:bold; text-align:right; padding:0 1mm; }
      </style></head><body>
      ${rows}
      <script>window.onload=()=>setTimeout(()=>window.print(),400);<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-start gap-3 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex-1">
            <h3 className="modal-title flex items-center gap-2"><Tag className="w-5 h-5 text-slate-500" /> Per-Device Labels</h3>
            <p className="text-sm text-slate-500 mt-0.5">{productName} &middot; {item.sku}</p>
            {!isLoading && (
              <p className="text-xs text-slate-400 mt-0.5">
                {devices.length} registered &middot; <span className="text-green-600 font-medium">{inStock.length} in stock</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {inStock.length > 0 && (
              <button
                onClick={() => printAll(inStock)}
                className="btn-secondary text-xs flex items-center gap-1">
                <Printer className="w-3 h-3" /> Print In-Stock ({inStock.length})
              </button>
            )}
            {devices.length > 0 && (
              <button
                onClick={() => printAll(devices)}
                className="btn-primary text-xs flex items-center gap-1">
                <Printer className="w-3 h-3" /> Print All ({devices.length})
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-7 h-7 flex items-center justify-center">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading && (
            <div className="text-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
              <p>Loading registered devices…</p>
            </div>
          )}
          {!isLoading && devices.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium">No devices registered for this product yet.</p>
              <a
                href={`/imei?productId=${item.productId}`}
                className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                Register devices in IMEI / Serial Registry →
              </a>
            </div>
          )}
          {!isLoading && devices.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {devices.map(d => (
                <DeviceLabelCard
                  key={d.id ?? d.imei}
                  device={d}
                  productName={productName}
                  price={price}
                  isImei={isImei}
                  onRendered={handleRendered}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


interface AdjustForm {
  quantity: number;
  movementType: string;
  reference: string;
  notes: string;
}

function AdjustModal({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<AdjustForm>();

  const mutation = useMutation({
    mutationFn: (data: AdjustForm) =>
      inventoryApi.adjustStock(item.id, { ...data, quantity: Number(data.quantity) }),
    onSuccess: () => {
      toast.success('Stock adjusted');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to adjust stock'),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3 className="modal-title">Adjust Stock — {item.sku}</h3>
          <button onClick={onClose} className="btn-icon">×</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="modal-body space-y-4">
            <p className="text-sm text-slate-500">
              Current quantity: <strong>{item.quantity}</strong>
            </p>
            <div>
              <label className="label">Adjustment Quantity (+ to add, - to remove)</label>
              <input type="number" className={`input ${errors.quantity ? 'border-red-300' : ''}`}
                placeholder="e.g. 10 or -5"
                {...register('quantity', { required: true, valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Movement Type</label>
              <select className="input" {...register('movementType', { required: true })}>
                <option value="PURCHASE_IN">Purchase (stock in)</option>
                <option value="RETURN_IN">Customer Return</option>
                <option value="ADJUSTMENT">Manual Adjustment</option>
                <option value="DAMAGE_LOSS">Damage / Write-off</option>
                <option value="TRANSFER">Transfer</option>
                <option value="INITIAL_STOCK">Initial Stock</option>
              </select>
            </div>
            <div>
              <label className="label">Reference (optional)</label>
              <input type="text" className="input" placeholder="PO number, etc."
                {...register('reference')} />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea rows={2} className="input resize-none" {...register('notes')} />
            </div>
          </div>
          <div className="modal-ft">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Saving…' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Inventory Modal ────────────────────────────────────────────────────
interface AddInvForm {
  productId: string;
  sku: string;
  quantity: number;
  lowStockQty: number;
  location: string;
}

function AddInventoryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AddInvForm>({
    defaultValues: { quantity: 1, lowStockQty: 5 },
  });

  const { data: prodData } = useQuery({
    queryKey: ['products-for-inv'],
    queryFn: () => productsApi.list({ limit: 200 }).then(r => r.data),
  });
  const products: any[] = prodData?.items ?? prodData?.data ?? [];

  const mutation = useMutation({
    mutationFn: (data: AddInvForm) =>
      inventoryApi.create({
        productId: data.productId,
        sku: data.sku,
        quantity: Number(data.quantity),
        lowStockQty: Number(data.lowStockQty),
        location: data.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Inventory record created');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to create inventory record'),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3 className="modal-title">Add to Inventory</h3>
          <button type="button" onClick={onClose} className="btn-icon">×</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="modal-body space-y-4">
          <div>
            <label className="label">Product</label>
            <select
              className={`input ${errors.productId ? 'border-red-300' : ''}`}
              {...register('productId', { required: true })}
              onChange={e => {
                const prod = products.find((p: any) => p.id === e.target.value);
                if (prod?.sku) setValue('sku', prod.sku);
              }}
            >
              <option value="">— Select product —</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku ?? p.id.slice(0, 8)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">SKU</label>
            <input
              type="text"
              className={`input ${errors.sku ? 'border-red-300' : ''}`}
              placeholder="e.g. SAM-S25U-256"
              {...register('sku', { required: true })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Initial Quantity</label>
              <input
                type="number"
                className={`input ${errors.quantity ? 'border-red-300' : ''}`}
                {...register('quantity', { required: true, min: 0, valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label">Low-Stock Threshold</label>
              <input
                type="number"
                className="input"
                {...register('lowStockQty', { min: 0, valueAsNumber: true })}
              />
            </div>
          </div>
          <div>
            <label className="label">Location (optional)</label>
            <input type="text" className="input" placeholder="e.g. Shelf A3" {...register('location')} />
          </div>
          </div>
          <div className="modal-ft">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Saving…' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [labelItem, setLabelItem]      = useState<any>(null);
  const [deviceLabelsItem, setDeviceLabelsItem] = useState<any>(null);
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');
  const [movSearch, setMovSearch] = useState('');

  // Debounce stock search — only hit backend after 400ms pause
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, debouncedSearch],
    queryFn: () => inventoryApi.list({ page, limit: 20, search: debouncedSearch || undefined }).then(r => r.data),
    refetchInterval: 20_000,
  });

  const { data: userMap = {} } = useQuery({
    queryKey: ['users-map'],
    queryFn: fetchUserMap,
    staleTime: 300_000,
  });

  const { data: movData, isLoading: movLoading } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryApi.movements({ limit: 100 }).then(r => r.data),
    enabled: activeTab === 'movements',
    refetchInterval: activeTab === 'movements' ? 20_000 : false,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-mini'],
    queryFn: () => productsApi.list({ limit: 200 }).then(r => r.data),
    staleTime: 300_000,
  });
  const productsMap: Record<string, any> = useMemo(() => {
    const list: any[] = productsData?.items ?? productsData?.data ?? [];
    return Object.fromEntries(list.map((p: any) => [p.id, p]));
  }, [productsData]);

  const allMovements: any[] = movData?.data ?? movData ?? [];
  // Client-side filter for movements
  const filteredMovements = movSearch.trim()
    ? allMovements.filter(m => {
        const q = movSearch.trim().toLowerCase();
        return (
          (m.inventory?.sku ?? m.sku ?? '').toLowerCase().includes(q) ||
          (m.reference ?? '').toLowerCase().includes(q) ||
          (m.movementType ?? '').toLowerCase().includes(q) ||
          (m.reason ?? '').toLowerCase().includes(q) ||
          (m.performedBy ?? '').toLowerCase().includes(q)
        );
      })
    : allMovements;

  const items: any[] = data?.data ?? data ?? [];
  const total = data?.total ?? items.length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">{total} SKUs tracked</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/inventory/transfers"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeftRight className="w-4 h-4" /> Transfers
          </a>
          <button
            onClick={() => setAddInvOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Add to Inventory
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="seg-switcher">
        {(['stock', 'movements'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'seg-btn-on' : 'seg-btn-off'}
          >
            {tab === 'stock' ? <><Package className="w-3.5 h-3.5" /> Stock Levels</> : <><Barcode className="w-3.5 h-3.5" /> Movement History</>}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'stock' && (
      <div className="card p-4">
        <input
          type="text"
          placeholder="Search by SKU, product ID or location…"
          className="input w-full sm:max-w-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      )}

      {/* Movements Search */}
      {activeTab === 'movements' && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            placeholder="Filter by SKU, reference, type, reason or performed by…"
            className="input w-full sm:max-w-sm"
            value={movSearch}
            onChange={e => setMovSearch(e.target.value)}
          />
          {movSearch && (
            <span className="text-xs text-slate-400">{filteredMovements.length} of {allMovements.length} shown</span>
          )}
        </div>
      )}

      {/* Stock Table */}
      {activeTab === 'stock' && (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-th">SKU</th>
                <th className="table-th">Product ID</th>
                <th className="table-th">Quantity</th>
                <th className="table-th">Reserved</th>
                <th className="table-th">Available</th>
                <th className="table-th">Low Stock Threshold</th>
                <th className="table-th">Status</th>
                <th className="table-th">IMEI / Serial</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={9} className="table-td text-center py-10 text-slate-400">No inventory records found.</td></tr>
              )}
              {items.map((item: any) => {
                const reserved = item.reserved ?? item.reservedQuantity ?? 0;
                const lowThreshold = item.lowStockQty ?? item.lowStockThreshold ?? 5;
                const available = item.quantity - reserved;
                const isLow = item.quantity <= lowThreshold;
                return (
                  <tr key={item.id} className="table-tr">
                    <td className="table-td font-mono font-medium">{item.sku}</td>
                    <td className="table-td text-slate-500 text-xs">{item.productId}</td>
                    <td className="table-td font-semibold">{item.quantity}</td>
                    <td className="table-td text-amber-600">{reserved}</td>
                    <td className={`table-td font-semibold ${available <= 0 ? 'text-red-600' : ''}`}>
                      {available}
                    </td>
                    <td className="table-td">{lowThreshold}</td>
                    <td className="table-td">
                      {isLow
                        ? <span className="badge badge-amber">Low Stock</span>
                        : <span className="badge badge-green">OK</span>
                      }
                    </td>
                    <td className="table-td">
                      {(item.product?.requiresImei || item.product?.requiresSerial || productsMap[item.productId]?.requiresImei || productsMap[item.productId]?.requiresSerial) ? (
                        <button
                          onClick={() => setDeviceLabelsItem(item)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                        >
                          {(item.product?.requiresImei || productsMap[item.productId]?.requiresImei)
                            ? <><Smartphone className="w-3 h-3" /><span>View IMEIs</span></>
                            : <><Hash className="w-3 h-3" /><span>View Serials</span></>
                          }
                          <span>→</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => setAdjustItem(item)}
                          className="text-xs text-primary font-semibold hover:underline">
                          Adjust
                        </button>
                        <button
                          onClick={() => setLabelItem(item)}
                          className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded px-1.5 py-0.5 hover:border-indigo-300 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Label
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-50">
            <span className="text-xs text-slate-400">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn-secondary text-xs" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Movements Table */}
      {activeTab === 'movements' && (
        <div className="table-card">
          {movLoading ? (
            <div className="p-8 text-center text-slate-400">Loading movements…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">SKU</th>
                    <th className="table-th">Type</th>
                    <th className="table-th">Qty Change</th>
                    <th className="table-th">Reference</th>
                    <th className="table-th">Reason / Notes</th>
                    <th className="table-th">Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 && (
                    <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">{movSearch ? 'No matches found.' : 'No movement records found.'}</td></tr>
                  )}
                  {filteredMovements.map((m: any) => {
                    const outTypes = ['SALE_OUT', 'DAMAGE_LOSS', 'REPAIR_USED'];
                    const isOut = outTypes.includes(m.movementType);
                    const absQty = Math.abs(m.quantity ?? 0);
                    const displayQty = isOut ? -absQty : absQty;
                    return (
                    <tr key={m.id} className="table-tr">
                      <td className="table-td text-xs text-slate-500">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
                      <td className="table-td font-mono font-medium">{m.inventory?.sku ?? m.sku ?? '—'}</td>
                      <td className="table-td">
                        <span className={`badge text-xs ${
                          m.movementType === 'PURCHASE_IN' || m.movementType === 'RETURN_IN' || m.movementType === 'INITIAL_STOCK'
                            ? 'badge-green' : m.movementType === 'DAMAGE_LOSS' || m.movementType === 'SALE_OUT'
                            ? 'badge-red' : 'badge-amber'
                        }`}>{m.movementType ?? '—'}</span>
                      </td>
                      <td className={`table-td font-semibold ${displayQty >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {displayQty >= 0 ? '+' : ''}{displayQty}
                      </td>
                      <td className="table-td text-slate-500 text-xs">{m.reference || '—'}</td>
                      <td className="table-td text-slate-400 text-xs">{m.reason ?? m.notes ?? '—'}</td>
                      <td className="table-td text-slate-400 text-xs">{userMap[m.performedBy] ?? m.performedBy ?? '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} />
      )}

      {/* Add Inventory Modal */}
      {addInvOpen && (
        <AddInventoryModal onClose={() => setAddInvOpen(false)} />
      )}

      {/* 🏷 Thermal Label Modal (SKU-level) */}
      {labelItem && (
        <div className="modal-overlay"
          onClick={() => setLabelItem(null)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="modal-title flex items-center gap-2"><Tag className="w-5 h-5 text-slate-500" /> Print Label</h3>
              <button onClick={() => setLabelItem(null)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>
            {(productsMap[labelItem.productId]?.requiresImei || productsMap[labelItem.productId]?.requiresSerial) && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-start gap-1.5">
                <Pin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span><strong>Device-tracked product:</strong> this label is for the product shelf.
                For individual device labels (with IMEI / serial barcode),{' '}
                <button
                  onClick={() => { setLabelItem(null); setDeviceLabelsItem(labelItem); }}
                  className="underline font-semibold">
                  open Device Labels →
                </button>
                </span>
              </div>
            )}
            <ThermalLabel
              data={{
                type: 'part',
                sku: labelItem.sku,
                name: labelItem.product?.name ?? productsMap[labelItem.productId]?.name ?? labelItem.sku,
                price: productsMap[labelItem.productId]?.sellingPrice
                  ? `LKR ${Number(productsMap[labelItem.productId].sellingPrice).toLocaleString()}`
                  : undefined,
                barcode: productsMap[labelItem.productId]?.barcode ?? labelItem.sku,
                location: labelItem.location ?? undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* 📱 Per-device IMEI / Serial labels */}
      {deviceLabelsItem && (
        <DeviceLabelsModal
          item={deviceLabelsItem}
          productsMap={productsMap}
          onClose={() => setDeviceLabelsItem(null)}
        />
      )}
    </div>
  );
}
