import { useMemo, useState } from "react";
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
import { useLeaveTypes } from "../../api/leaveTypesApi";
import { useMyLeaveBalances } from "../../api/leaveBalancesApi";
import type { LeaveRequest, LeaveRequestStatus } from "../../api/leaveRequestsApi";
import {
  getMyLeaveRequests,
  useCancelLeaveRequest,
  useMyLeaveRequests,
} from "../../api/leaveRequestsApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LeaveRequestFormDialog } from "./LeaveRequestFormDialog";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LEAVE_REQUEST_STATUSES, LEAVE_STATUS_COLORS, LEAVE_STATUS_LABELS } from "./leaveStatusConfig";

/**
 * Employee-facing home page for the Leave module: balance summary cards, a
 * "Request Leave" action, and a paginated, filterable history of the caller's
 * own leave requests with a Cancel action for still-pending ones.
 */
export function MyLeaveRequestsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "">("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<LeaveRequest | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: balances, isLoading: balancesLoading } = useMyLeaveBalances();
  const { data: leaveTypes } = useLeaveTypes(true);
  const { data, isLoading, isError, error } = useMyLeaveRequests({
    page,
    size: pageSize,
    status: statusFilter || undefined,
  });
  const cancelMutation = useCancelLeaveRequest();

  const leaveTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of leaveTypes ?? []) map.set(type.id, type.name);
    return map;
  }, [leaveTypes]);

  const visibleRequests = useMemo(() => {
    const content = data?.content ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return content;
    return content.filter((req) => {
      const typeName = leaveTypeNameById.get(req.leaveTypeId) ?? "";
      return (
        typeName.toLowerCase().includes(term) ||
        (req.reason ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, search, leaveTypeNameById]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getMyLeaveRequests({
        size: 1000,
        status: statusFilter || undefined,
      });
      exportToCsv<LeaveRequest>(
        `leave-requests-${dayjs().format("YYYY-MM-DD")}.csv`,
        all.content,
        [
          { label: "Leave Type", value: (r) => leaveTypeNameById.get(r.leaveTypeId) ?? "" },
          { label: "Start", value: (r) => r.startDate },
          { label: "End", value: (r) => r.endDate },
          { label: "Days", value: (r) => r.totalDays },
          { label: "Status", value: (r) => LEAVE_STATUS_LABELS[r.status] },
          { label: "Reason", value: (r) => r.reason },
        ],
      );
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!pendingCancel) return;
    setRowError(null);
    try {
      await cancelMutation.mutateAsync(pendingCancel.id);
      setPendingCancel(null);
    } catch (error) {
      setRowError(parseApiError(error).message);
    }
  };

  return (
    <PageFill>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h5">My Leave</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => setRequestDialogOpen(true)}
        >
          Request Leave
        </Button>
      </Stack>

      {balancesLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {balances && balances.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <LeaveBalanceCards balances={balances} />
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        My Requests
      </Typography>

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leave type, reason..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      >
        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 160, flexShrink: 0 }}
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value as LeaveRequestStatus | "");
          }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {LEAVE_REQUEST_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {LEAVE_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
      </TableToolbar>

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {rowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRowError(null)}>
          {rowError}
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
          {data.content.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No leave requests yet.
              </Typography>
            </Paper>
          )}

          {data.content.length > 0 && visibleRequests.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No leave requests match your search.
              </Typography>
            </Paper>
          )}

          {isMobile && visibleRequests.length > 0 && (
            <Stack spacing={1.5}>
              {visibleRequests.map((req) => (
                <Card key={req.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {leaveTypeNameById.get(req.leaveTypeId) ?? "—"}
                      </Typography>
                      <Chip
                        label={LEAVE_STATUS_LABELS[req.status]}
                        color={LEAVE_STATUS_COLORS[req.status]}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {req.startDate} to {req.endDate} · {req.totalDays} day
                      {req.totalDays === 1 ? "" : "s"}
                    </Typography>
                    {req.reason && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {req.reason}
                      </Typography>
                    )}
                    {req.status === "PENDING" && (
                      <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 1 }}>
                        <Button size="small" color="error" onClick={() => setPendingCancel(req)}>
                          Cancel
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {!isMobile && visibleRequests.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRequests.map((req) => (
                    <TableRow key={req.id} hover>
                      <TableCell>{leaveTypeNameById.get(req.leaveTypeId) ?? "—"}</TableCell>
                      <TableCell>{req.startDate}</TableCell>
                      <TableCell>{req.endDate}</TableCell>
                      <TableCell align="right">{req.totalDays}</TableCell>
                      <TableCell>
                        <Chip
                          label={LEAVE_STATUS_LABELS[req.status]}
                          color={LEAVE_STATUS_COLORS[req.status]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {req.status === "PENDING" && (
                          <Button size="small" color="error" onClick={() => setPendingCancel(req)}>
                            Cancel
                          </Button>
                        )}
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

      <LeaveRequestFormDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
      />

      {pendingCancel && (
        <ConfirmDialog
          open={!!pendingCancel}
          title="Cancel leave request?"
          message="Are you sure you want to cancel this pending leave request?"
          isPending={cancelMutation.isPending}
          confirmLabel="Cancel request"
          onCancel={() => setPendingCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </PageFill>
  );
}
