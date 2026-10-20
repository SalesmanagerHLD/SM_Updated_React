import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  useAcceptPurchaseOrder,
  useCancelPurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrderAttachments,
  useUploadPurchaseOrderAttachment,
} from "../../api/purchaseOrdersApi";
import { downloadLeadAttachment } from "../../api/attachmentsApi";
import { parseApiError } from "../../api/errorHelpers";
import { PurchaseOrderStatusChip } from "./PurchaseOrderStatusChip";
import { PurchaseOrderFormDialog } from "./PurchaseOrderFormDialog";

const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partly paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading, isError, error } = usePurchaseOrder(id);
  const { data: attachments } = usePurchaseOrderAttachments(id);
  const acceptMutation = useAcceptPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const uploadMutation = useUploadPurchaseOrderAttachment();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !po) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {isError ? parseApiError(error).message : "Purchase order not found."}
      </Alert>
    );
  }

  const canEdit = po.status === "RECEIVED" || po.status === "ACCEPTED";
  const canBill = po.status === "ACCEPTED" || po.status === "PARTLY_BILLED";
  const hasRemaining = po.lineItems.some((l) => l.quantityRemaining > 0);
  const interState = po.igstTotal > 0;

  const handleAccept = async () => {
    setActionError(null);
    try {
      await acceptMutation.mutateAsync(po.id);
    } catch (err) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({ id: po.id, reason: cancelReason.trim() });
      setCancelOpen(false);
      setCancelReason("");
    } catch (err) {
      setCancelOpen(false);
      setActionError(parseApiError(err).message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setActionError(null);
    try {
      await uploadMutation.mutateAsync({ id: po.id, file });
    } catch (err) {
      setActionError(parseApiError(err).message);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h5">PO {po.poNumber}</Typography>
            <PurchaseOrderStatusChip status={po.status} />
            {po.hasPriceDifference && (
              <Tooltip title="One or more lines are priced differently from the linked quotation">
                <Chip size="small" color="warning" variant="outlined" icon={<WarningAmberIcon />}
                  label="Price differs from quotation" />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {po.customerName} ·{" "}
            <Link component="button" variant="body2" onClick={() => navigate(`/app/leads/${po.leadId}`)}>
              View lead
            </Link>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {canEdit && (
            <Button startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>Edit</Button>
          )}
          {po.status === "RECEIVED" && (
            <Button variant="outlined" startIcon={<CheckCircleIcon />} onClick={handleAccept}
              disabled={acceptMutation.isPending}>
              Accept PO
            </Button>
          )}
          {canBill && (
            <Tooltip title={hasRemaining ? "" : "Every line is already fully billed"}>
              <span>
                <Button variant="contained" startIcon={<ReceiptLongIcon />} disabled={!hasRemaining}
                  onClick={() => navigate(`/app/invoices/new?poId=${po.id}`)}>
                  Create invoice from PO
                </Button>
              </span>
            </Tooltip>
          )}
          {po.status !== "CANCELLED" && (
            <Button color="error" startIcon={<CancelIcon />} onClick={() => setCancelOpen(true)}>
              Cancel PO
            </Button>
          )}
        </Stack>
      </Stack>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
      )}
      {po.status === "RECEIVED" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Accept this purchase order to start billing it.
        </Alert>
      )}
      {po.status === "CANCELLED" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Cancelled{po.cancelledAt ? ` on ${dayjs(po.cancelledAt).format("DD MMM YYYY")}` : ""}
          {po.cancelReason ? `: ${po.cancelReason}` : ""}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={4} sx={{ flexWrap: "wrap", rowGap: 2 }}>
          <Field label="PO date" value={dayjs(po.poDate).format("DD MMM YYYY")} />
          <Field label="Delivery date" value={po.deliveryDate ? dayjs(po.deliveryDate).format("DD MMM YYYY") : "-"} />
          <Field label="Payment terms" value={po.paymentTermsDays != null ? `${po.paymentTermsDays} days` : "-"} />
          <Field label="GSTIN" value={po.customerGstin ?? "-"} />
          <Field label="Grand total" value={money(po.grandTotal)} />
        </Stack>
        {(po.billingAddress || po.shippingAddress) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
              <Field label="Billing address" value={po.billingAddress ?? "-"} />
              <Field label="Shipping address" value={po.shippingAddress ?? "-"} />
            </Stack>
          </>
        )}
        {po.notes && (
          <>
            <Divider sx={{ my: 2 }} />
            <Field label="Notes" value={po.notes} />
          </>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Lines</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>HSN/SAC</TableCell>
                <TableCell align="right">Ordered</TableCell>
                <TableCell align="right">Billed</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Tax %</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {po.lineItems.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.description}
                    {line.priceDiffersFromQuotation && line.quotationRate != null && (
                      <Chip size="small" color="warning" variant="outlined" sx={{ ml: 1 }}
                        label={`Quoted ${money(line.quotationRate)}`} />
                    )}
                  </TableCell>
                  <TableCell>{line.hsnSac ?? "-"}</TableCell>
                  <TableCell align="right">{qty(line.quantityOrdered)}{line.unit ? ` ${line.unit}` : ""}</TableCell>
                  <TableCell align="right">{qty(line.quantityBilled)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color={line.quantityRemaining > 0 ? "text.primary" : "success.main"}
                      sx={{ fontWeight: 600 }}>
                      {qty(Math.max(line.quantityRemaining, 0))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{money(line.rate)}</TableCell>
                  <TableCell align="right">{line.taxRatePercent}</TableCell>
                  <TableCell align="right">{money(line.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack spacing={0.25} sx={{ alignItems: "flex-end", mt: 2 }}>
          <Typography variant="body2">Taxable amount: {money(po.taxableTotal)}</Typography>
          {interState ? (
            <Typography variant="body2">IGST: {money(po.igstTotal)}</Typography>
          ) : (
            <>
              <Typography variant="body2">CGST: {money(po.cgstTotal)}</Typography>
              <Typography variant="body2">SGST: {money(po.sgstTotal)}</Typography>
            </>
          )}
          <Typography variant="subtitle1">Grand total: {money(po.grandTotal)}</Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Invoices against this PO</Typography>
        {po.invoices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No invoices yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {po.invoices.map((inv) => (
                  <TableRow key={inv.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/app/invoices/${inv.id}`)}>
                    <TableCell>
                      {inv.invoiceNumber}
                      {inv.poOverrideReason && (
                        <Tooltip title={`Admin override: ${inv.poOverrideReason}`}>
                          <Chip size="small" color="warning" variant="outlined" sx={{ ml: 1 }} label="Over-billed" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{dayjs(inv.invoiceDate).format("DD MMM YYYY")}</TableCell>
                    <TableCell>{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</TableCell>
                    <TableCell align="right">{money(inv.grandTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="subtitle1">Customer's PO document</Typography>
          <Button size="small" component="label" startIcon={<UploadFileIcon />} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Stack>
        {(attachments ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">No document uploaded.</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
            {(attachments ?? []).map((a) => (
              <Button key={a.id} size="small" onClick={() => void downloadLeadAttachment(a)}>
                {a.fileName} · {dayjs(a.createdAt).format("DD MMM YYYY")}
              </Button>
            ))}
          </Stack>
        )}
      </Paper>

      <PurchaseOrderFormDialog open={editOpen} onClose={() => setEditOpen(false)} purchaseOrder={po} />

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Cancel purchase order {po.poNumber}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            A cancelled purchase order can't be billed. If it has an active invoice, cancel that invoice first.
          </Typography>
          <TextField
            label="Reason"
            fullWidth
            required
            multiline
            minRows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Keep PO</Button>
          <Button color="error" variant="contained" onClick={handleCancel}
            disabled={!cancelReason.trim() || cancelMutation.isPending}>
            Cancel PO
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{value}</Typography>
    </Box>
  );
}
