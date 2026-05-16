'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Search, Package, CheckCircle2, ShoppingCart, Tag, Banknote, CreditCard, Building2, Camera, LockKeyhole } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { inventoryApi, customersApi, ordersApi, posApi, productsApi, pricingApi, reservationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { enqueueOrder, getPendingOrders, markSyncing, markSynced, markFailed } from '@/lib/offline-queue';
import { useKeyboardWedgeScanner } from '@/lib/useKeyboardWedgeScanner';

// Camera barcode scanner — loaded client-side only (ZXing on desktop, BarcodeDetector on mobile)
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────────────────────
interface CartItem {
  inventoryId: string;
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imeiNumber?: string;
  discountType: 'none' | 'pct' | 'flat'; // per-item discount type
  discountValue: number;                  // % or LKR amount
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  loyaltyPoints: number;
  tier: string;
}

function customerName(c: Customer) {
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.phone;
}

const TAX_RATE = 0.05;
const POINT_VALUE = 1; // 1 pt = LKR 1

// ─── Helpers ────────────────────────────────────────────────────────────────────
function itemDiscountAmt(item: CartItem): number {
  if (item.discountType === 'pct') return Math.round(item.unitPrice * item.quantity * (item.discountValue / 100) * 100) / 100;
  if (item.discountType === 'flat') return Math.min(item.discountValue, item.unitPrice * item.quantity);
  return 0;
}

