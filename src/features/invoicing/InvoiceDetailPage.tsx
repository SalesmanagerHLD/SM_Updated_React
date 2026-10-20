import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import type { InvoiceStatus } from "../../api/invoicesApi";
import {
  downloadInvoicePdf,
  previewInvoicePdf,
  useInvoice,
  useUpdateInvoiceStatus,
} from "../../api/invoicesApi";
import { parseApiError } from "../../api/errorHelpers";

const STATUS_COLORS: Record<InvoiceStatus, "success" | "warning" | "info" | "error"> = {
  PAID: "success",
  UNPAID: "warning",
  PARTIALLY_PAID: "info",
  CANCELLED: "error",
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, isError, error } = useInvoice(id);
  const updateStatusMutation = useUpdateInvoiceStatus();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !invoice) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {isError ? parseApiError(error).message : "Quotation not found."}
      </Alert>
    );
  }

  const isIgst = (invoice.igstTotal ?? 0) > 0;

  const toggleStatus = () => {
    const nextStatus: InvoiceStatus = invoice.status === "PAID" ? "UNPAID" : "PAID";
    updateStatusMutation.mutate({ id: invoice.id, status: nextStatus });
  };

  const handleDownloadPdf = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
    } catch (err) {
      setDownloadError(parseApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreviewPdf = async () => {
    setPreviewError(null);
    setPreviewing(true);
    // Opened synchronously, right here in the click handler - see previewInvoicePdf's javadoc
    // comment for why this can't wait until after the fetch without risking a popup blocker.
    const previewWindow = window.open("", "_blank");
    try {
      await previewInvoicePdf(invoice.id, previewWindow);
    } catch (err) {
      previewWindow?.close();
      setPreviewError(parseApiError(err).message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/app/invoices")} sx={{ mb: 2 }}>
        Back to Invoices
      </Button>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5">{invoice.invoiceNumber}</Typography>
          <Typography color="text.secondary">
            {dayjs(invoice.invoiceDate).format("DD MMM YYYY")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip label={invoice.status} color={STATUS_COLORS[invoice.status]} />
          <Button
            variant="outlined"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={handlePreviewPdf}
            disabled={previewing}
          >
            {previewing ? "Opening..." : "Preview"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={toggleStatus}
            disabled={updateStatusMutation.isPending}
          >
            Mark as {invoice.status === "PAID" ? "Unpaid" : "Paid"}
          </Button>
        </Stack>
      </Stack>

      {previewError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPreviewError(null)}>
          {previewError}
        </Alert>
      )}

      {downloadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownloadError(null)}>
          {downloadError}
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Bill To
          </Typography>
          <Typography>{invoice.customerName}</Typography>
          {invoice.customerContactPerson && <Typography>{invoice.customerContactPerson}</Typography>}
          {invoice.customerPhone && <Typography color="text.secondary">{invoice.customerPhone}</Typography>}
          {invoice.customerEmail && <Typography color="text.secondary">{invoice.customerEmail}</Typography>}
          {invoice.customerAddress && <Typography color="text.secondary">{invoice.customerAddress}</Typography>}
          {invoice.customerGstin && (
            <Typography color="text.secondary">GSTIN: {invoice.customerGstin}</Typography>
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Ship To
          </Typography>
          <Typography>{invoice.shipToName ?? invoice.customerName}</Typography>
          {(invoice.shipToAddress ?? invoice.customerAddress) && (
            <Typography color="text.secondary">{invoice.shipToAddress ?? invoice.customerAddress}</Typography>
          )}
          {invoice.shipToGstin && <Typography color="text.secondary">GSTIN: {invoice.shipToGstin}</Typography>}
          <Divider sx={{ my: 1 }} />
          {invoice.dueDate && (
            <Typography color="text.secondary">Due: {dayjs(invoice.dueDate).format("DD MMM YYYY")}</Typography>
          )}
          {invoice.placeOfSupply && (
            <Typography color="text.secondary">Place of Supply: {invoice.placeOfSupply}</Typography>
          )}
          {invoice.poNumber && (
            <Typography color="text.secondary">
              Customer PO:{" "}
              {invoice.poId ? (
                <Link component="button" variant="body1" sx={{ verticalAlign: "baseline" }}
                  onClick={() => navigate(`/app/purchase-orders/${invoice.poId}`)}>
                  {invoice.poNumber}
                </Link>
              ) : (
                invoice.poNumber
              )}
              {invoice.poDate ? ` · ${dayjs(invoice.poDate).format("DD MMM YYYY")}` : ""}
            </Typography>
          )}
          {invoice.poOverrideReason && (
            <Typography color="warning.main" variant="body2">
              Billed past the PO quantity (admin override): {invoice.poOverrideReason}
            </Typography>
          )}
          <Typography color="text.secondary">Reverse Charge: {invoice.reverseCharge ? "Yes" : "No"}</Typography>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell>HSN/SAC</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Discount %</TableCell>
              {isIgst ? (
                <TableCell align="right">IGST</TableCell>
              ) : (
                <>
                  <TableCell align="right">CGST</TableCell>
                  <TableCell align="right">SGST</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lineItems.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableCell>{line.hsnSac ?? "-"}</TableCell>
                <TableCell align="right">{line.quantity}</TableCell>
                <TableCell align="right">{line.unitPrice}</TableCell>
                <TableCell align="right">{line.discountPercent}</TableCell>
                {isIgst ? (
                  <TableCell align="right">{line.lineIgstAmount}</TableCell>
                ) : (
                  <>
                    <TableCell align="right">{line.lineCgstAmount}</TableCell>
                    <TableCell align="right">{line.lineSgstAmount}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
          <Typography variant="body2">Subtotal: {invoice.subtotal}</Typography>
          {invoice.taxableAmount != null && (
            <Typography variant="body2">Taxable Amount: {invoice.taxableAmount}</Typography>
          )}
          {isIgst ? (
            <Typography variant="body2">IGST: {invoice.igstTotal}</Typography>
          ) : invoice.cgstTotal != null ? (
            <>
              <Typography variant="body2">CGST: {invoice.cgstTotal}</Typography>
              <Typography variant="body2">SGST: {invoice.sgstTotal}</Typography>
            </>
          ) : (
            <Typography variant="body2">Tax: {invoice.taxTotal}</Typography>
          )}
          {invoice.roundOff != null && invoice.roundOff !== 0 && (
            <Typography variant="body2">Round off: {invoice.roundOff}</Typography>
          )}
          <Typography variant="subtitle1">Grand Total: {invoice.grandTotal}</Typography>
        </Stack>
      </Paper>

      {invoice.notes && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Notes
          </Typography>
          <Typography color="text.secondary">{invoice.notes}</Typography>
        </Paper>
      )}
    </Box>
  );
}
