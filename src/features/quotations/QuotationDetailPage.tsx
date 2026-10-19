import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { QuotationStatus } from "../../api/quotationsApi";
import {
  downloadQuotationPdf,
  previewQuotationPdf,
  useConvertQuotationToInvoice,
  useDeleteQuotationAttachment,
  useQuotation,
  useQuotationAttachments,
  useUpdateQuotationStatus,
  useUploadQuotationAttachment,
} from "../../api/quotationsApi";
import { parseApiError } from "../../api/errorHelpers";

const STATUS_COLORS: Record<QuotationStatus, "default" | "info" | "success" | "error" | "secondary"> = {
  DRAFT: "default",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "error",
  CONVERTED: "secondary",
};

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading, isError, error } = useQuotation(id);
  const updateStatusMutation = useUpdateQuotationStatus();
  const convertMutation = useConvertQuotationToInvoice();
  const { data: attachments } = useQuotationAttachments(id);
  const uploadMutation = useUploadQuotationAttachment();
  const deleteAttachmentMutation = useDeleteQuotationAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !quotation) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {isError ? parseApiError(error).message : "Quotation not found."}
      </Alert>
    );
  }

  const isIgst = (quotation.igstTotal ?? 0) > 0;
  const canEdit = quotation.status === "DRAFT" || quotation.status === "SENT";
  const canDecide = quotation.status === "SENT";
  const canConvert = quotation.status === "SENT" || quotation.status === "APPROVED";

  const handleDownloadPdf = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadQuotationPdf(quotation.id, quotation.quotationNumber);
    } catch (err) {
      setDownloadError(parseApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreviewPdf = async () => {
    setPreviewError(null);
    setPreviewing(true);
    const previewWindow = window.open("", "_blank");
    try {
      await previewQuotationPdf(quotation.id, previewWindow);
    } catch (err) {
      previewWindow?.close();
      setPreviewError(parseApiError(err).message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleDecide = async (status: "APPROVED" | "REJECTED") => {
    setActionError(null);
    try {
      await updateStatusMutation.mutateAsync({ id: quotation.id, status });
    } catch (err) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleConvert = async () => {
    setActionError(null);
    try {
      const invoice = await convertMutation.mutateAsync(quotation.id);
      navigate(`/app/invoices/${invoice.id}`);
    } catch (err) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setActionError(null);
    try {
      await uploadMutation.mutateAsync({ quotationId: quotation.id, file });
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/app/quotations")} sx={{ mb: 2 }}>
        Back to Quotations
      </Button>

      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}
      >
        <Box>
          <Typography variant="h5">{quotation.quotationNumber}</Typography>
          <Typography color="text.secondary">{dayjs(quotation.quotationDate).format("DD MMM YYYY")}</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Chip label={quotation.status} color={STATUS_COLORS[quotation.status]} />
          <Button variant="outlined" size="small" startIcon={<VisibilityIcon />} onClick={handlePreviewPdf} disabled={previewing}>
            {previewing ? "Opening..." : "Preview"}
          </Button>
          <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
          {canEdit && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/app/quotations/${quotation.id}/edit`)}
            >
              Edit
            </Button>
          )}
          {canDecide && (
            <>
              <Button variant="outlined" color="error" size="small" onClick={() => handleDecide("REJECTED")} disabled={updateStatusMutation.isPending}>
                Reject
              </Button>
              <Button variant="contained" color="success" size="small" onClick={() => handleDecide("APPROVED")} disabled={updateStatusMutation.isPending}>
                Approve
              </Button>
            </>
          )}
          {canConvert && (
            <Button variant="contained" size="small" onClick={handleConvert} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? "Converting..." : "Convert to Invoice"}
            </Button>
          )}
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
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {quotation.status === "CONVERTED" && quotation.convertedInvoiceId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Converted to invoice.{" "}
          <Button size="small" onClick={() => navigate(`/app/invoices/${quotation.convertedInvoiceId}`)}>
            View Invoice
          </Button>
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Customer
        </Typography>
        <Typography>{quotation.customerName}</Typography>
        {quotation.customerContactPerson && <Typography>{quotation.customerContactPerson}</Typography>}
        {quotation.customerDesignation && <Typography color="text.secondary">{quotation.customerDesignation}</Typography>}
        {quotation.customerPhone && <Typography color="text.secondary">{quotation.customerPhone}</Typography>}
        {quotation.customerEmail && <Typography color="text.secondary">{quotation.customerEmail}</Typography>}
        {quotation.customerBillingAddress && <Typography color="text.secondary">{quotation.customerBillingAddress}</Typography>}
        {quotation.customerGstin && <Typography color="text.secondary">GSTIN: {quotation.customerGstin}</Typography>}
      </Paper>

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
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotation.lineItems.map((line) => (
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
                <TableCell align="right">{line.lineTotal}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
          <Typography variant="body2">Sub Total: {quotation.subtotal}</Typography>
          <Typography variant="body2">Discount: {quotation.discountTotal}</Typography>
          <Typography variant="body2">Taxable Amount: {quotation.taxableAmount}</Typography>
          {isIgst ? (
            <Typography variant="body2">IGST: {quotation.igstTotal}</Typography>
          ) : (
            <>
              <Typography variant="body2">CGST: {quotation.cgstTotal}</Typography>
              <Typography variant="body2">SGST: {quotation.sgstTotal}</Typography>
            </>
          )}
          <Typography variant="subtitle1">Grand Total: {quotation.grandTotal}</Typography>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        {quotation.quotationNotes && (
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Quotation Notes
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {quotation.quotationNotes}
            </Typography>
          </Paper>
        )}
        {quotation.termsAndConditions && (
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Terms &amp; Conditions
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {quotation.termsAndConditions}
            </Typography>
          </Paper>
        )}
      </Stack>

      {quotation.internalNote && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Internal Note
          </Typography>
          <Typography color="text.secondary">{quotation.internalNote}</Typography>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="subtitle1">Attachments</Typography>
          <Button size="small" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
        </Stack>
        {(!attachments || attachments.length === 0) && (
          <Typography color="text.secondary">No attachments yet.</Typography>
        )}
        {attachments && attachments.length > 0 && (
          <List dense>
            {attachments.map((attachment) => (
              <ListItem
                key={attachment.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => deleteAttachmentMutation.mutate({ attachmentId: attachment.id, quotationId: quotation.id })}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={attachment.fileName}
                  secondary={`${(attachment.fileSize / 1024).toFixed(0)} KB`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
