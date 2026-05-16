'use client';
import { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Lightbulb, QrCode } from 'lucide-react';

interface ProductForm {
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  warrantyMonths: number;
  sku: string;
  productType: string;
  barcode: string;
  requiresImei: boolean;
  requiresSerial: boolean;
}

// An image slot can be: already-uploaded URL, or an in-progress upload
interface ImageSlot {
  id: string;           // unique key
  preview: string;      // ObjectURL (uploading) or remote URL (done)
  uploaded: boolean;    // true = final Cloudinary URL
  pct: number;          // 0-100 while uploading
  ctrl?: AbortController;
}

const PRODUCT_TYPES = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'SPARE_PART', label: 'Spare Part' },
  { value: 'SERVICE', label: 'Service' },
];

function CircleProgress({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" className="absolute inset-0 m-auto" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="white" strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s' }} />
    </svg>
  );
}

function BarcodeModal({ name, sku, barcode, onClose }: { name: string; sku: string; barcode: string; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 2.2,
          height: 70,
          displayValue: true,
          fontSize: 13,
          margin: 8,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // invalid barcode value — render nothing
      }
    }
  }, [barcode]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="modal-title">Product Barcode</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <p className="text-sm font-medium text-slate-700">{name}</p>
        <p className="text-xs text-slate-400 font-mono mb-4">{sku}</p>
        <div className="flex justify-center bg-white border border-slate-200 rounded-xl p-5">
          <svg ref={svgRef} />
        </div>
        <p className="text-center text-xs text-slate-400 font-mono mt-3 break-all">{barcode}</p>
        <button onClick={onClose} className="btn-secondary w-full mt-4">Close</button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<{ name: string; sku: string; barcode: string } | null>(null);

  // Unified image slots (both uploaded and in-progress)
  const [slots, setSlots] = useState<ImageSlot[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, page }],
    queryFn: () => productsApi.list({ search, page, limit: 20 }).then(r => r.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productsApi.categories().then(r => r.data),
  });

  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : [];

  const products: any[] = data?.items ?? data?.data ?? [];
  const total: number = data?.total ?? products.length;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProductForm>();

  const watchRequiresImei   = watch('requiresImei');
  const watchRequiresSerial = watch('requiresSerial');

  const saveMutation = useMutation({
    mutationFn: (d: ProductForm) => {
      const uploadedUrls = slots.filter(s => s.uploaded).map(s => s.preview);
      const payload = {
        ...d,
        costPrice: Number(d.costPrice),
        sellingPrice: Number(d.sellingPrice),
        images: uploadedUrls,
        barcode: d.barcode?.trim() || undefined,
        requiresImei: !!d.requiresImei,
        requiresSerial: !!d.requiresSerial,
      };
      return editingProduct
        ? productsApi.update(editingProduct.id, payload)
        : productsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editingProduct ? 'Product updated' : 'Product created');
      qc.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const closeModal = () => {
    slots.forEach(s => { if (s.ctrl) { s.ctrl.abort(); URL.revokeObjectURL(s.preview); } });
    setSlots([]);
    setModalOpen(false);
    reset();
    setEditingProduct(null);
  };

  const openCreate = () => {
    slots.forEach(s => { if (s.ctrl) { s.ctrl.abort(); URL.revokeObjectURL(s.preview); } });
    setSlots([]);
    setEditingProduct(null);
    reset({ productType: 'PHONE', warrantyMonths: 12, requiresImei: false, requiresSerial: false, barcode: '' });
    setModalOpen(true);
  };

  const openEdit = async (p: any) => {
    slots.forEach(s => { if (s.ctrl) { s.ctrl.abort(); URL.revokeObjectURL(s.preview); } });
    setSlots([]);
    setModalOpen(true);

    // Fetch fresh data so saved images are always shown
    let product = p;
    try {
      const res = await productsApi.get(p.id);
      product = res.data;
    } catch { /* fall back to list row */ }

    const existing: ImageSlot[] = (product.images ?? []).map((url: string, i: number) => ({
      id: `existing-${i}-${url}`,
      preview: url,
      uploaded: true,
      pct: 100,
    }));
    setSlots(existing);
    setEditingProduct(product);
    reset({
      name: product.name,
      brand: product.brand ?? '',
      categoryId: product.categoryId,
      description: product.description ?? '',
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      warrantyMonths: product.warrantyMonths ?? 12,
      sku: product.sku,
      productType: product.productType ?? 'PHONE',
      barcode: product.barcode ?? '',
      requiresImei: product.requiresImei ?? false,
      requiresSerial: product.requiresSerial ?? false,
    });
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 5 - slots.length;
    if (remaining <= 0) { toast.error('Maximum 5 images allowed'); return; }
    const toUpload = files.slice(0, remaining);
    if (fileInputRef.current) fileInputRef.current.value = '';

    toUpload.forEach(file => {
      const ctrl = new AbortController();
      const id = `upload-${Date.now()}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      const newSlot: ImageSlot = { id, preview, uploaded: false, pct: 0, ctrl };
      setSlots(prev => [...prev, newSlot]);

      productsApi.uploadImage(file, {
        signal: ctrl.signal,
        onProgress: (pct) => setSlots(prev => prev.map(s => s.id === id ? { ...s, pct } : s)),
      })
        .then((r: any) => {
          URL.revokeObjectURL(preview);
          setSlots(prev => prev.map(s => s.id === id
            ? { id, preview: r.data.url, uploaded: true, pct: 100 }
            : s
          ));
        })
        .catch((err: any) => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
          toast.error(`${file.name}: ${err?.response?.data?.message ?? err?.message ?? 'Upload failed'}`);
          URL.revokeObjectURL(preview);
          setSlots(prev => prev.filter(s => s.id !== id));
        });
    });
  };

  const removeSlot = (slot: ImageSlot) => {
    if (slot.ctrl) slot.ctrl.abort();
    if (!slot.uploaded) URL.revokeObjectURL(slot.preview);
    setSlots(prev => prev.filter(s => s.id !== slot.id));
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{total.toLocaleString()} products</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products…" className="input w-full sm:w-52 text-sm" />
          <button onClick={openCreate} className="btn-primary">+ Add Product</button>
        </div>
      </div>

      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr>
              {['SKU', 'Name', 'Brand', 'Category', 'Cost', 'Price', 'Warranty', 'Tracking', 'Active', ''].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && products.length === 0 && (
              <tr><td colSpan={10} className="table-td text-center py-10 text-slate-400">No products found</td></tr>
            )}
            {products.map((p: any) => (
              <tr key={p.id} className="table-tr">
                <td className="table-td font-mono text-xs">{p.sku}</td>
                <td className="table-td font-medium">{p.name}</td>
                <td className="table-td text-slate-500">{p.brand}</td>
                <td className="table-td">
                  <span className="badge badge-blue">{p.category?.name ?? '—'}</span>
                </td>
                <td className="table-td text-slate-500">LKR {Number(p.costPrice).toLocaleString()}</td>
                <td className="table-td font-semibold">LKR {Number(p.sellingPrice).toLocaleString()}</td>
                <td className="table-td text-center">{p.warrantyMonths ?? '—'}m</td>
                <td className="table-td">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.requiresImei && (
                      <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">IMEI</span>
                    )}
                    {p.requiresSerial && (
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">S/N</span>
                    )}
                    {p.barcode && (
                      <button
                        onClick={() => setBarcodeProduct({ name: p.name, sku: p.sku, barcode: p.barcode })}
                        title="View barcode"
                        className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}
                    {!p.requiresImei && !p.requiresSerial && !p.barcode && (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="table-td">
                  <span className={`badge ${p.isActive ? 'badge-green' : 'badge-red'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(p)} className="text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => setDeletingId(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
          <span className="text-xs text-slate-400 tabular self-center px-1">Page {page}</span>
          <button disabled={products.length < 20} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              <button type="button" onClick={closeModal} className="btn-icon text-base">✕</button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Product Name *</label>
                    <input {...register('name', { required: true })} className="input" />
                    {errors.name && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="label">SKU *</label>
                    <input {...register('sku', { required: true })} className="input font-mono" placeholder="e.g. SM-001" />
                    {errors.sku && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="label">Brand</label>
                    <input {...register('brand')} className="input" placeholder="Samsung, Apple…" />
                  </div>
                  <div>
                    <label className="label">Category *</label>
                    <select {...register('categoryId', { required: true })} className="input">
                      <option value="">Select…</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {errors.categoryId && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="label">Product Type</label>
                    <select {...register('productType')} className="input">
                      {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Warranty (months)</label>
                    <input type="number" {...register('warrantyMonths', { min: 0 })} className="input" defaultValue={12} />
                  </div>
                  <div>
                    <label className="label">Cost Price (LKR) *</label>
                    <input type="number" step="0.01" {...register('costPrice', { required: true, min: 0 })} className="input" />
                    {errors.costPrice && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="label">Selling Price (LKR) *</label>
                    <input type="number" step="0.01" {...register('sellingPrice', { required: true, min: 0 })} className="input" />
                    {errors.sellingPrice && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                </div>

                {/* ── Barcode + Serial/IMEI Tracking ── */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Barcode &amp; Tracking</p>

                  {/* IMEI / Serial toggles */}
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" {...register('requiresImei')} className="w-4 h-4 rounded accent-primary" />
                      <span className="text-sm text-slate-700 font-medium">Requires IMEI</span>
                      <span className="text-xs text-slate-400">(smartphones)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" {...register('requiresSerial')} className="w-4 h-4 rounded accent-primary" />
                      <span className="text-sm text-slate-700 font-medium">Requires Serial</span>
                      <span className="text-xs text-slate-400">(laptops, TVs…)</span>
                    </label>
                  </div>

                  {/* Barcode — required when either tracking flag is on */}
                  <div>
                    <label className="label">
                      Barcode
                      {(watchRequiresImei || watchRequiresSerial) && (
                        <span className="ml-1 text-red-500">* required for IMEI/Serial tracking</span>
                      )}
                    </label>
                    <input
                      {...register('barcode', {
                        required: (watchRequiresImei || watchRequiresSerial)
                          ? 'Barcode is required when IMEI or Serial tracking is enabled'
                          : false,
                      })}
                      className="input font-mono"
                      placeholder="Scan or type barcode (EAN-13, Code 128, QR…)"
                    />
                    {errors.barcode && (
                      <p className="text-xs text-red-500 mt-1">{errors.barcode.message as string}</p>
                    )}
                    {(watchRequiresImei || watchRequiresSerial) && !errors.barcode && (
                      <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                        <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
                        Scan the product box with a barcode scanner or type it manually.
                        This barcode is used to identify the product at the POS counter.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea {...register('description')} rows={3} className="input resize-none" />
                </div>
                {/* Image Upload — WhatsApp style */}
                <div>
                  <label className="label">
                    Product Images
                    <span className="text-slate-400 font-normal ml-1">(optional, max 5)</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {slots.map(slot => (
                      <div key={slot.id}
                        className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slot.preview} alt="product"
                          onClick={() => slot.uploaded && setLightboxUrl(slot.preview)}
                          className={`w-full h-full object-cover transition-all duration-300 ${
                            !slot.uploaded ? 'blur-[1px] brightness-50' : 'cursor-zoom-in'
                          }`} />
                        {!slot.uploaded && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <CircleProgress pct={slot.pct} />
                            <span className="absolute text-white text-[10px] font-bold leading-none">{slot.pct}%</span>
                          </div>
                        )}
                        <button type="button" onClick={() => removeSlot(slot)}
                          className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-red-500 text-white
                            rounded-full w-5 h-5 text-[10px] flex items-center justify-center
                            transition-colors leading-none">
                          ✕
                        </button>
                      </div>
                    ))}
                    {slots.length < 5 && (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple
                          className="hidden" onChange={handleImagePick} />
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300
                            hover:border-primary flex flex-col items-center justify-center
                            text-slate-400 hover:text-primary transition-colors shrink-0">
                          <span className="text-2xl leading-none">+</span>
                          <span className="text-[10px] mt-0.5">{slots.length}/5</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-ft">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1">
                  {saveMutation.isPending ? 'Saving…' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-panel max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-2">Delete Product?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => deleteMutation.mutate(deletingId!)} disabled={deleteMutation.isPending}
                className="btn-danger flex-1">{deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete'}</button>
              <button onClick={() => setDeletingId(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Preview Modal */}
      {barcodeProduct && (
        <BarcodeModal
          name={barcodeProduct.name}
          sku={barcodeProduct.sku}
          barcode={barcodeProduct.barcode}
          onClose={() => setBarcodeProduct(null)}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="modal-overlay"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white
              rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
