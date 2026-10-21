import type { MasterDataType } from "../../api/masterDataApi";
import { MASTER_DATA_TYPES } from "../../api/masterDataApi";

/** Human-readable labels for each master data type, used for tabs and headings. */
export const MASTER_TYPE_LABELS: Record<MasterDataType, string> = {
  INDUSTRY: "Industry",
  CITY: "City",
  PRODUCT: "Product",
  BUSINESS_TYPE: "Business Type",
  DESIGNATION: "Designation",
  VISIT_PURPOSE: "Visit Purpose",
  NEXT_ACTION: "Next Action",
  LOST_REASON: "Lost Reason",
  INTEREST_LEVEL: "Interest Level",
  LEAD_SOURCE: "Lead Source",
  STATE: "State",
  INTEREST_REASON: "Interest Reason",
};

/** Tabs on the Masters screen. INTEREST_REASON is deliberately not a tab of its own: reasons are
 * managed inline, under the interest level they belong to (see InterestReasonsPanel). */
export const MASTER_TAB_TYPES: MasterDataType[] = MASTER_DATA_TYPES.filter((t) => t !== "INTEREST_REASON");

export const DEFAULT_MASTER_DATA_TYPE: MasterDataType = "INDUSTRY";

export function isMasterDataType(value: string | undefined): value is MasterDataType {
  return !!value && (MASTER_TAB_TYPES as readonly string[]).includes(value);
}
