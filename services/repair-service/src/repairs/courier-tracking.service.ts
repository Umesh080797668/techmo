import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService }  from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Courier Tracking Service — Repair Service
 * ===========================================
 * Integrates with free/open courier tracking APIs to surface real-time
 * shipment status for supplier return packages and device couriers.
 *
 * Supported carriers (free tiers, no API key required for basic tracking):
 *   - DHL Express    : GET https://api-test.dhl.com/track/shipments?trackingNumber=
 *   - Sri Lanka Post : (scrape-based via n8n / Browserless — no official API)
 *   - FedEx          : requires account — optional
 *   - 17TRACK / track17: free tier, covers 1200+ carriers globally (recommended)
 *
 * Integration strategy:
 *   1. Store `courierTrackingNumber` + `courierCarrier` on RepairTicket
 *   2. This service polls the relevant API and caches result in Redis (TTL 30 min)
 *   3. Admin UI component pulls from this endpoint — no direct external calls from browser
 *
 * Prisma additions (repair-service schema):
 *   model RepairTicket {
 *     ...existing fields...
 *     courierTrackingNumber  String?
 *     courierCarrier         String?   // 'dhl' | 'slpost' | '17track' | 'fedex'
 *     courierStatus          String?   // last known status text
 *     courierUpdatedAt       DateTime?
 *   }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackingEvent {
  timestamp:   string;
  location:    string;
  description: string;
  status?:     string;
}

export interface TrackingResult {
  trackingNumber: string;
  carrier:        string;
  status:         string;   // 'IN_TRANSIT' | 'DELIVERED' | 'EXCEPTION' | 'PENDING'
  estimatedDelivery?: string;
  events:         TrackingEvent[];
  lastUpdated:    string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CourierTrackingService {
  private readonly logger = new Logger(CourierTrackingService.name);

  // Simple in-memory cache to avoid hammering external APIs (TTL: 30 min)
  private readonly cache = new Map<string, { data: TrackingResult; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(private readonly http: HttpService) {}

  async track(trackingNumber: string, carrier: string): Promise<TrackingResult> {
    const cacheKey = `${carrier}:${trackingNumber}`;
    const cached   = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let result: TrackingResult;

    switch (carrier.toLowerCase()) {
      case 'dhl':
        result = await this.trackDhl(trackingNumber);
        break;
      case '17track':
        result = await this.track17Track(trackingNumber);
        break;
      case 'slpost':
        result = await this.trackSlPost(trackingNumber);
        break;
      default:
        // Fall back to 17TRACK which covers 1200+ carriers
        result = await this.track17Track(trackingNumber);
    }

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return result;
  }

  // ── DHL Express ──────────────────────────────────────────────────────────

  private async trackDhl(trackingNumber: string): Promise<TrackingResult> {
    const dhlApiKey = process.env.DHL_API_KEY ?? '';

    try {
      const { data } = await firstValueFrom(
        this.http.get(`https://api-test.dhl.com/track/shipments`, {
          params:  { trackingNumber },
          headers: { 'DHL-API-Key': dhlApiKey },
          timeout: 8000,
        }),
      );

      const shipment = data.shipments?.[0];
      if (!shipment) throw new Error('No shipment data');

      const events: TrackingEvent[] = (shipment.events ?? []).map((e: Record<string, unknown>) => ({
        timestamp:   e.timestamp as string,
        location:    ((e.location as Record<string, unknown>)?.address as Record<string, unknown>)?.addressLocality as string ?? '',
        description: e.description as string,
        status:      e.status as string,
      }));

      return {
        trackingNumber,
        carrier:            'dhl',
        status:             this.mapDhlStatus(shipment.status?.status ?? ''),
        estimatedDelivery:  shipment.estimatedTimeOfDelivery,
        events,
        lastUpdated:        new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`DHL tracking failed for ${trackingNumber}: ${(err as Error).message}`);
      return this.errorResult(trackingNumber, 'dhl');
    }
  }

  // ── 17TRACK (free tier — 100 req/day, covers 1200+ carriers) ─────────────

  private async track17Track(trackingNumber: string): Promise<TrackingResult> {
    const apiKey = process.env.TRACK17_API_KEY ?? '';

    try {
      // Register tracking number first (idempotent)
      await firstValueFrom(
        this.http.post(
          'https://api.17track.net/track/v2.2/register',
          [{ number: trackingNumber }],
          { headers: { '17token': apiKey }, timeout: 8000 },
        ),
      );

      // Fetch tracking info
      const { data } = await firstValueFrom(
        this.http.post(
          'https://api.17track.net/track/v2.2/gettrackinfo',
          [{ number: trackingNumber }],
          { headers: { '17token': apiKey }, timeout: 8000 },
        ),
      );

      const info   = data.data?.accepted?.[0];
      const track  = info?.track;
      const events = ((track?.tracking?.providers?.[0]?.events ?? []) as Record<string, unknown>[]).map((e) => ({
        timestamp:   e.TimeStamp as string,
        location:    e.Location as string ?? '',
        description: e.Description as string,
      }));

      return {
        trackingNumber,
        carrier:     info?.carrier?.name ?? '17track',
        status:      this.map17TrackStatus(track?.status ?? 0),
        events:      events.slice(0, 20),   // cap to 20 events
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`17TRACK failed for ${trackingNumber}: ${(err as Error).message}`);
      return this.errorResult(trackingNumber, '17track');
    }
  }

  // ── Sri Lanka Post (no official API — returns mock structure) ────────────

  private async trackSlPost(trackingNumber: string): Promise<TrackingResult> {
    // Sri Lanka Post EMS tracking format: EE123456789LK
    // SL Post has no public JSON API — scrape the tracking page directly.
    const trackUrl = `https://www.slpost.lk/tracking/?tn=${encodeURIComponent(trackingNumber)}`;
    this.logger.log(`Scraping SL Post tracking page for ${trackingNumber}`);

    try {
      const { data: html } = await firstValueFrom(
        this.http.get<string>(trackUrl, {
          timeout: 10_000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TechMo-Tracker/1.0)',
            'Accept':     'text/html,application/xhtml+xml',
          },
          responseType: 'text',
        }),
      );

      // Extract status line — SL Post puts it in a <td> adjacent to a "Status" label
      const statusMatch = html.match(/Status[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]{3,80})/i);
      const statusText  = statusMatch?.[1]?.trim() ?? '';

      // Extract all tracking events from HTML table rows (date | location | description)
      const events: TrackingEvent[] = [];
      const rowRegex  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const cellRegex = /<td[^>]*>([^<]*)<\/td>/gi;
      let rowMatch: RegExpExecArray | null;

      while ((rowMatch = rowRegex.exec(html)) !== null) {
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;
        cellRegex.lastIndex = 0;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          const text = cellMatch[1].trim();
          if (text) cells.push(text);
        }
        // Valid event row: at least 2 non-empty cells (date + description)
        if (cells.length >= 2) {
          events.push({
            timestamp:   cells[0],
            location:    cells.length >= 3 ? cells[1] : '',
            description: cells[cells.length - 1],
          });
        }
      }

