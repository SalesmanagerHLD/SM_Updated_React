/**
 * GST places a sale in one of two buckets: intra-state (supplier state == place of supply)
 * splits the rate into CGST + SGST, inter-state charges the full rate as IGST. Unknown on
 * either side falls back to intra-state, matching what the backend did before IGST existed.
 */
export function isInterState(
  supplierStateId: string | null | undefined,
  supplyStateId: string | null | undefined,
): boolean {
  return !!supplierStateId && !!supplyStateId && supplierStateId !== supplyStateId;
}

export interface TaxSplit {
  cgst: number;
  sgst: number;
  igst: number;
}

export function splitTax(taxable: number, taxRatePercent: number, interState: boolean): TaxSplit {
  const tax = taxable * (taxRatePercent / 100);
  return interState ? { cgst: 0, sgst: 0, igst: tax } : { cgst: tax / 2, sgst: tax / 2, igst: 0 };
}

/** Rounds a total to the nearest rupee and returns the adjustment, as printed on GST invoices. */
export function roundToRupee(total: number): { rounded: number; roundOff: number } {
  const rounded = Math.round(total);
  return { rounded, roundOff: rounded - total };
}