function calcTotals(cart: CartItem[], redeemPoints: number, manualDiscount: number) {
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemsDiscount = cart.reduce((s, i) => s + itemDiscountAmt(i), 0);
  const loyaltyDiscount = Math.min(redeemPoints * POINT_VALUE, subtotal);
  const totalDiscount = itemsDiscount + manualDiscount + loyaltyDiscount;
  const taxable = Math.max(subtotal - totalDiscount, 0);
  const tax = Math.round(taxable * TAX_RATE * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  const pointsEarned = Math.floor(total * 0.01); // 1pt per 100 LKR
  return { subtotal, itemsDiscount, manualDiscount, loyaltyDiscount, totalDiscount, tax, total, pointsEarned };
}

// ─── Sub-components ─────────────────────────────────────────────────────────────
function CartItemRow({ item, onQtyChange, onRemove, onDiscountChange }: {
  item: CartItem;
  onQtyChange: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
  onDiscountChange: (sku: string, type: CartItem['discountType'], value: number) => void;
}) {
  const discAmt = itemDiscountAmt(item);
  const lineFinal = item.unitPrice * item.quantity - discAmt;
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
          <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
          {item.imeiNumber && (
            <p className="text-xs text-slate-400">IMEI: {item.imeiNumber}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onQtyChange(item.sku, item.quantity - 1)}
            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-sm flex items-center justify-center hover:bg-slate-200 transition">
            −
          </button>
          <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
          <button
            onClick={() => onQtyChange(item.sku, item.quantity + 1)}
            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-sm flex items-center justify-center hover:bg-slate-200 transition">
            +
          </button>
        </div>
        <div className="text-right min-w-[80px]">
          {discAmt > 0 ? (
            <>
              <p className="text-xs text-slate-400 line-through">LKR {(item.unitPrice * item.quantity).toLocaleString()}</p>
              <p className="text-sm font-semibold text-green-700">LKR {lineFinal.toLocaleString()}</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-800">
              LKR {(item.unitPrice * item.quantity).toLocaleString()}
            </p>
          )}
          <p className="text-xs text-slate-400">@ {item.unitPrice.toLocaleString()}</p>
        </div>
        <button
          onClick={() => onRemove(item.sku)}
          className="text-red-400 hover:text-red-600 text-sm transition">
          ✕
        </button>
      </div>
      {/* Per-item discount row */}
      <div className="flex items-center gap-1.5 mt-1.5 pl-1">
        <span className="text-xs text-slate-400">Disc:</span>
        <select
          value={item.discountType}
          onChange={e => onDiscountChange(item.sku, e.target.value as CartItem['discountType'], item.discountValue)}
          className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-600 focus:outline-none focus:border-primary/50">
          <option value="none">None</option>
          <option value="pct">%</option>
          <option value="flat">LKR</option>
        </select>
        {item.discountType !== 'none' && (
          <input
            type="number"
            min="0"
            max={item.discountType === 'pct' ? 100 : item.unitPrice * item.quantity}
            value={item.discountValue || ''}
            onChange={e => onDiscountChange(item.sku, item.discountType, Number(e.target.value))}
            className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-primary/50"
            placeholder={item.discountType === 'pct' ? '0%' : '0 LKR'}
          />
        )}
        {discAmt > 0 && (
          <span className="text-xs text-green-600 font-medium ml-auto">-LKR {discAmt.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

// ─── Product Browser Panel ──────────────────────────────────────────────────────
function ProductBrowserPanel({ onAddSku }: { onAddSku: (sku: string) => void }) {
  const [search, setSearch] = useState('');

  const { data: invRes, isLoading: invLoading } = useQuery({
    queryKey: ['pos-browser-inventory'],
    queryFn: () => inventoryApi.list({ limit: 200 }).then(r => r.data),
    staleTime: 20_000,
  });

  const { data: prodRes, isLoading: prodLoading } = useQuery({
    queryKey: ['pos-browser-products'],
    queryFn: () => productsApi.list({ limit: 200, isActive: true }).then(r => r.data),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const inv: any[] = invRes?.data ?? [];
    const prods: any[] = prodRes?.items ?? prodRes?.data ?? [];
    const invMap: Record<string, any> = {};
    inv.forEach(i => { invMap[i.sku] = i; });
    const term = search.toLowerCase();
    return prods
      .filter(p => p.isActive !== false)
      .map(p => ({
        sku: p.sku,
        name: p.name,
        sellingPrice: Number(p.sellingPrice ?? 0),
        stockQty: invMap[p.sku]?.quantity ?? 0,
        imageUrl: (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : null,
      }))
      .filter(p =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
      )
      .sort((a, b) => b.stockQty - a.stockQty);
  }, [invRes, prodRes, search]);

  const loading = invLoading || prodLoading;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="input pl-8 text-sm"
            autoFocus
          />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{items.length} products</span>
      </div>
      {loading ? (
        <div className="text-center py-6 text-slate-400 text-sm">Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">No products found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {items.map(p => (
            <button
              key={p.sku}
              onClick={() => p.stockQty > 0 && onAddSku(p.sku)}
              disabled={p.stockQty <= 0}
              className={`text-left p-3 rounded-xl border transition-all flex gap-2.5 items-start ${
                p.stockQty > 0
                  ? 'border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                  : 'border-slate-100 opacity-40 cursor-not-allowed'
              }`}>
              {/* Product thumbnail */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{p.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-xs font-semibold text-primary">
                    LKR {p.sellingPrice.toLocaleString()}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    p.stockQty > 5
                      ? 'bg-green-50 text-green-600'
                      : p.stockQty > 0
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-500'
                  }`}>
                    {p.stockQty > 0 ? `${p.stockQty} left` : 'Out'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main POS Page ───────────────────────────────────────────────────────────────
export default function POSPage() {
  const { user } = useAuth();

  // SKU / Barcode scan
  const [skuInput, setSkuInput] = useState('');
  const [skuLoading, setSkuLoading] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer
  const [phoneInput, setPhoneInput] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Manual order-level discount
  const [manualDiscType, setManualDiscType] = useState<'pct' | 'flat'>('flat');
  const [manualDiscRaw, setManualDiscRaw] = useState(''); // raw input string
  const manualDiscValue = Number(manualDiscRaw) || 0;

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [orderNote, setOrderNote] = useState('');

  // Product browser
  const [showBrowser, setShowBrowser] = useState(false);
  // Camera scanner
  const [showCamera, setShowCamera] = useState(false);

  // Manager PIN modal (for pricing rules with requiresManagerPin)
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinValidating, setPinValidating] = useState(false);
  const [pendingCartAdd, setPendingCartAdd] = useState<{
    ruleNames: string[];
    discountPct: number;
    onConfirm: () => void;
  } | null>(null);

  // Order result
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  // Linked reservation (pre-filled from Reservations page → Convert)
  const [reservationId, setReservationId] = useState<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // ── USB keyboard-wedge scanner (Windows / Linux / macOS) ──
  // Works when no input is focused — the scanner just types fast into the global
  // keydown stream. The hook detects rapid-keystroke cadence and fires onScan.
  useKeyboardWedgeScanner({
    onScan: (value) => {
      const sku = value.toUpperCase();
      setSkuInput(sku);
      // Small delay lets React update skuInput before lookupSku reads it
      setTimeout(() => lookupSku(sku), 0);
    },
    // Disable while the camera scanner or PIN modal is open (they handle input)
    disabled: showCamera || pinModal || !!completedOrder,
  });

  // ── Smart Defaults ──
  const { data: smartDefaults } = useQuery({
    queryKey: ['pos-smart-defaults', user?.id],
    queryFn: () => posApi.smartDefaults(user!.id).then(r => r.data),
    enabled: !!user?.id,
    staleTime: 120_000,
  });

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); phoneRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); document.getElementById('checkout-btn')?.click(); }
      if (e.key === 'Escape') { clearCart(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Online/offline detection ──
  useEffect(() => {
    const online = () => setIsOffline(false);
    const offline = () => setIsOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    setIsOffline(!navigator.onLine);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  // ── Focus SKU input on mount
  useEffect(() => { skuRef.current?.focus(); }, []);

  // ── Persist cart across page navigations (restore on mount) ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
      } else {
        localStorage.removeItem('pos_cart');
      }
    } catch {}
  }, [cart]);

  // ── Reservation pre-fill (coming from Reservations → Convert →) ────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = sessionStorage.getItem('pos_reservation_prefill');
        if (!raw) return;
        sessionStorage.removeItem('pos_reservation_prefill');
        try { localStorage.removeItem('pos_cart'); } catch {}
        const prefill = JSON.parse(raw);

        setReservationId(prefill.reservationId ?? null);
        setCart([]);  // clear any restored cart

        // Customer info
        if (prefill.customerPhone) setPhoneInput(prefill.customerPhone);
        if (!prefill.customerId && prefill.customerName) {
          setWalkInName(prefill.customerName.trim());
        }
        // Try to resolve registered customer
        if (prefill.customerPhone) {
          try {
            const res = await customersApi.getByPhone(prefill.customerPhone);
            setCustomer(res.data);
          } catch {
            // Walk-in or not found — walkInName already set above
          }
        }

        // Add product to cart
        if (prefill.productSku) {
          try {
            const invRes = await inventoryApi.getBySku(prefill.productSku.toUpperCase());
            const inv = invRes.data;
            let productName = prefill.productName ?? prefill.productSku;
            let unitPrice = Number(prefill.unitPrice ?? 0);
            if (inv?.productId) {
              try {
                const prodRes = await productsApi.get(inv.productId);
                const prod = prodRes.data;
                productName = prod?.name ?? productName;
                unitPrice = unitPrice || Number(prod?.sellingPrice ?? 0);
              } catch {}
            }
            setCart([{
              inventoryId: inv.id,
              productId: inv.productId,
              sku: inv.sku ?? prefill.productSku,
              name: productName,
              unitPrice,
              quantity: Number(prefill.quantity) || 1,
              discountType: 'none' as const,
              discountValue: 0,
              imeiNumber: inv.imeiNumber,
            }]);
            toast.success(`Reservation loaded — ${productName} ×${prefill.quantity ?? 1}`);
          } catch {
            toast.error('Could not load reservation product into cart');
          }
        }
      } catch {}
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { subtotal, itemsDiscount, manualDiscount, loyaltyDiscount, totalDiscount, tax, total, pointsEarned } = calcTotals(cart, redeemPoints, manualDiscValue);
  const change = paymentMethod === 'CASH' ? (Number(cashTendered) || 0) - total : 0;

  // ── Scan / add item by SKU or barcode ──
  const lookupSku = useCallback(async (overrideSku?: string) => {
    const raw = (overrideSku ?? skuInput).trim();
    if (!raw) return;
    const sku = raw.toUpperCase();
    setSkuLoading(true);
    try {
      // 1. Try inventory lookup by SKU directly
      let inv: any = null;
      try {
        const res = await inventoryApi.getBySku(sku);
        inv = res.data;
      } catch {
        // Not found by SKU — may be a printed barcode value; try product barcode lookup
      }

      // 2. If SKU lookup failed, try product barcode → resolve SKU from product
      if (!inv) {
        try {
          const prodRes = await productsApi.getByBarcode(raw);
          const prod = prodRes.data;
          if (prod?.sku) {
            const invRes = await inventoryApi.getBySku(prod.sku.toUpperCase());
            inv = invRes.data;
          }
        } catch {
          // Neither SKU nor barcode found
        }
      }

      if (!inv) {
        toast.error(`Product not found for "${raw}"`);
        return;
      }
      if (inv.quantity <= 0) {
        toast.error(`SKU ${inv.sku} is out of stock`);
        return;
      }

      // Fetch product details for name + price
      let productName = inv.sku ?? sku;
      let unitPrice = 0;
      let productId = inv.productId;
      try {
        const prodRes = await productsApi.get(inv.productId);
        const prod = prodRes.data;
        productName = prod?.name ?? sku;
        unitPrice = Number(prod?.sellingPrice ?? prod?.salePrice ?? prod?.basePrice ?? 0);
        productId = prod?.id ?? inv.productId;
      } catch {
        // product service unreachable — fall back to SKU as name, price 0
      }

      const finalSku = (inv.sku ?? sku).toUpperCase();
      const existing = cart.find(i => i.sku === finalSku);
      const newQty = (existing?.quantity ?? 0) + 1;

      // ── Evaluate pricing rules for this product+qty ──
      let autoPct = 0; // percentage discount to auto-apply
      let requiresPin = false;
      let pinRuleNames: string[] = [];
      try {
        const priceRes = await pricingApi.evaluate(productId, newQty);
        const priceData = priceRes.data;
        if (priceData?.appliedRules?.length > 0 && unitPrice > 0) {
          autoPct = Math.round(((priceData.originalPrice - priceData.finalPrice) / priceData.originalPrice) * 10000) / 100;
          requiresPin = priceData.appliedRules.some((r: any) => r.requiresManagerPin);
          pinRuleNames = priceData.appliedRules.filter((r: any) => r.requiresManagerPin).map((r: any) => r.name);
        }
      } catch {
        // pricing service down — continue without automatic discount
      }

      // Helper that actually mutates the cart
      const addToCart = (discPct: number) => {
        if (existing) {
          setCart(prev => prev.map(i =>
            i.sku === finalSku
              ? { ...i, quantity: newQty, ...(discPct > 0 ? { discountType: 'pct' as const, discountValue: discPct } : {}) }
              : i,
          ));
          toast.success(`Added another ${finalSku}${discPct > 0 ? ` · ${discPct.toFixed(1)}% off` : ''}`);
        } else {
          setCart(prev => [...prev, {
            inventoryId: inv.id,
            productId: inv.productId,
            sku: inv.sku,
            name: productName,
            unitPrice,
            quantity: 1,
            discountType: discPct > 0 ? 'pct' : 'none',
            discountValue: discPct,
            imeiNumber: inv.imeiNumber,
          }]);
          toast.success(`Added ${productName}${discPct > 0 ? ` · ${discPct.toFixed(1)}% off applied` : ''}`);
        }
      };

      if (requiresPin) {
        // Gate: show PIN modal before adding with discount
        setPendingCartAdd({ ruleNames: pinRuleNames, discountPct: autoPct, onConfirm: () => addToCart(autoPct) });
        setPinModal(true);
        setPinInput('');
        setPinError('');
      } else {
        addToCart(autoPct);
      }

      if (!overrideSku) setSkuInput('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Product not found for "${raw}"`);
    } finally {
      setSkuLoading(false);
      skuRef.current?.focus();
    }
  }, [skuInput, cart]);

  // ── Customer lookup ──
  const lookupCustomer = async () => {
    const phone = phoneInput.trim();
    if (!phone) return;
    setCustomerLoading(true);
    try {
      const res = await customersApi.getByPhone(phone);
      setCustomer(res.data);
      toast.success(`Customer: ${customerName(res.data)} (${res.data.loyaltyPoints ?? 0} pts)`);
    } catch {
      toast.error('Customer not found');
      setCustomer(null);
    } finally {
      setCustomerLoading(false);
    }
  };

  const clearCustomer = () => {
    setCustomer(null);
    setPhoneInput('');
    setRedeemPoints(0);
  };

  // ── Cart helpers ──
  const updateQty = (sku: string, qty: number) => {
    if (qty <= 0) { removeItem(sku); return; }
    setCart(prev => prev.map(i => i.sku === sku ? { ...i, quantity: qty } : i));
  };
  const removeItem = (sku: string) => setCart(prev => prev.filter(i => i.sku !== sku));
  const updateDiscount = (sku: string, type: CartItem['discountType'], value: number) =>
    setCart(prev => prev.map(i => i.sku === sku ? { ...i, discountType: type, discountValue: value } : i));
  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setPhoneInput('');
    setWalkInName('');
    setCustomerSearch('');
    setSearchResults([]);
    setRedeemPoints(0);
    setOrderNote('');
    setCashTendered('');
    setManualDiscRaw('');
    setCompletedOrder(null);
    try { localStorage.removeItem('pos_cart'); } catch {}
    skuRef.current?.focus();
  };

  // ── Checkout ──
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Cart is empty');

      const payload = {
        cashierId: user?.id ?? '',
        customerId: customer?.id,
        walkInName: !customer && walkInName.trim() ? walkInName.trim() : undefined,
        loyaltyPointsToRedeem: customer ? redeemPoints : 0,
        paymentMethod,
        notes: orderNote,
        items: cart.map(i => ({
          inventoryId: i.inventoryId,
          productId: i.productId,
          productName: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: itemDiscountAmt(i),
          imei: i.imeiNumber,
        })),
        discountAmount: manualDiscount,
        totals: { subtotal, itemsDiscount, manualDiscount, loyaltyDiscount, tax, total, pointsEarned },
      };

      // If offline, queue locally
      if (isOffline || !navigator.onLine) {
        await enqueueOrder(payload);
        throw new Error('OFFLINE_QUEUED');
      }

      // Step 1: Create order
      const createRes = await ordersApi.create(payload);
      const order = createRes.data;
      // Step 2: Complete the order
      await ordersApi.complete(order.id);
      return order;
    },
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} completed!`);
      setCompletedOrder(order);
      try { localStorage.removeItem('pos_cart'); } catch {}
      // If this was a pre-filled reservation, mark it as converted
      if (reservationId) {
        reservationsApi.convertToOrder(reservationId, order.id).catch(() => {});
        setReservationId(null);
      }
    },
    onError: (err: any) => {
      if (err.message === 'OFFLINE_QUEUED') {
        toast('Offline — order saved locally. Will sync when back online.', { duration: 5000 });
        clearCart();
      } else {
        toast.error(err?.response?.data?.message ?? err.message ?? 'Checkout failed');
      }
    },
  });

  // ── Completed Screen ──
  if (completedOrder) {
    return (
      <div className="max-w-md mx-auto animate-fadeIn px-4 sm:px-0 py-8">
        <div className="card p-6 sm:p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="page-title mb-1">Sale Complete!</h2>
          <p className="text-slate-500 mb-6">{completedOrder.orderNumber}</p>
          <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Paid</span>
              <span className="font-bold text-slate-800">LKR {Number(completedOrder.totalAmt ?? completedOrder.totalAmount ?? 0).toLocaleString()}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Change Due</span>
                <span className="font-bold text-green-600">LKR {change.toLocaleString()}</span>
              </div>
            )}
            {(completedOrder.loyaltyPtsEarned ?? completedOrder.loyaltyPointsEarned) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Points Earned</span>
                <span className="font-semibold text-amber-600">+{completedOrder.loyaltyPtsEarned ?? completedOrder.loyaltyPointsEarned} pts</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={clearCart} className="btn-primary flex-1">
              New Sale
            </button>
            <button
              onClick={() => window.open(`/orders/${completedOrder.id}`, '_blank')}
              className="btn-secondary flex-1">
              View Invoice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-4 animate-fadeIn lg:h-[calc(100vh-3.5rem-3rem)]">
      {/* Offline warning banner */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2 text-sm text-amber-700 font-medium flex items-center gap-2">
          <strong>Offline Mode</strong> — orders will be queued locally and synced when reconnected. [F2] Customer · [F4] Checkout · [Esc] Clear
        </div>
      )}
      {/* Reservation pre-fill banner */}
      {reservationId && (
        <div className="bg-indigo-50 border border-indigo-300 rounded-xl px-4 py-2 text-sm text-indigo-800 font-medium flex items-center gap-2">
          <Tag className="w-4 h-4" /> <strong>Reservation loaded</strong> — customer and product pre-filled.
          Complete the sale below; the reservation will be auto-marked as converted.
          <button onClick={() => setReservationId(null)} className="ml-auto text-indigo-400 hover:text-indigo-700 font-bold text-base">×</button>
        </div>
      )}
      {!isOffline && !reservationId && (
        <div className="text-xs text-slate-400 text-right pr-1">
          ⌨ F2 = Customer · F4 = Checkout · Esc = Clear
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Left: SKU Scanner + Smart Defaults + Cart */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
        {/* SKU Input */}
        <div className="card p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={skuRef}
                type="text"
                value={skuInput}
                onChange={e => setSkuInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && lookupSku()}
                placeholder="Scan barcode or type SKU + Enter"
                className="input pl-9 font-mono tracking-wide"
                disabled={skuLoading}
              />
            </div>
            <button
              onClick={() => lookupSku()}
              disabled={skuLoading || !skuInput.trim()}
              className="btn-primary px-5">
              {skuLoading ? '…' : 'Add'}
            </button>
            <button
              onClick={() => setShowBrowser(v => !v)}
              title={showBrowser ? 'Hide product browser' : 'Browse inventory'}
              className={`px-4 rounded-xl border text-base font-medium transition-all flex items-center justify-center ${
                showBrowser
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 text-slate-600 hover:border-primary/50'
              }`}>
              <Package className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowCamera(v => !v); setShowBrowser(false); }}
              title={showCamera ? 'Close camera scanner' : 'Scan barcode with camera'}
              className={`px-4 rounded-xl border text-base font-medium transition-all flex items-center justify-center ${
                showCamera
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-400/60'
              }`}>
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera barcode scanner */}
        {showCamera && (
          <BarcodeScanner
            onScan={(value) => {
              const sku = value.toUpperCase();
              setSkuInput(sku);
              lookupSku(sku);
              setShowCamera(false);
            }}
            continuous={false}
            className="card p-4"
          />
        )}

        {/* Product Browser — searchable grid of all inventory items */}
        {showBrowser && (
          <ProductBrowserPanel onAddSku={sku => lookupSku(sku)} />
        )}

        {/* Smart Defaults Quick-add */}
        {smartDefaults?.topItems && smartDefaults.topItems.length > 0 && (
          <div className="card p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick Add (your top picks)</p>
            <div className="flex flex-wrap gap-2">
              {smartDefaults.topItems.map((item: any) => (
                <button
                  key={item.sku}
                  onClick={() => { setSkuInput(item.sku); setTimeout(() => lookupSku(), 50); }}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-primary/10 border border-slate-200 hover:border-primary/40 rounded-lg text-xs font-medium text-slate-700 transition-all">
                  {item.name}
                  <span className="text-slate-400 ml-1">LKR {Number(item.unitPrice).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cart */}
        <div className="card flex-1 min-h-[280px] lg:min-h-0 flex flex-col overflow-hidden">
          <div className="card-header">
            <h3 className="card-title">
              Cart <span className="text-slate-400 font-normal text-sm">({cart.length} items)</span>
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p className="text-sm">Scan a product to begin</p>
              </div>
            )}
            {cart.map(item => (
              <CartItemRow
                key={item.sku}
                item={item}
                onQtyChange={updateQty}
                onRemove={removeItem}
                onDiscountChange={updateDiscount}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Customer + Payment Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-4 lg:flex-shrink-0 overflow-y-auto lg:overflow-y-visible">

        {/* Customer Lookup */}
        <div className="card p-4">
          <p className="card-title text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer (Optional)</p>
          {!customer ? (
            <div className="space-y-2">
              {/* Phone lookup */}
              <div className="flex gap-2">
                <input
                  type="tel"
                  ref={phoneRef}
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupCustomer()}
                  placeholder="Phone number + Enter"
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={lookupCustomer}
                  disabled={customerLoading || !phoneInput.trim()}
                  className="btn-secondary text-xs px-3">
                  {customerLoading ? '…' : 'Find'}
                </button>
              </div>
              {/* Name / text search */}
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => {
                    const val = e.target.value;
                    setCustomerSearch(val);
                    setSearchResults([]);
                    if (searchDebounce) clearTimeout(searchDebounce);
                    if (val.trim().length < 2) return;
                    const t = setTimeout(async () => {
                      try {
                        const res = await customersApi.list({ search: val.trim(), limit: 8 });
                        setSearchResults(res.data?.data ?? res.data ?? []);
                      } catch { setSearchResults([]); }
                    }, 350);
                    setSearchDebounce(t);
                  }}
                  onBlur={() => setTimeout(() => setSearchResults([]), 200)}
                  placeholder="Search by name…"
                  className="input w-full text-sm"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                    {searchResults.map((c: Customer) => (
                      <button
                        key={c.id}
                        onMouseDown={() => {
                          setCustomer(c);
                          setCustomerSearch('');
                          setSearchResults([]);
                          toast.success(`Customer: ${customerName(c)} (${c.loyaltyPoints ?? 0} pts)`);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-primary/5 flex justify-between items-center gap-2 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{customerName(c)}</p>
                          <p className="text-xs text-slate-400">{c.phone}</p>
                        </div>
                        <div className="text-right">
                          <span className={`badge text-xs ${c.tier === 'PREMIUM' ? 'badge-amber' : 'badge-gray'}`}>{c.tier}</span>
                          <p className="text-xs text-amber-600 mt-0.5">{c.loyaltyPoints ?? 0} pts</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Walk-in name (optional) */}
              <input
                type="text"
                value={walkInName}
                onChange={e => setWalkInName(e.target.value)}
                placeholder="Walk-in name (optional)"
                className="input w-full text-sm"
              />
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{customerName(customer)}</p>
                  <p className="text-xs text-slate-500">{customer.phone}</p>
                  <span className={`badge text-xs mt-1 ${customer.tier === 'PREMIUM' ? 'badge-amber' : 'badge-gray'}`}>
                    {customer.tier}
                  </span>
                </div>
                <button onClick={clearCustomer} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-100">
                <p className="text-xs text-slate-500 mb-1.5">
                  Available: <strong>{customer.loyaltyPoints ?? 0} pts</strong> (LKR {(customer.loyaltyPoints ?? 0).toLocaleString()} value)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={customer.loyaltyPoints ?? 0}
                    value={redeemPoints}
                    onChange={e => setRedeemPoints(Math.min(Number(e.target.value), customer.loyaltyPoints ?? 0))}
                    className="input w-24 text-sm text-center"
                    placeholder="0"
                  />
                  <span className="text-xs text-slate-500">pts to redeem</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="card p-4 flex-1 flex flex-col">
          <p className="card-title text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Order Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>LKR {subtotal.toLocaleString()}</span>
            </div>
            {itemsDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Item Discounts</span>
                <span>− LKR {itemsDiscount.toLocaleString()}</span>
              </div>
            )}
            {/* Manual order-level discount */}
            <div className="pt-1 pb-1">
              <p className="text-xs text-slate-400 mb-1">Order Discount</p>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <button
                    onClick={() => setManualDiscType('flat')}
                    className={`px-2.5 py-1 transition ${manualDiscType === 'flat' ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}>
                    LKR
                  </button>
                  <button
                    onClick={() => setManualDiscType('pct')}
                    className={`px-2.5 py-1 transition ${manualDiscType === 'pct' ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}>
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  max={manualDiscType === 'pct' ? 100 : subtotal}
                  value={manualDiscRaw}
                  onChange={e => setManualDiscRaw(e.target.value)}
                  className="input flex-1 text-sm text-center py-1"
                  placeholder="0"
                />
                {manualDiscValue > 0 && (
                  <button onClick={() => setManualDiscRaw('')} className="text-xs text-red-400 hover:text-red-600">✕</button>
                )}
              </div>
              {manualDiscount > 0 && (
                <p className="text-xs text-green-600 mt-0.5">− LKR {manualDiscount.toLocaleString()}</p>
              )}
            </div>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Loyalty Points</span>
                <span>− LKR {loyaltyDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">VAT (5%)</span>
              <span>LKR {tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2 mt-1">
              <span>Total</span>
              <span className="text-primary">LKR {total.toLocaleString()}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-green-600 bg-green-50 rounded-lg px-2 py-1.5">
                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Total Savings</span>
                <span className="font-semibold">− LKR {totalDiscount.toLocaleString()}</span>
              </div>
            )}
            {customer && pointsEarned > 0 && (
              <div className="flex justify-between text-xs text-amber-600 mt-1">
                <span>Points to earn</span>
                <span>+{pointsEarned} pts</span>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="mt-4">
            <p className="card-title text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['CASH', 'CARD', 'TRANSFER'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    paymentMethod === method
                      ? 'bg-primary text-white border-primary'
                      : 'border-slate-200 text-slate-600 hover:border-primary/50'
                  }`}>
                  {method === 'CASH' ? <><Banknote className="w-3.5 h-3.5 inline mr-1" />{method}</> : method === 'CARD' ? <><CreditCard className="w-3.5 h-3.5 inline mr-1" />{method}</> : <><Building2 className="w-3.5 h-3.5 inline mr-1" />{method}</>}
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered */}
          {paymentMethod === 'CASH' && (
            <div className="mt-3">
              <label className="label text-xs">Cash Tendered</label>
              <input
                type="number"
                value={cashTendered}
                onChange={e => setCashTendered(e.target.value)}
                className="input text-sm"
                placeholder={`Min: ${total.toLocaleString()}`}
              />
              {change >= 0 && cashTendered && (
                <p className="text-xs text-green-600 mt-1 font-semibold">
                  Change: LKR {change.toLocaleString()}
                </p>
              )}
              {change < 0 && cashTendered && (
                <p className="text-xs text-red-500 mt-1">Insufficient cash tendered</p>
              )}
            </div>
          )}

          {/* Note */}
          <div className="mt-3">
            <label className="label text-xs">Note (optional)</label>
            <input type="text" value={orderNote} onChange={e => setOrderNote(e.target.value)}
              className="input text-sm" placeholder="e.g. Invoice to company…" />
          </div>

          <div className="mt-auto pt-4">
            <button
              id="checkout-btn"
              onClick={() => checkoutMutation.mutate()}
              disabled={
                cart.length === 0 ||
                checkoutMutation.isPending ||
                (paymentMethod === 'CASH' && cashTendered !== '' && change < 0)
              }
              className="btn-accent w-full py-3 text-base font-bold">
              {checkoutMutation.isPending
                ? 'Processing…'
                : isOffline
                ? `Queue Sale · LKR ${total.toLocaleString()}`
                : `✓ Complete Sale · LKR ${total.toLocaleString()}`}
            </button>
            <button onClick={clearCart} className="btn-secondary w-full mt-2 text-xs">
              Cancel / New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

      {/* ── Manager PIN Modal ─────────────────────────────────────────────────── */}
      {pinModal && pendingCartAdd && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-hd">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <LockKeyhole className="w-5 h-5 text-slate-500" />
                </div>
                <h2 className="modal-title">Manager Approval</h2>
              </div>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{pendingCartAdd!.ruleNames.join(', ')}</span>
                {' '}requires manager authorisation to apply.
                {pendingCartAdd!.discountPct > 0 && (
                  <span className="block font-semibold text-green-700 mt-1">
                    {pendingCartAdd!.discountPct.toFixed(1)}% discount
                  </span>
                )}
              </p>
              <input
                type="password"
                maxLength={8}
                autoFocus
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(''); }}
                onKeyDown={async e => {
                  if (e.key !== 'Enter') return;
                  setPinValidating(true);
                  try {
                    const res = await pricingApi.validatePin(pinInput);
                    if (res.data?.valid) {
                      pendingCartAdd!.onConfirm();
                      setPinModal(false); setPendingCartAdd(null); setPinInput(''); setPinError('');
                      toast.success('Manager approved — discount applied');
                    } else {
                      setPinError('Incorrect PIN. Try again.'); setPinInput('');
                    }
                  } catch { setPinError('Could not validate PIN.'); }
                  finally { setPinValidating(false); }
                }}
                placeholder="Enter manager PIN"
                className="input text-center text-lg tracking-widest font-mono"
              />
              {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}
            </div>
            <div className="modal-ft">
              <button
                onClick={() => {
                  setPinModal(false); setPendingCartAdd(null); setPinInput(''); setPinError('');
                  // Item is NOT added when manager cancels
                  toast('Discount cancelled — item not added', { icon: 'ℹ️' });
                }}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                disabled={pinValidating || pinInput.length < 4}
                onClick={async () => {
                  setPinValidating(true);
                  try {
                    const res = await pricingApi.validatePin(pinInput);
                    if (res.data?.valid) {
                      pendingCartAdd!.onConfirm();
                      setPinModal(false); setPendingCartAdd(null); setPinInput(''); setPinError('');
                      toast.success('Manager approved — discount applied');
                    } else {
                      setPinError('Incorrect PIN. Try again.'); setPinInput('');
                    }
                  } catch { setPinError('Could not validate PIN.'); }
                  finally { setPinValidating(false); }
                }}
                className="btn-primary flex-1">
                {pinValidating ? 'Checking…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
