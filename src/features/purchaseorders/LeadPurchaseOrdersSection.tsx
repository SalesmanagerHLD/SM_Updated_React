import { useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { usePurchaseOrders } from "../../api/purchaseOrdersApi";
import { parseApiError } from "../../api/errorHelpers";
import { PurchaseOrderStatusChip } from "./PurchaseOrderStatusChip";
import { PurchaseOrderFormDialog } from "./PurchaseOrderFormDialog";

/** The "Purchase orders" panel of the lead page: this lead's POs plus an "Add PO" button.
 * Only rendered for organizations with the INVOICING entitlement. */
export function LeadPurchaseOrdersSection({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, error } = usePurchaseOrders({ leadId, size: 100 });
  const rows = data?.content ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Purchase orders</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add PO
        </Button>
      </Stack>

      {isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={24} /></Box>}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {data && rows.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No purchase orders yet. Add one when the customer sends their PO.
        </Typography>
      )}
      {rows.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PO #</TableCell>
                <TableCell>PO date</TableCell>
                <TableCell align="right">Grand total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((po) => (
                <TableRow key={po.id} hover sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                  <TableCell>{po.poNumber}</TableCell>
                  <TableCell>{dayjs(po.poDate).format("DD MMM YYYY")}</TableCell>
                  <TableCell align="right">{po.grandTotal}</TableCell>
                  <TableCell><PurchaseOrderStatusChip status={po.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PurchaseOrderFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        leadId={leadId}
        onSaved={(po) => navigate(`/app/purchase-orders/${po.id}`)}
      />
    </Paper>
  );
}
