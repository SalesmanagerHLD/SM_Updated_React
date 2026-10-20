import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link as MuiLink,
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
import { useAuth } from "../../auth/AuthContext";
import { useEntitlements } from "../../entitlement/EntitlementContext";
import { useEmployees } from "../../api/employeesApi";
import type { ActivityEntry, ActivityType } from "../../api/activityApi";
import { ACTIVITY_TYPES, getActivity, useActivity } from "../../api/activityApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import { TypeIconAvatar } from "../../components/TypeIconAvatar";
import {
  ACTIVITY_TYPE_LABELS,
  resolveActorName,
  activityIcon,
  activityColor,
  activityLabel,
} from "./activityConfig";

/**
 * Org-wide (Admin) / team (manager with TEAM_VISIBILITY) / personal (Employee) activity feed -
 * a paginated read-only log of everything that's happened across leads (creation, status
 * changes, reassignment, visits, lapses). Structurally mirrors LeadListPage: filters up top, a
 * table below, an Owner filter for whoever can see more than just their own activity (ADMIN
 * always; an EMPLOYEE only once TEAM_VISIBILITY is entitled - see LeadListPage's
 * canFilterByOwner for the same reasoning) since anyone else is already scoped server-side to
 * their own owned-leads' activity.
 */
export function ActivityPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const { hasEntitlement } = useEntitlements();
  const canFilterByOwner = isAdmin || hasEntitlement("TEAM_VISIBILITY");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [typeFilter, setTypeFilter] = useState<ActivityType | "">("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Only ADMIN/entitled-manager see/use the owner filter, but employee lookup (for resolving
  // actorId -> name) is harmless and cheap to fetch regardless.
  const { data: employeesPage } = useEmployees({ size: 200 });

  const { data, isLoading, isError, error } = useActivity({
    page,
    size: pageSize,
    type: typeFilter || undefined,
    ownerId: canFilterByOwner ? ownerFilter || undefined : undefined,
  });

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) {
      map.set(emp.id, emp.fullName);
    }
    return map;
  }, [employeesPage]);

  const visibleActivity = useMemo(() => {
    const content = data?.content ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return content;
    return content.filter(
      (entry) =>
        entry.description.toLowerCase().includes(term) ||
        entry.companyName.toLowerCase().includes(term),
    );
  }, [data, search]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getActivity({
        size: 1000,
        type: typeFilter || undefined,
        ownerId: canFilterByOwner ? ownerFilter || undefined : undefined,
      });
      exportToCsv<ActivityEntry>(`activity-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Type", value: (e) => activityLabel(e.type) },
        { label: "Description", value: (e) => e.description },
        { label: "Company", value: (e) => e.companyName },
        { label: "Actor", value: (e) => resolveActorName(e.actorId, employeeNameById) },
        { label: "When", value: (e) => dayjs(e.createdAt).format("YYYY-MM-DD HH:mm") },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageFill>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Activity
      </Typography>

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search description, company..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      >
        <TextField
          select
          label="Type"
          size="small"
          sx={{ minWidth: 180, flexShrink: 0 }}
          value={typeFilter}
          onChange={(e) => {
            setPage(0);
            setTypeFilter(e.target.value as ActivityType | "");
          }}
        >
          <MenuItem value="">All types</MenuItem>
          {ACTIVITY_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {ACTIVITY_TYPE_LABELS[t]}
            </MenuItem>
          ))}
        </TextField>

        {canFilterByOwner && (
          <TextField
            select
            label="Owner"
            size="small"
            sx={{ minWidth: 180, flexShrink: 0 }}
            value={ownerFilter}
            onChange={(e) => {
              setPage(0);
              setOwnerFilter(e.target.value);
            }}
          >
            <MenuItem value="">All owners</MenuItem>
            {(employeesPage?.content ?? []).map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {emp.fullName}
              </MenuItem>
            ))}
          </TextField>
        )}
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
                No activity yet.
              </Typography>
            </Paper>
          )}

          {data.content.length > 0 && visibleActivity.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No activity matches your search.
              </Typography>
            </Paper>
          )}

          {isMobile && visibleActivity.length > 0 && (
            <Stack spacing={0}>
              {visibleActivity.map((entry, index) => {
                const Icon = activityIcon(entry.type);
                const isLast = index === visibleActivity.length - 1;
                return (
                  <Stack key={entry.id} direction="row" spacing={1.5}>
                    <Stack sx={{ alignItems: "center" }}>
                      <TypeIconAvatar icon={Icon} color={activityColor(entry.type)} />
                      {!isLast && <Box sx={{ width: 2, flexGrow: 1, bgcolor: "divider", my: 0.5 }} />}
                    </Stack>
                    <Card variant="outlined" sx={{ flexGrow: 1, mb: isLast ? 0 : 1.5 }}>
                      <CardContent>
                        <Stack
                          direction="row"
                          sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}
                        >
                          <Chip
                            label={activityLabel(entry.type)}
                            color={activityColor(entry.type)}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(entry.createdAt).format("DD MMM, HH:mm")}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {entry.description}
                        </Typography>
                        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                          <MuiLink component={RouterLink} to={`/app/leads/${entry.leadId}`}>
                            {entry.companyName}
                          </MuiLink>
                          <Typography variant="caption" color="text.secondary">
                            {resolveActorName(entry.actorId, employeeNameById)}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                );
              })}
            </Stack>
          )}

          {!isMobile && visibleActivity.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }} />
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>When</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleActivity.map((entry) => {
                    const Icon = activityIcon(entry.type);
                    return (
                      <TableRow key={entry.id} hover>
                        <TableCell>
                          <TypeIconAvatar icon={Icon} color={activityColor(entry.type)} size={32} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={activityLabel(entry.type)}
                            color={activityColor(entry.type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>
                          <MuiLink
                            component={RouterLink}
                            to={`/app/leads/${entry.leadId}`}
                          >
                            {entry.companyName}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          {resolveActorName(entry.actorId, employeeNameById)}
                        </TableCell>
                        <TableCell>
                          {dayjs(entry.createdAt).format("DD MMM YYYY, HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
