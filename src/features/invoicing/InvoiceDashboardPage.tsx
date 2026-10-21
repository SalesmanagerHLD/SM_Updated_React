import { useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PaidIcon from "@mui/icons-material/Paid";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { StatCard } from "../../components/StatCard";
import { useQuotationInvoiceSummary } from "../../api/reportingApi";
import type { Quotation, QuotationStatus } from "../../api/quotationsApi";
import { useConvertQuotationToInvoice, useQuotations } from "../../api/quotationsApi";
import { axiosInstance } from "../../api/axiosInstance";
import { parseApiError } from "../../api/errorHelpers";

const STATUS_COLORS: Record<QuotationStatus, "default" | "info" | "success" | "error" | "secondary"> = {
  DRAFT: "default",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "error",
  CONVERTED: "secondary",
};

function money(value: number) {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Two-panel Invoices Dashboard (section 17.4 of the Quotations/Invoices plan): stat cards driven
 * by the composite /reports/quotation-invoice-summary endpoint, a left-panel Quotations list
 * with a per-row "Convert to Invoice" action, and a right-panel PDF preview of the most recently
 * converted invoice - reusing the exact same authenticated-blob technique
 * invoicesApi.previewInvoicePdf already uses for the download/preview buttons, embedded inline
 * via an <iframe> rather than a new tab so no separate HTML-preview renderer is needed.
 */
export function InvoiceDashboardPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">("");
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuotationInvoiceSummary();
  const { data: quotationsPage, isLoading: quotationsLoading } = useQuotations({
    status: statusFilter || undefined,
    size: 20,
  });
  const convertMutation = useConvertQuotationToInvoice();

  const loadPreview = async (invoiceId: string) => {
    setPreviewError(null);
    setPreviewInvoiceId(invoiceId);
    try {
      const response = await axiosInstance.get(`/invoices/${invoiceId}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (err) {
      setPreviewError(parseApiError(err).message);
    }
  };

  const handleConvert = async (quotation: Quotation) => {
    setConvertError(null);
    try {
      const invoice = await convertMutation.mutateAsync(quotation.id);
      loadPreview(invoice.id);
    } catch (err) {
      setConvertError(parseApiError(err).message);
    }
  };

  const canConvert = (status: QuotationStatus) => status === "SENT" || status === "APPROVED";

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Invoices</Typography>
        <Button variant="contained" onClick={() => navigate("/app/invoices/new")}>
          New Invoice
        </Button>
      </Stack>

      {summaryLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        summary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard icon={<DescriptionIcon />} color="primary" value={summary.totalQuotations} label="Total Quotations" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard icon={<CheckCircleIcon />} color="success" value={summary.approvedQuotations} label="Approved Quotations" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard icon={<SwapHorizIcon />} color="secondary" value={summary.convertedToInvoice} label="Converted to Invoice" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard
                icon={<ReceiptLongIcon />}
                color="warning"
                value={summary.pendingInvoicesCount}
                label={`Pending Invoices - ${money(summary.pendingInvoicesAmount)}`}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard
                icon={<WarningAmberIcon />}
                color="error"
                value={summary.pendingPaymentsCount}
                label={`Pending Payments - ${money(summary.pendingPaymentsAmount)}`}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard icon={<PaidIcon />} color="info" value={money(summary.monthlyBilling)} label="Monthly Billing" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard
                icon={<AccountBalanceWalletIcon />}
                color="error"
                value={money(summary.outstanding)}
                label="Outstanding"
              />
            </Grid>
          </Grid>
        )
      )}

      {convertError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setConvertError(null)}>
          {convertError}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="subtitle1">Quotations</Typography>
              <TextField
                select
                label="Status"
                size="small"
                sx={{ minWidth: 150 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | "")}
              >
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="SENT">Sent</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
                <MenuItem value="CONVERTED">Converted</MenuItem>
              </TextField>
            </Stack>

            {quotationsLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {quotationsPage && (
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quotationsPage.content.map((quotation) => (
                      <TableRow key={quotation.id} hover>
                        <TableCell>
                          <Button size="small" onClick={() => navigate(`/app/quotations/${quotation.id}`)}>
                            {quotation.quotationNumber}
                          </Button>
                        </TableCell>
                        <TableCell>{quotation.customerName}</TableCell>
                        <TableCell>{dayjs(quotation.quotationDate).format("DD MMM YYYY")}</TableCell>
                        <TableCell align="right">{money(quotation.grandTotal)}</TableCell>
                        <TableCell>
                          <Chip label={quotation.status} color={STATUS_COLORS[quotation.status]} size="small" />
                        </TableCell>
                        <TableCell align="right">
                          {quotation.status === "CONVERTED" && quotation.convertedInvoiceId ? (
                            <Button size="small" onClick={() => loadPreview(quotation.convertedInvoiceId as string)}>
                              Preview
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!canConvert(quotation.status) || convertMutation.isPending}
                              onClick={() => handleConvert(quotation)}
                            >
                              Convert to Invoice
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {quotationsPage.content.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                            No quotations found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 400 }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Invoice Preview
            </Typography>
            {previewError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPreviewError(null)}>
                {previewError}
              </Alert>
            )}
            {!previewInvoiceId && (
              <Typography color="text.secondary">
                Convert a quotation, or click "Preview" on an already-converted one, to see its invoice here.
              </Typography>
            )}
            {previewInvoiceId && (
              <Stack spacing={1.5}>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: "flex-start" }}
                  onClick={() => navigate(`/app/invoices/${previewInvoiceId}`)}
                >
                  Open full invoice
                </Button>
                {previewUrl && (
                  <Box
                    component="iframe"
                    src={previewUrl}
                    sx={{ width: "100%", height: 560, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                  />
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
