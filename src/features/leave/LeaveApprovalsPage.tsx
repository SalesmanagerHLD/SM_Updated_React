import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useAuth } from "../../auth/AuthContext";
import { useEmployees } from "../../api/employeesApi";
import { useLeaveTypes } from "../../api/leaveTypesApi";
import type { LeaveRequest, LeaveRequestStatus } from "../../api/leaveRequestsApi";
import {
  getAllLeaveRequests,
  useAllLeaveRequests,
  useApproveLeaveRequest,
  usePendingApproval,
  useRejectLeaveRequest,
} from "../../api/leaveRequestsApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import {
  LEAVE_REQUEST_STATUSES,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
} from "./leaveStatusConfig";
import { LeaveDecisionDialog } from "./LeaveDecisionDialog";

interface DecisionTarget {
  request: LeaveRequest;
  action: "approve" | "reject";
}

function PendingApprovalTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { data, isLoading, isError, error } = usePendingApproval();
  const { data: employeesPage } = useEmployees({ size: 200 });
  const { data: leaveTypes } = useLeaveTypes(true);
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();

  const [decisionTarget, setDecisionTarget] = useState<DecisionTarget | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) map.set(emp.id, emp.fullName);
    return map;
  }, [employeesPage]);

  const leaveTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of leaveTypes ?? []) map.set(type.id, type.name);
    return map;
  }, [leaveTypes]);

  const isDeciding = approveMutation.isPending || rejectMutation.isPending;

  const handleConfirmDecision = async (decisionNote: string) => {
    if (!decisionTarget) return;
    setDecisionError(null);
    const payload = decisionNote ? { decisionNote } : undefined;
    try {
      if (decisionTarget.action === "approve") {
        await approveMutation.mutateAsync({ id: decisionTarget.request.id, payload });
      } else {
        await rejectMutation.mutateAsync({ id: decisionTarget.request.id, payload });
      }
      setDecisionTarget(null);
    } catch (err) {
      setDecisionError(parseApiError(err).message);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {parseApiError(error).message}
      </Alert>
    );
  }

  const allRequests = data ?? [];
  const term = search.trim().toLowerCase();
  const requests = term
    ? allRequests.filter((req) => {
        const employeeName = employeeNameById.get(req.employeeId) ?? "";
        const typeName = leaveTypeNameById.get(req.leaveTypeId) ?? "";
        return (
          employeeName.toLowerCase().includes(term) ||
          typeName.toLowerCase().includes(term) ||
          (req.reason ?? "").toLowerCase().includes(term)
        );
      })
    : allRequests;

  const handleExport = () => {
    exportToCsv<LeaveRequest>(
      `pending-leave-approvals-${dayjs().format("YYYY-MM-DD")}.csv`,
      requests,
      [
        { label: "Employee", value: (r) => employeeNameById.get(r.employeeId) ?? r.employeeId },
        { label: "Leave Type", value: (r) => leaveTypeNameById.get(r.leaveTypeId) ?? "" },
        { label: "Start", value: (r) => r.startDate },
        { label: "End", value: (r) => r.endDate },
        { label: "Days", value: (r) => r.totalDays },
        { label: "Reason", value: (r) => r.reason },
      ],
    );
  };

  return (
    <Box>
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employee, type, reason..."
        onExport={handleExport}
        exportDisabled={allRequests.length === 0}
      />

      {allRequests.length > 0 && requests.length === 0 && (
        <Paper variant="outlined" sx={{ py: 4 }}>
          <Typography color="text.secondary" align="center">
            No requests match your search.
          </Typography>
        </Paper>
      )}

      {requests.length === 0 && allRequests.length === 0 && (
        <Paper variant="outlined" sx={{ py: 4 }}>
          <Typography color="text.secondary" align="center">
            Nothing pending your approval.
          </Typography>
        </Paper>
      )}

      {isMobile && requests.length > 0 && (
        <Stack spacing={1.5}>
          {requests.map((req) => (
            <Card key={req.id} variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}
                >
                  <MuiLink
                    component={RouterLink}
                    to={`/app/leave/employee/${req.employeeId}`}
                    variant="subtitle1"
                    sx={{ fontWeight: 600 }}
                  >
                    {employeeNameById.get(req.employeeId) ?? req.employeeId}
                  </MuiLink>
                  <Chip
                    label={leaveTypeNameById.get(req.leaveTypeId) ?? "—"}
                    size="small"
                    variant="outlined"
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
                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1.5 }}>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setDecisionTarget({ request: req, action: "reject" })}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => setDecisionTarget({ request: req, action: "approve" })}
                  >
                    Approve
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {!isMobile && requests.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell align="right">Days</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} hover>
                  <TableCell>
                    <MuiLink component={RouterLink} to={`/app/leave/employee/${req.employeeId}`}>
                      {employeeNameById.get(req.employeeId) ?? req.employeeId}
                    </MuiLink>
                  </TableCell>
                  <TableCell>{leaveTypeNameById.get(req.leaveTypeId) ?? "—"}</TableCell>
                  <TableCell>{req.startDate}</TableCell>
                  <TableCell>{req.endDate}</TableCell>
                  <TableCell align="right">{req.totalDays}</TableCell>
                  <TableCell>{req.reason ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDecisionTarget({ request: req, action: "reject" })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => setDecisionTarget({ request: req, action: "approve" })}
                      >
                        Approve
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <LeaveDecisionDialog
        open={!!decisionTarget}
        action={decisionTarget?.action ?? "approve"}
        isPending={isDeciding}
        errorMessage={decisionError}
        onCancel={() => {
          setDecisionTarget(null);
          setDecisionError(null);
        }}
        onConfirm={handleConfirmDecision}
      />
    </Box>
  );
}

function AllRequestsTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "">("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [startDateFrom, setStartDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [startDateTo, setStartDateTo] = useState<dayjs.Dayjs | null>(null);
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: employeesPage } = useEmployees({ size: 200 });
  const { data: leaveTypes } = useLeaveTypes(true);

  const { data, isLoading, isError, error } = useAllLeaveRequests({
    page,
    size: pageSize,
    employeeId: employeeFilter || undefined,
    status: statusFilter || undefined,
    leaveTypeId: leaveTypeFilter || undefined,
    startDateFrom: startDateFrom ? startDateFrom.format("YYYY-MM-DD") : undefined,
    startDateTo: startDateTo ? startDateTo.format("YYYY-MM-DD") : undefined,
  });

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) map.set(emp.id, emp.fullName);
    return map;
  }, [employeesPage]);

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
      const employeeName = employeeNameById.get(req.employeeId) ?? "";
      const typeName = leaveTypeNameById.get(req.leaveTypeId) ?? "";
      return (
        employeeName.toLowerCase().includes(term) || typeName.toLowerCase().includes(term)
      );
    });
  }, [data, search, employeeNameById, leaveTypeNameById]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getAllLeaveRequests({
        size: 1000,
        employeeId: employeeFilter || undefined,
        status: statusFilter || undefined,
        leaveTypeId: leaveTypeFilter || undefined,
        startDateFrom: startDateFrom ? startDateFrom.format("YYYY-MM-DD") : undefined,
        startDateTo: startDateTo ? startDateTo.format("YYYY-MM-DD") : undefined,
      });
      exportToCsv<LeaveRequest>(
        `leave-requests-all-${dayjs().format("YYYY-MM-DD")}.csv`,
        all.content,
        [
          { label: "Employee", value: (r) => employeeNameById.get(r.employeeId) ?? r.employeeId },
          { label: "Leave Type", value: (r) => leaveTypeNameById.get(r.leaveTypeId) ?? "" },
          { label: "Start", value: (r) => r.startDate },
          { label: "End", value: (r) => r.endDate },
          { label: "Days", value: (r) => r.totalDays },
          { label: "Status", value: (r) => LEAVE_STATUS_LABELS[r.status] },
        ],
      );
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Box>
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employee, type..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      >
        <TextField
          select
          label="Employee"
          size="small"
          sx={{ minWidth: 180, flexShrink: 0 }}
          value={employeeFilter}
          onChange={(e) => {
            setPage(0);
            setEmployeeFilter(e.target.value);
          }}
        >
          <MenuItem value="">All employees</MenuItem>
          {(employeesPage?.content ?? []).map((emp) => (
            <MenuItem key={emp.id} value={emp.id}>
              {emp.fullName}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 150, flexShrink: 0 }}
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

        <TextField
          select
          label="Leave type"
          size="small"
          sx={{ minWidth: 160, flexShrink: 0 }}
          value={leaveTypeFilter}
          onChange={(e) => {
            setPage(0);
            setLeaveTypeFilter(e.target.value);
          }}
        >
          <MenuItem value="">All types</MenuItem>
          {(leaveTypes ?? []).map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </TextField>

        <DatePicker
          label="Start from"
          value={startDateFrom}
          onChange={(value) => {
            setPage(0);
            setStartDateFrom(value);
          }}
          slotProps={{ textField: { size: "small", sx: { minWidth: 160, flexShrink: 0 } } }}
        />
        <DatePicker
          label="Start to"
          value={startDateTo}
          onChange={(value) => {
            setPage(0);
            setStartDateTo(value);
          }}
          slotProps={{ textField: { size: "small", sx: { minWidth: 160, flexShrink: 0 } } }}
        />
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
          {data.content.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No leave requests match these filters.
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
                        {employeeNameById.get(req.employeeId) ?? req.employeeId}
                      </Typography>
                      <Chip
                        label={LEAVE_STATUS_LABELS[req.status]}
                        color={LEAVE_STATUS_COLORS[req.status]}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {leaveTypeNameById.get(req.leaveTypeId) ?? "—"} · {req.startDate} to{" "}
                      {req.endDate} · {req.totalDays} day{req.totalDays === 1 ? "" : "s"}
                    </Typography>
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
                    <TableCell>Employee</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRequests.map((req) => (
                    <TableRow key={req.id} hover>
                      <TableCell>{employeeNameById.get(req.employeeId) ?? req.employeeId}</TableCell>
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
    </Box>
  );
}

/**
 * Manager/admin-facing approvals page: "Pending My Approval" (everyone with
 * this feature - a manager with no direct reports just sees an empty state)
 * plus an ADMIN-only "All Requests" read-only reporting tab.
 */
export function LeaveApprovalsPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const [tab, setTab] = useState(0);

  return (
    <PageFill>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Leave Approvals
      </Typography>

      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="scrollable" scrollButtons="auto">
          <Tab label="Pending My Approval" />
          {isAdmin && <Tab label="All Requests" />}
        </Tabs>
      </Paper>

      {tab === 0 && <PendingApprovalTab />}
      {tab === 1 && isAdmin && <AllRequestsTab />}
    </PageFill>
  );
}
