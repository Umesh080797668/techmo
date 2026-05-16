export class CreateBatteryEntryDto {
  /** ISO date string — when the battery was received into stock (defaults to now) */
  receivedAt?: string;
  /** ISO date string — manufacture date from supplier packaging */
  manufacturedAt?: string;
  /** Shelf life in days (default: 730 = 2 years) */
  shelfLifeDays?: number;
  /** Alert when this % of shelf life is consumed (default: 80) */
  alertFractionPct?: number;
  /** Supplier lot/batch number */
  batchNumber?: string;
  /** Rated capacity in mAh */
  ratedCapacityMah?: number;
  notes?: string;
}
