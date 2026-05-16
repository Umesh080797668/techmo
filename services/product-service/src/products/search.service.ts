/**
 * Meilisearch integration service
 *
 * Section 5.4 – Global Search  (ENTERPRISE_ECOMMERCE_SYSTEM.md)
 *
 * Indexes managed by this service:
 *   • products   – ProductDocument
 *   • customers  – CustomerDocument  (proxied from loyalty-service data)
 *   • repairs    – RepairDocument    (proxied from repair-service data)
 *
 * Usage:
 *   await searchService.indexProduct(product);
 *   const hits = await searchService.search('iphone screen', ['products']);
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeiliSearch, Index, SearchResponse } from 'meilisearch';

// ── Document shapes ──────────────────────────────────────────────────────────

export interface ProductDocument {
  id:          string;
  name:        string;
  sku:         string;
  brand:       string;
  category:    string;
  barcode?:    string;
  sellingPrice: number;
  stockQty:    number;
  isActive:    boolean;
}

export interface CustomerDocument {
  id:        string;
  name:      string;
  email?:    string;
  phone:     string;
  loyaltyTier: string;
  points:    number;
}

export interface RepairDocument {
  id:          string;
  ticketNumber: string;
  customerName: string;
  deviceBrand: string;
  deviceModel: string;
  status:      string;
  createdAt:   string;
}

export type SearchableDocument = ProductDocument | CustomerDocument | RepairDocument;

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: MeiliSearch;

  constructor() {
    this.client = new MeiliSearch({
      host:   process.env.MEILISEARCH_HOST    ?? 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_API_KEY ?? '',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIndexes();
  }

  // ── Index management ──────────────────────────────────────────────────────

  private async ensureIndexes(): Promise<void> {
    const configs: Array<{ uid: string; primaryKey: string; searchableAttributes: string[]; filterableAttributes: string[] }> = [
      {
        uid:                   'products',
        primaryKey:            'id',
        searchableAttributes:  ['name', 'sku', 'brand', 'barcode', 'category'],
        filterableAttributes:  ['brand', 'category', 'isActive', 'stockQty'],
      },
      {
        uid:                   'customers',
        primaryKey:            'id',
        searchableAttributes:  ['name', 'email', 'phone'],
        filterableAttributes:  ['loyaltyTier'],
      },
      {
        uid:                   'repairs',
        primaryKey:            'id',
        searchableAttributes:  ['ticketNumber', 'customerName', 'deviceBrand', 'deviceModel'],
        filterableAttributes:  ['status'],
      },
    ];

    for (const cfg of configs) {
      try {
        await this.client.createIndex(cfg.uid, { primaryKey: cfg.primaryKey });
      } catch {
        // Index may already exist — that's fine
      }

      try {
        const idx = this.client.index(cfg.uid);
        await idx.updateSearchableAttributes(cfg.searchableAttributes);
        await idx.updateFilterableAttributes(cfg.filterableAttributes);
        await idx.updateSettings({ typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 } } });
      } catch (err) {
        this.logger.warn(`Could not update settings for index "${cfg.uid}": ${(err as Error).message}`);
      }
    }

    this.logger.log('Meilisearch indexes ensured');
  }

  // ── CRUD helpers ──────────────────────────────────────────────────────────

  async indexProduct(product: ProductDocument): Promise<void> {
    await this.upsert('products', product);
  }

  async indexCustomer(customer: CustomerDocument): Promise<void> {
    await this.upsert('customers', customer);
  }

  async indexRepair(repair: RepairDocument): Promise<void> {
    await this.upsert('repairs', repair);
  }

  async deleteProduct(id: string): Promise<void> {
    await this.client.index('products').deleteDocument(id);
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.client.index('customers').deleteDocument(id);
  }

  async deleteRepair(id: string): Promise<void> {
    await this.client.index('repairs').deleteDocument(id);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * Multi-index search across products, customers, and/or repairs.
   * Returns a map of indexUid → hits array.
   */
  async search(
    query: string,
    indexes: ('products' | 'customers' | 'repairs')[] = ['products', 'customers', 'repairs'],
    limit = 10,
  ): Promise<Record<string, SearchableDocument[]>> {
    const results: Record<string, SearchableDocument[]> = {};

    await Promise.all(
      indexes.map(async (uid) => {
        try {
          const res: SearchResponse<SearchableDocument> = await this.client
            .index(uid)
            .search(query, { limit, attributesToHighlight: ['*'] });
          results[uid] = res.hits;
        } catch (err) {
          this.logger.error(`Search error on index "${uid}": ${(err as Error).message}`);
          results[uid] = [];
        }
      }),
    );

    return results;
  }

  /**
   * Simple single-index search — returns hits directly.
   */
  async searchIndex<T = SearchableDocument>(
    index: string,
    query: string,
    limit = 10,
    filter?: string,
  ): Promise<T[]> {
    try {
      const res = await this.client.index(index).search<T>(query, {
        limit,
        ...(filter ? { filter } : {}),
      });
      return res.hits;
    } catch (err) {
      this.logger.error(`searchIndex error on "${index}": ${(err as Error).message}`);
      return [];
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async upsert(indexUid: string, document: SearchableDocument): Promise<void> {
    try {
      await this.client.index(indexUid).addDocuments([document]);
    } catch (err) {
      this.logger.error(`Meilisearch upsert failed [${indexUid}]: ${(err as Error).message}`);
    }
  }

  private getIndex(uid: string): Index {
    return this.client.index(uid);
  }
}
