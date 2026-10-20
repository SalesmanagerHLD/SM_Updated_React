import { Chip } from "@mui/material";
import type { PurchaseOrderStatus } from "../../api/purchaseOrdersApi";
import { PO_STATUS_COLORS, PO_STATUS_LABELS } from "../../api/purchaseOrdersApi";

export function PurchaseOrderStatusChip({ status }: { status: PurchaseOrderStatus }) {
  return <Chip size="small" label={PO_STATUS_LABELS[status]} color={PO_STATUS_COLORS[status]} />;
}
