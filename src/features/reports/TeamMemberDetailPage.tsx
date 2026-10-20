import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useEmployee, useEmployees } from "../../api/employeesApi";
import { useLeads } from "../../api/leadsApi";
import { useActivity } from "../../api/activityApi";
import { useMasterData } from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "../leads/leadStatusConfig";
import { TypeIconAvatar } from "../../components/TypeIconAvatar";
import {
  resolveActorName,
  activityIcon,
  activityColor,
  activityLabel,
} from "../activity/activityConfig";

const LEADS_PAGE_SIZE = 100;
const ACTIVITY_PAGE_SIZE = 50;

/**
 * Read-only drill-down for a single team member, reached by clicking their row in the Reports
 * page's Team Progress table - their assigned leads and recent activity, nothing editable or
 * further clickable (see that section's own comment for why this stops at a list, not a
 * per-lead detail view). Reuses GET /leads?ownerId= and GET /activity?ownerId=, which already
 * scope correctly for the caller (ADMIN unrestricted; an entitled manager limited to their own
 * subordinate chain) - no new backend endpoint needed for this page at all.
 */
export function TeamMemberDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();

  const {
    data: employee,
    isLoading: employeeLoading,
    isError: employeeIsError,
    error: employeeError,
  } = useEmployee(employeeId);
  const {
    data: leadsPage,
    isLoading: leadsLoading,
    isError: leadsIsError,
    error: leadsError,
  } = useLeads({ ownerId: employeeId, size: LEADS_PAGE_SIZE }, { enabled: !!employeeId });
  const {
    data: activityPage,
    isLoading: activityLoading,
    isError: activityIsError,
    error: activityError,
  } = useActivity({ ownerId: employeeId, size: ACTIVITY_PAGE_SIZE }, { enabled: !!employeeId });
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  // Actors on this member's activity can be any employee who touched their leads (e.g. an
  // Admin who reassigned one), not just this member themselves - same reasoning
  // LeadDetailPage's own Activity panel already documents for resolving actor names.
  const { data: employeesPage } = useEmployees({ size: 200 });

  const interestLevelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of interestLevels ?? []) map.set(item.id, item.label);
    return map;
  }, [interestLevels]);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) map.set(emp.id, emp.fullName);
    return map;
  }, [employeesPage]);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/app/reports")} sx={{ mb: 2 }}>
        Back to Reports
      </Button>

      {employeeLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {employeeIsError && (
        <Alert severity="error">{parseApiError(employeeError).message}</Alert>
      )}

      {employee && (
        <>
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            {employee.fullName}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Read-only view of this team member's assigned leads and recent activity.
          </Typography>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Assigned Leads
            </Typography>

            {leadsLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {leadsIsError && <Alert severity="error">{parseApiError(leadsError).message}</Alert>}

            {leadsPage && leadsPage.content.length === 0 && (
              <Typography color="text.secondary">No leads assigned yet.</Typography>
            )}

            {leadsPage && leadsPage.content.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Company</TableCell>
                      <TableCell>Contact Person</TableCell>
                      <TableCell>Contact No</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Interest Level</TableCell>
                      <TableCell>Next Follow-up</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leadsPage.content.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>{lead.companyName}</TableCell>
                        <TableCell>{lead.contactPerson}</TableCell>
                        <TableCell>{lead.contactNo}</TableCell>
                        <TableCell>
                          <Chip
                            label={LEAD_STATUS_LABELS[lead.status]}
                            color={LEAD_STATUS_COLORS[lead.status]}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {lead.interestLevelId
                            ? (interestLevelMap.get(lead.interestLevelId) ?? "—")
                            : "—"}
                        </TableCell>
                        <TableCell>{lead.nextFollowupDate ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>

            {activityLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {activityIsError && (
              <Alert severity="error">{parseApiError(activityError).message}</Alert>
            )}

            {activityPage && activityPage.content.length === 0 && (
              <Typography color="text.secondary">No activity yet.</Typography>
            )}

            {activityPage && activityPage.content.length > 0 && (
              <Stack spacing={0}>
                {activityPage.content.map((entry, index) => {
                  const Icon = activityIcon(entry.type);
                  const isLast = index === activityPage.content.length - 1;
                  return (
                    <Stack key={entry.id} direction="row" spacing={2}>
                      <Stack sx={{ alignItems: "center" }}>
                        <TypeIconAvatar icon={Icon} color={activityColor(entry.type)} />
                        {!isLast && (
                          <Box sx={{ width: 2, flexGrow: 1, bgcolor: "divider", my: 0.5 }} />
                        )}
                      </Stack>
                      <Box sx={{ pb: 2.5, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.25 }}>
                          <Chip
                            label={activityLabel(entry.type)}
                            color={activityColor(entry.type)}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(entry.createdAt).format("DD MMM YYYY, HH:mm")}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">{entry.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.companyName} · {resolveActorName(entry.actorId, employeeNameById)}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
