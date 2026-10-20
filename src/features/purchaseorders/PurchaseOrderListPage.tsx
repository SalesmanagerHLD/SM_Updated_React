import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import type { PurchaseOrderStatus } from "../../api/purchaseOrdersApi";
import { PO_STATUS_LABELS, usePurchaseOrders } from "../../api/purchaseOrdersApi";
import { parseApiError } from "../../api/errorHelpers";
import { TableToolbar } from "../../components/TableToolbar";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { exportToCsv } from "../../utils/exportToCsv";
import { getPurchaseOrders } from "../../api/purchaseOrdersApi";
import { parseApiError as parseExportError } from "../../api/errorHelpers";
import { PurchaseOrderStatusChip } from "./PurchaseOrderStatusChip";
import { PurchaseOrderFormDialog } from "./PurchaseOrderFormDialog";

export function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [status, setStatus] = useState<PurchaseOrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error } = usePurchaseOrders({
    status: status || undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    size: pageSize,
  });
  const rows = useMemo(() => data?.content ?? [], [data]);

  const resetPage = () => setPage(0);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getPurchaseOrders({
        status: status || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        size: 1000,
      });
      exportToCsv(`purchase-orders-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "PO #", value: (p) => p.poNumber },
        { label: "Customer", value: (p) => p.customerName },
        { label: "PO date", value: (p) => p.poDate },
        { label: "Delivery date", value: (p) => p.deliveryDate ?? "" },
        { label: "Grand total", value: (p) => p.grandTotal },
        { label: "Status", value: (p) => PO_STATUS_LABELS[p.status] },
      ]);
    } catch (err) {
      setExportError(parseExportError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageFill>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Purchase orders</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
          Add PO
        </Button>
      </Stack>

      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          resetPage();
        }}
        searchPlaceholder="Search PO number or customer..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      >
        <TextField select label="Status" size="small" sx={{ minWidth: 160, flexShrink: 0 }} value={status}
          onChange={(e) => { setStatus(e.target.value as PurchaseOrderStatus | ""); resetPage(); }}>
          <MenuItem value="">All statuses</MenuItem>
          {(Object.keys(PO_STATUS_LABELS) as PurchaseOrderStatus[]).map((s) => (
            <MenuItem key={s} value={s}>{PO_STATUS_LABELS[s]}</MenuItem>
          ))}
        </TextField>
        <TextField label="PO date from" type="date" size="small" sx={{ flexShrink: 0 }} value={dateFrom}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} />
        <TextField label="PO date to" type="date" size="small" sx={{ flexShrink: 0 }} value={dateTo}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }} />
      </TableToolbar>

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>{exportError}</Alert>
      )}

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      )}
      {isError && <Alert severity="error" sx={{ mt: 2 }}>{parseApiError(error).message}</Alert>}

      {data && rows.length === 0 && (
        <Paper variant="outlined" sx={{ py: 4 }}>
          <Typography color="text.secondary" align="center">No purchase orders found.</Typography>
        </Paper>
      )}

      {data && isMobile && rows.length > 0 && (
        <Stack spacing={1.5}>
          {rows.map((po) => (
            <Card key={po.id} variant="outlined" sx={{ cursor: "pointer" }}
              onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle1">{po.poNumber}</Typography>
                  <PurchaseOrderStatusChip status={po.status} />
                </Stack>
                <Typography variant="body2">{po.customerName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {dayjs(po.poDate).format("DD MMM YYYY")} - {po.grandTotal}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {data && !isMobile && rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PO #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>PO date</TableCell>
                <TableCell>Delivery</TableCell>
                <TableCell align="right">Grand total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((po) => (
                <TableRow key={po.id} hover sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                  <TableCell>{po.poNumber}</TableCell>
                  <TableCell>{po.customerName}</TableCell>
                  <TableCell>{dayjs(po.poDate).format("DD MMM YYYY")}</TableCell>
                  <TableCell>{po.deliveryDate ? dayjs(po.deliveryDate).format("DD MMM YYYY") : "-"}</TableCell>
                  <TableCell align="right">{po.grandTotal}</TableCell>
                  <TableCell><PurchaseOrderStatusChip status={po.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && (
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
      )}

      <PurchaseOrderFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(po) => navigate(`/app/purchase-orders/${po.id}`)}
      />
    </PageFill>
  );
}
