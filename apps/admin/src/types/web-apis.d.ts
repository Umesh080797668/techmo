/**
 * web-apis.d.ts
 * -------------
 * TypeScript ambient declarations for experimental browser APIs that are
 * not yet part of the standard TypeScript `lib.dom.d.ts`:
 *
 *   • Shape Detection API  – BarcodeDetector  (Chrome 83+, Edge 83+)
 *   • Web Serial API       – SerialPort       (Chrome 89+, Edge 89+)
 *
 * These are globals available at runtime but absent from TypeScript's
 * bundled DOM lib until the specs are further standardised.
 */

// ─── Shape Detection API (Barcode) ───────────────────────────────────────────

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<DetectedBarcode[]>;
}

// ─── Web Serial API ───────────────────────────────────────────────────────────

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort extends EventTarget {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  addEventListener(type: 'connect' | 'disconnect', listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface Navigator {
  readonly serial: Serial;
}
