'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ordersApi, invoicesApi, fetchUserMap } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Eye, Loader2, Download } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'badge-amber',
  PROCESSING: 'badge-blue',
  COMPLETED: 'badge-green',
  VOIDED: 'badge-red',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id).then(r => r.data),
    enabled: !!id,
  });

  const { data: userMap = {} } = useQuery({
    queryKey: ['users-map'],
    queryFn: fetchUserMap,
    staleTime: 300_000,
  });

  const completeMutation = useMutation({
    mutationFn: () => ordersApi.complete(id),
    onSuccess: () => { toast.success('Order completed'); router.refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

  /** Convert a Cloudinary image/upload PDF URL to a JPG preview.
   *  New PDFs are uploaded as resource_type=image → /image/upload/
   *  Old PDFs were raw/upload/ — those will be force-regenerated.
   */
  function toPdfPreviewImage(pdfUrl: string): string {
    if (pdfUrl.includes('/image/upload/')) {
      // Insert pg_1,f_jpg,w_900 transformations
      return pdfUrl.replace('/image/upload/', '/image/upload/w_900,pg_1,f_jpg/');
    }
    // Fallback: return original URL (will be shown in iframe)
    return pdfUrl;
  }

  async function resolvePdfUrl(): Promise<string | undefined> {
    let pdfUrl: string | undefined = data?.invoice?.pdfUrl;
    // Old raw/upload URLs: private and can't be image-transformed → force regenerate
    const needsRegen = !pdfUrl || pdfUrl.includes('/raw/upload/');
    if (needsRegen) {
      const o = data!;
      const res = await invoicesApi.generatePdf({
        invoice_no: o.invoice?.invoiceNo ?? o.orderNumber,
        customer_name: o.customer
          ? `${o.customer.name} (${o.customer.tier ?? 'Registered'})`
          : ((o as any).walkInName ? `${(o as any).walkInName} (Walk-in)` : 'Walk-in Customer'),
        cashier_name: o.cashier?.name ?? userMap[o.cashierId] ?? o.cashierId ?? 'Staff',
        date: o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy HH:mm') : '',
        subtotal: Number(o.subtotal ?? 0),
        discount: Number(o.discountAmt ?? 0),
        total: Number(o.totalAmt ?? 0),
        items: (o.items ?? []).map((item: any) => ({
          product_name: item.productName ?? item.product?.name ?? item.sku,
          sku: item.sku ?? '',
          imei: item.imei ?? null,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice ?? 0),
          discount_amt: Number(item.discountAmt ?? 0),
          line_total: Number(item.lineTotal ?? (Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))),
        })),
      });
      pdfUrl = res.data?.url;
    }
    return pdfUrl;
  }

  async function handlePreview() {
    setIsPrinting(true);
    try {
      const pdfUrl = await resolvePdfUrl();
      if (!pdfUrl) { toast.error('PDF URL not available'); return; }
      // For new image/upload PDFs show a rendered page-1 JPG; otherwise use PDF URL in iframe
      setPreviewImgUrl(pdfUrl.includes('/image/upload/') ? toPdfPreviewImage(pdfUrl) : pdfUrl);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to generate PDF');
    } finally {
      setIsPrinting(false);
    }
  }

  async function handleDownload() {
    setIsPrinting(true);
    try {
      const pdfUrl = await resolvePdfUrl();
      if (!pdfUrl) { toast.error('PDF URL not available'); return; }

      // Cloudinary blocks direct fetch on original resources even with access_mode=public,
      // but *derived* resources (those with a transformation in the URL) are publicly accessible.
      // fl_attachment is a Cloudinary transformation flag that:
      //   1. Creates a publicly-accessible derived resource (same reason preview works with w_900,f_jpg)
      //   2. Adds Content-Disposition: attachment so the browser downloads instead of displaying
      const downloadUrl = pdfUrl.includes('/image/upload/')
        ? pdfUrl.replace('/image/upload/', '/image/upload/fl_attachment/')
        : pdfUrl;

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${data?.orderNumber ?? 'invoice'}.pdf`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to download PDF');
    } finally {
      setIsPrinting(false);
    }
  }

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading order…</div>;
  if (error || !data) return (
    <div className="text-center py-20">
      <p className="text-slate-500 mb-4">Order not found</p>
      <Link href="/orders" className="btn-secondary">← Back to Orders</Link>
    </div>
  );

  const o = data;
  const subtotal = Number(o.subtotal ?? 0);
  const tax = Number(o.taxAmt ?? 0);
  const discount = Number(o.discountAmt ?? 0);
  const total = Number(o.totalAmt ?? 0);

  return (
    <>
    <div className="max-w-3xl mx-auto space-y-5 animate-fadeIn">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600 text-sm">← Orders</Link>
        <span className="text-slate-300">/</span>
        <h1 className="page-title">{o.orderNumber}</h1>
        <span className={`badge ${STATUS_COLORS[o.status] ?? 'badge-gray'} ml-1`}>{o.status}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {o.status === 'PENDING' && (
            <button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}
              className="btn-primary text-sm">
              {completeMutation.isPending ? '…' : '✓ Complete Order'}
            </button>
          )}
          <button
            onClick={handlePreview}
            disabled={isPrinting}
            className="btn-secondary text-sm flex items-center gap-1.5">
            {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Preview
          </button>
          <button
            onClick={handleDownload}
            disabled={isPrinting}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm">Order Info</h3>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Order #</span>
              <span className="font-mono font-semibold">{o.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span>{o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy HH:mm') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment</span>
              <span className="badge badge-blue">{o.paymentMethod ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier</span>
              <span>{o.cashier?.name ?? userMap[o.cashierId] ?? o.cashierId ?? '—'}</span>
            </div>
            {o.notes && (
              <div className="flex justify-between">
                <span className="text-slate-500">Note</span>
                <span className="text-right max-w-[180px]">{o.notes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-700 text-sm">
              {o.customer
                ? o.customer.name
                : ((o as any).walkInName || 'Walk-in Customer')}
            </h3>
            {o.customer ? (
              <>
                <span className="badge badge-blue text-xs">Online</span>
                <span className={`badge text-xs ${o.customer.tier === 'PREMIUM' ? 'badge-amber' : 'badge-gray'}`}>
                  {o.customer.tier ?? 'STANDARD'}
                </span>
              </>
            ) : (
              <span className="badge badge-gray text-xs">Walk-in</span>
            )}
          </div>
          {o.customer ? (
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{o.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="font-mono">{o.customer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tier</span>
                <span className={`badge ${o.customer.tier === 'PREMIUM' ? 'badge-amber' : 'badge-gray'}`}>{o.customer.tier}</span>
              </div>
              {o.loyaltyPointsEarned > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Points Earned</span>
                  <span className="text-amber-600 font-semibold">+{o.loyaltyPointsEarned} pts</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm space-y-1.5">
              <p className="text-sm text-slate-400">Walk-in customer — not registered in loyalty programme</p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="table-card">
        <div className="px-5 py-3 border-b border-slate-50">
          <h3 className="font-semibold text-slate-700 text-sm">Items</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              {['SKU', 'Product', 'Unit Price', 'Qty', 'Total'].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(o.items ?? []).map((item: any) => (
              <tr key={item.id} className="table-tr">
                <td className="table-td font-mono text-xs">{item.sku ?? item.inventory?.sku ?? '—'}</td>
                <td className="table-td">
                  <div className="font-medium">{item.productName ?? item.product?.name ?? item.productId}</div>
                  {item.imei && <div className="text-xs text-slate-400">IMEI: {item.imei}</div>}
                  {!item.imei && item.serialNumber && <div className="text-xs text-slate-400">S/N: {item.serialNumber}</div>}
                </td>
                <td className="table-td">LKR {Number(item.unitPrice ?? 0).toLocaleString()}</td>
                <td className="table-td text-center">{item.quantity}</td>
                <td className="table-td font-semibold">LKR {(Number(item.unitPrice) * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span><span>LKR {subtotal.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Loyalty Discount</span><span>− LKR {discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>VAT (5%)</span><span>LKR {tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2 mt-1">
            <span>Total</span><span className="text-primary">LKR {total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>

    {/* ── Invoice Preview Modal ─────────────────────────────────────────── */}
    {previewImgUrl && (
      <div
        className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-2 sm:p-6 overflow-y-auto"
        onClick={() => setPreviewImgUrl(null)}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Invoice Preview — {data?.orderNumber}</h3>
            <button
              onClick={() => setPreviewImgUrl(null)}
              className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none">✕</button>
          </div>
          <div className="p-4">
            {previewImgUrl?.includes('.jpg') ? (
              <img
                src={previewImgUrl}
                alt="Invoice preview"
                className="w-full rounded-lg border border-slate-100 shadow-sm"
                onError={() => { toast.error('Preview failed to load'); setPreviewImgUrl(null); }}
              />
            ) : (
              <iframe
                src={previewImgUrl ?? ''}
                title="Invoice Preview"
                className="w-full rounded-lg border border-slate-100"
              style={{ height: 'min(680px, 70vh)' }}
              />
            )}
          </div>
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-100">
            <button onClick={() => setPreviewImgUrl(null)} className="btn-secondary text-sm">Close</button>
            <button onClick={handleDownload} disabled={isPrinting} className="btn-primary text-sm">⬇ Download PDF</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
