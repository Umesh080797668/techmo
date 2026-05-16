'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { compatibilityApi, deviceModelsApi, productsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function CompatibilityPage() {
  const qc = useQueryClient();

  // Filters
  const [modelSearch, setModelSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Model CRUD modal
  const [modelModal, setModelModal] = useState(false);
  const [modelForm, setModelForm] = useState({ brand: '', model: '', releaseYear: '', variant: 'Smartphone' });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Compatibility mapping modal
  const [mapModal, setMapModal] = useState(false);
  const [mapProductId, setMapProductId] = useState('');
  const [mapModelIds, setMapModelIds] = useState<string[]>([]);

  const { data: modelsData } = useQuery({
    queryKey: ['device-models', modelSearch],
    queryFn: () => deviceModelsApi.list({ search: modelSearch, limit: 30 }).then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-compat', productSearch],
    queryFn: () => productsApi.list({ search: productSearch, limit: 30 }).then(r => r.data),
  });

  const { data: compatData } = useQuery({
    queryKey: ['compat-by-model', selectedModel?.id],
    queryFn: () => compatibilityApi.listByModel(selectedModel!.id).then(r => r.data),
    enabled: !!selectedModel,
  });

  const { data: compatByProductData } = useQuery({
    queryKey: ['compat-by-product', selectedProduct?.id],
    queryFn: () => compatibilityApi.listByProduct(selectedProduct!.id).then(r => r.data),
    enabled: !!selectedProduct,
  });

  const models: any[] = Array.isArray(modelsData) ? modelsData : (modelsData?.data ?? []);
  const products: any[] = productsData?.items ?? productsData?.data ?? [];
  const compatItems: any[] = compatData?.data ?? compatData ?? [];
  const compatByProduct: any[] = compatByProductData?.data ?? compatByProductData ?? [];

  const createModelMutation = useMutation({
    mutationFn: () => deviceModelsApi.create({ ...modelForm, releaseYear: Number(modelForm.releaseYear) || undefined }),
    onSuccess: () => {
      toast.success('Device model created');
      qc.invalidateQueries({ queryKey: ['device-models'] });
      setModelModal(false);
      setModelForm({ brand: '', model: '', releaseYear: '', variant: 'Smartphone' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => deviceModelsApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['device-models'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const mapMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        mapModelIds.map(modelId =>
          compatibilityApi.create({ productId: mapProductId, deviceModelId: modelId }),
        ),
      ),
    onSuccess: () => {
      toast.success('Compatibility mapped');
      qc.invalidateQueries({ queryKey: ['compat-by-model'] });
      qc.invalidateQueries({ queryKey: ['compat-by-product'] });
      setMapModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const removeMutation = useMutation({
    mutationFn: (compatibilityRecordId: string) =>
      compatibilityApi.remove(compatibilityRecordId),
    onSuccess: () => {
      toast.success('Removed');
      qc.invalidateQueries({ queryKey: ['compat-by-model'] });
      qc.invalidateQueries({ queryKey: ['compat-by-product'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compatibility Manager</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMapModal(true)} className="btn-secondary text-sm">+ Map Compatibility</button>
          <button onClick={() => setModelModal(true)} className="btn-primary text-sm">+ Device Model</button>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {/* Device Models panel */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Device Models</h2>
            <span className="badge badge-gray">{models.length}</span>
          </div>
          <input className="input text-sm" placeholder="Search models…"
            value={modelSearch} onChange={e => setModelSearch(e.target.value)} />
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {models.map((m: any) => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m); setSelectedProduct(null); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                  selectedModel?.id === m.id
                    ? 'bg-primary text-white'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{m.brand} {m.model}</span>
                  <div className="flex items-center gap-2">
                    {m.releaseYear && <span className={`text-xs ${selectedModel?.id === m.id ? 'text-blue-200' : 'text-slate-400'}`}>{m.releaseYear}</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDialog({
                        open: true,
                        title: 'Delete Device Model',
                        message: `Delete "${m.brand} ${m.model}"? This will also remove all compatibility mappings for this model.`,
                        onConfirm: () => { deleteModelMutation.mutate(m.id); setConfirmDialog(d => ({ ...d, open: false })); },
                      }); }}
                      className={`text-xs ${selectedModel?.id === m.id ? 'text-red-300 hover:text-red-100' : 'text-red-400 hover:text-red-600'}`}>
                      ✕
                    </button>
                  </div>
                </div>
                <span className={`text-xs ${selectedModel?.id === m.id ? 'text-blue-200' : 'text-slate-400'}`}>{m.variant}</span>
              </button>
            ))}
            {models.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">No device models found</p>
            )}
          </div>
        </div>

        {/* Compatible parts for selected model */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-700">
            {selectedModel ? `Compatible Parts — ${selectedModel.brand} ${selectedModel.model}` : 'Select a device model'}
          </h2>
          {selectedModel ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {compatItems.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">No compatible parts mapped</p>
              ) : (
                compatItems.map((c: any) => (
                  <div key={c.id ?? c.productId} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.product?.name ?? c.productId}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.product?.sku ?? ''}</p>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(c.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold">
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-400 text-sm">Select a device model on the left to view compatible parts.</p>
          )}
        </div>
      </div>

      {/* Model creation modal */}
      {modelModal && (
        <div className="modal-overlay" onClick={() => setModelModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">New Device Model</h3>
              <button onClick={() => setModelModal(false)} className="btn-icon text-base">✕</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Brand</label>
                  <input className="input" placeholder="e.g. Samsung"
                    value={modelForm.brand} onChange={e => setModelForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Model</label>
                  <input className="input" placeholder="e.g. Galaxy S24"
                    value={modelForm.model} onChange={e => setModelForm(f => ({ ...f, model: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Year (optional)</label>
                  <input className="input" type="number" placeholder="2024"
                    value={modelForm.releaseYear} onChange={e => setModelForm(f => ({ ...f, releaseYear: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={modelForm.variant}
                    onChange={e => setModelForm(f => ({ ...f, variant: e.target.value }))}>
                    {['Smartphone', 'Tablet', 'Laptop', 'Wearable', 'Other'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => setModelModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createModelMutation.mutate()} disabled={createModelMutation.isPending} className="btn-primary flex-1">
                {createModelMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map compatibility modal */}
      {mapModal && (
        <div className="modal-overlay" onClick={() => setMapModal(false)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">Map Compatibility</h3>
              <button onClick={() => setMapModal(false)} className="btn-icon text-base">✕</button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="label">Product (accessory / part)</label>
                <select className="input" value={mapProductId} onChange={e => setMapProductId(e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Compatible Device Models</label>
                <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto p-2 space-y-1">
                  {models.map((m: any) => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox"
                        checked={mapModelIds.includes(m.id)}
                        onChange={e => setMapModelIds(prev =>
                          e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
                        )}
                      />
                      <span className="text-sm">{m.brand} {m.model} {m.year ? `(${m.year})` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => setMapModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => mapMutation.mutate()} disabled={mapMutation.isPending || !mapProductId || mapModelIds.length === 0} className="btn-primary flex-1">
                {mapMutation.isPending ? 'Saving…' : `Map to ${mapModelIds.length} model(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