      const normalizedStatus = statusText.toLowerCase().includes('delivered')
        ? 'DELIVERED'
        : /transit|dispatch|process|accept/i.test(statusText)
        ? 'IN_TRANSIT'
        : statusText
        ? 'IN_TRANSIT'
        : 'PENDING';

      return {
        trackingNumber,
        carrier:     'slpost',
        status:      normalizedStatus,
        events:      events.length > 0
          ? events.slice(0, 20)
          : [{ timestamp: new Date().toISOString(), location: '', description: statusText || `Track manually at: ${trackUrl}` }],
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`SL Post scrape failed for ${trackingNumber}: ${(err as Error).message}`);
      return this.errorResult(trackingNumber, 'slpost');
    }
  }

  // ── Status mappers ────────────────────────────────────────────────────────

  private mapDhlStatus(dhlStatus: string): string {
    const map: Record<string, string> = {
      'pre-transit': 'PENDING',
      'transit':     'IN_TRANSIT',
      'delivered':   'DELIVERED',
      'failure':     'EXCEPTION',
      'unknown':     'PENDING',
    };
    return map[dhlStatus.toLowerCase()] ?? 'IN_TRANSIT';
  }

  private map17TrackStatus(code: number): string {
    // 17TRACK status codes: 0=not found, 10=in transit, 20=out for delivery, 30=delivered, 40=exception
    if (code >= 30) return 'DELIVERED';
    if (code >= 40) return 'EXCEPTION';
    if (code >= 10) return 'IN_TRANSIT';
    return 'PENDING';
  }

  private errorResult(trackingNumber: string, carrier: string): TrackingResult {
    return {
      trackingNumber,
      carrier,
      status:      'PENDING',
      events:      [{ timestamp: new Date().toISOString(), location: '', description: 'Could not retrieve tracking info. Please try again later.' }],
      lastUpdated: new Date().toISOString(),
    };
  }
}
