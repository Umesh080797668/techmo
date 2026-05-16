'use client';

/**
 * ThermalLabel — CSS @media print precision-aligned thermal label generator.
 *
 * Generates tiny part labels (e.g. 38×25 mm) directly from the browser,
 * styled for thermal / label printers. No external labeling software needed.
 *
 * Label layouts supported:
 *   - "part"    : SKU barcode + part name + price (for accessories / IC chips)
 *   - "repair"  : Ticket ref QR + device + customer name
 *   - "asset"   : IMEI/serial + product name + warranty date
 *
 * Usage:
 *   <ThermalLabel
 *     type="part"
 *     data={{ sku: 'LCD-SGS23', name: 'Samsung S23 LCD Assembly', price: 'LKR 18,500', barcode: '695151234567' }}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import { MapPin, Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ───────────────────────────────────────────────────────────────────

type LabelType = 'part' | 'repair' | 'asset';

interface PartLabelData {
  type: 'part';
  sku: string;
  name: string;
  price?: string;
  barcode?: string;     // EAN-13 / Code-128 numeric string
  location?: string;    // Shelf / bin
}

interface RepairLabelData {
  type: 'repair';
  ticketRef: string;
  device: string;
  customerName: string;
  status: string;
  qrContent: string;    // URL to /track/[ref]
}

interface AssetLabelData {
  type: 'asset';
  imei: string;
  productName: string;
  purchaseDate: string;
  warrantyUntil: string;
}

type LabelData = PartLabelData | RepairLabelData | AssetLabelData;

interface ThermalLabelProps {
  data: LabelData;
  copies?: number;
  /** Label size in mm — defaults to 38×25 mm (standard thermal label) */
  widthMm?: number;
  heightMm?: number;
  className?: string;
}

// ─── Barcode renderer — JsBarcode (Code-128, print-accurate SVG) ─────────────

function BarcodeRenderer({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format:       'CODE128',
          width:        1.5,
          height:       28,
          displayValue: true,
          fontSize:     8,
          margin:       2,
          background:   '#ffffff',
          lineColor:    '#000000',
        });
      } catch {
        // Invalid barcode value — silently render nothing
      }
    }
  }, [value]);

  if (!value) return null;
  return <svg ref={svgRef} />;
}

// ─── Individual label renders ─────────────────────────────────────────────────

function PartLabel({ data }: { data: PartLabelData }) {
  return (
    <div className="flex flex-col justify-between h-full p-1">
      <div>
        <p className="text-[7px] font-bold leading-none truncate">{data.name}</p>
        {data.location && (
          <p className="text-[5.5px] text-gray-600 mt-0.5 flex items-center gap-0.5"><MapPin className="w-[5px] h-[5px]" /> {data.location}</p>
        )}
      </div>
      {data.barcode && (
        <div className="flex justify-center my-0.5">
          <BarcodeRenderer value={data.barcode} />
        </div>
      )}
      <div className="flex justify-between items-end">
        <span className="text-[6px] font-mono text-gray-700">{data.sku}</span>
        {data.price && (
          <span className="text-[7px] font-bold">{data.price}</span>
        )}
      </div>
    </div>
  );
}

function RepairLabel({ data }: { data: RepairLabelData }) {
  return (
    <div className="flex flex-col justify-between h-full p-1">
      <p className="text-[7px] font-bold"># {data.ticketRef}</p>
      <p className="text-[6px] truncate">{data.device}</p>
      <p className="text-[5.5px] text-gray-600 truncate">{data.customerName}</p>
      <div className="flex justify-between items-end">
        <span
          className="text-[5px] bg-gray-100 border border-gray-300 px-0.5 rounded"
          style={{ fontSize: '5px' }}
        >
          {data.status}
        </span>
        <QRCodeSVG
          value={data.qrContent}
          size={32}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
    </div>
  );
}

function AssetLabel({ data }: { data: AssetLabelData }) {
  return (
    <div className="flex flex-col justify-between h-full p-1">
      <p className="text-[7px] font-bold leading-none truncate">{data.productName}</p>
      <p className="text-[5.5px] font-mono">IMEI: {data.imei}</p>
      <div className="flex justify-between text-[5px] text-gray-600">
        <span>Sold: {data.purchaseDate}</span>
        <span>War: {data.warrantyUntil}</span>
      </div>
      <div className="flex justify-center">
        <BarcodeRenderer value={data.imei.replace(/\D/g, '')} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ThermalLabel({
  data,
  copies = 1,
  widthMm = 38,
  heightMm = 25,
  className = '',
}: ThermalLabelProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;

    const labelHtml = printRef.current.innerHTML;

    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>TechMo Label Print</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; }

    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
    }

    @media print {
      body { width: ${widthMm}mm; height: ${heightMm}mm; }
      .label-wrapper {
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
        page-break-after: always;
      }
    }

    .label-wrapper {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      border: 0.5px solid #999;
      overflow: hidden;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: white;
    }
  </style>
</head>
<body>
  ${Array.from({ length: copies }, () => `<div class="label-wrapper">${labelHtml}</div>`).join('')}
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  const labelStyle: React.CSSProperties = {
    width:      `${widthMm * 3.7795}px`,   // mm → px at 96 dpi
    height:     `${heightMm * 3.7795}px`,
    border:     '1px solid #d1d5db',
    background: 'white',
    overflow:   'hidden',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  };

  return (
    <div className={`flex flex-col gap-3 items-start ${className}`}>
      {/* Preview */}
      <div>
        <p className="text-xs text-zinc-500 mb-1">
          Label preview ({widthMm}×{heightMm} mm)
        </p>
        <div ref={printRef} style={labelStyle}>
          {data.type === 'part'   && <PartLabel   data={data} />}
          {data.type === 'repair' && <RepairLabel data={data} />}
          {data.type === 'asset'  && <AssetLabel  data={data} />}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-zinc-400">Copies:</label>
        <input
          type="number"
          defaultValue={copies}
          min={1}
          max={50}
          className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          id="label-copies"
        />
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium
                     transition-colors flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" /> Print Label
        </button>
      </div>

      <p className="text-[10px] text-zinc-500">
        Tip: Set your thermal printer to {widthMm}×{heightMm} mm label size in printer settings.
      </p>
    </div>
  );
}
