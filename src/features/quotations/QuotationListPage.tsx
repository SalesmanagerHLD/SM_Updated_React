import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import type { Quotation, QuotationStatus } from "../../api/quotationsApi";
import { getQuotations, useQuotations } from "../../api/quotationsApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";

const STATUS_COLORS: Record<QuotationStatus, "default" | "info" | "success" | "error" | "secondary"> = {
  DRAFT: "default",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "error",
  CONVERTED: "secondary",
};

export function QuotationListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">("");
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuotations({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    size: pageSize,
  });

  const rows = useMemo(() => data?.content ?? [], [data]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getQuotations({ status: statusFilter || undefined, size: 1000 });
      exportToCsv<Quotation>(`quotations-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Quotation #", value: (q) => q.quotationNumber },
        { label: "Customer", value: (q) => q.customerName },
        { label: "Date", value: (q) => q.quotationDate },
        { label: "Grand Total", value: (q) => q.grandTotal },
        { label: "Status", value: (q) => q.status },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageFill>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Quotations</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate("/app/quotations/new")}>
          New Quotation
        </Button>
      </Stack>

      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        searchPlaceholder="Search quotation #, customer..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      >
        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 150, flexShrink: 0 }}
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value as QuotationStatus | "");
          }}
        >
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="DRAFT">Draft</MenuItem>
          <MenuItem value="SENT">Sent</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="REJECTED">Rejected</MenuItem>
          <MenuItem value="CONVERTED">Converted</MenuItem>
        </TextField>
      </TableToolbar>

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {parseApiError(error).message}
        </Alert>
      )}

      {data && (
        <>
          {rows.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No quotations yet.
              </Typography>
            </Paper>
          )}

          {isMobile && rows.length > 0 && (
            <Stack spacing={1.5}>
              {rows.map((quotation) => (
                <Card
                  key={quotation.id}
                  variant="outlined"
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/app/quotations/${quotation.id}`)}
                >
                  <CardContent>
                    <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="subtitle1">{quotation.quotationNumber}</Typography>
                      <Chip label={quotation.status} color={STATUS_COLORS[quotation.status]} size="small" />
                    </Stack>
                    <Typography variant="body2">{quotation.customerName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(quotation.quotationDate).format("DD MMM YYYY")} - {quotation.grandTotal}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {!isMobile && rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Quotation #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Grand Total</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((quotation) => (
                    <TableRow
                      key={quotation.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/app/quotations/${quotation.id}`)}
                    >
                      <TableCell>{quotation.quotationNumber}</TableCell>
                      <TableCell>{quotation.customerName}</TableCell>
                      <TableCell>{dayjs(quotation.quotationDate).format("DD MMM YYYY")}</TableCell>
                      <TableCell align="right">{quotation.grandTotal}</TableCell>
                      <TableCell>
                        <Chip label={quotation.status} color={STATUS_COLORS[quotation.status]} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePager

            page={page}

            totalPages={data.totalPages}

            totalElements={data.totalElements}

            pageSize={pageSize}

            onPageChange={setPage}

            onPageSizeChange={(n) => {

              setPageSize(n);

              setPage(0);

            }}

          />
        </>
      )}
    </PageFill>
  );
}
