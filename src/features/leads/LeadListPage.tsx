import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useAuth } from "../../auth/AuthContext";
import { useEntitlements } from "../../entitlement/EntitlementContext";
import { useEmployees } from "../../api/employeesApi";
import { useMasterData } from "../../api/masterDataApi";
import type { Lead, LeadStatus } from "../../api/leadsApi";
import { LEAD_STATUSES, getLeads, useLeads } from "../../api/leadsApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "./leadStatusConfig";
import { LeadCreateDialog } from "./LeadCreateDialog";
import { AddVisitEntryDialog } from "./AddVisitEntryDialog";
import { VisitFormDialog } from "../visits/VisitFormDialog";

export function LeadListPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const { hasEntitlement } = useEntitlements();
  // A manager with TEAM_VISIBILITY entitled sees leads beyond their own (see LeadService#list
  // on the backend) - the owner filter/column is just as meaningful for them as for an ADMIN,
  // even though the backend still silently ignores an out-of-scope ownerId either way.
  const canFilterByOwner = isAdmin || hasEntitlement("TEAM_VISIBILITY");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Supports deep-linking a status filter in, e.g. from a "N leads lapsed" digest
  // notification (?status=LAPSED) - read once on mount as the initial filter value;
  // the filter dropdown itself still owns the state from then on (not URL-synced
  // on every change, just seeded from it at first).
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const isValidInitialStatus = (LEAD_STATUSES as string[]).includes(initialStatus ?? "");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">(
    isValidInitialStatus ? (initialStatus as LeadStatus) : "",
  );
  const [interestLevelFilter, setInterestLevelFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [addVisitEntryOpen, setAddVisitEntryOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visitDialogLead, setVisitDialogLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  // Not shown as a filter/column in the table itself, but needed to resolve
  // cityId -> name for the CSV export ("city" is one of the exported columns).
  const { data: cities } = useMasterData("CITY");
  // Only admins see/use the owner filter and owner column, but employee lookup
  // is harmless (and cheap, cached) to fetch regardless.
  const { data: employeesPage } = useEmployees({ size: 200 });

  const { data, isLoading, isError, error } = useLeads({
    page,
    size: pageSize,
    status: statusFilter || undefined,
    interestLevelId: interestLevelFilter || undefined,
    ownerId: canFilterByOwner ? ownerFilter || undefined : undefined,
  });

  const interestLevelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of interestLevels ?? []) map.set(item.id, item.label);
    return map;
  }, [interestLevels]);

  const ownerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) {
      map.set(emp.id, emp.fullName);
    }
    return map;
  }, [employeesPage]);

  const cityMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of cities ?? []) map.set(item.id, item.label);
    return map;
  }, [cities]);

  const visibleLeads = useMemo(() => {
    const content = data?.content ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return content;
    return content.filter(
      (lead) =>
        lead.companyName.toLowerCase().includes(term) ||
        lead.contactPerson.toLowerCase().includes(term) ||
        lead.contactNo.toLowerCase().includes(term),
    );
  }, [data, search]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getLeads({
        size: 1000,
        status: statusFilter || undefined,
        interestLevelId: interestLevelFilter || undefined,
        ownerId: canFilterByOwner ? ownerFilter || undefined : undefined,
      });
      exportToCsv<Lead>(`leads-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Company", value: (l) => l.companyName },
        { label: "Contact Person", value: (l) => l.contactPerson },
        { label: "Phone", value: (l) => l.contactNo },
        {
          label: "City",
          value: (l) => l.cityOther ?? (l.cityId ? cityMap.get(l.cityId) : ""),
        },
        { label: "Status", value: (l) => LEAD_STATUS_LABELS[l.status] },
        {
          label: "Interest Level",
          value: (l) => (l.interestLevelId ? interestLevelMap.get(l.interestLevelId) : ""),
        },
        { label: "Owner", value: (l) => ownerMap.get(l.ownerId) ?? l.ownerId },
        { label: "Created Date", value: (l) => dayjs(l.createdAt).format("YYYY-MM-DD") },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageFill>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h5">Leads</Typography>
        <Stack direction="row" spacing={1.5}>
          {isAdmin && (
            <Button
              startIcon={<UploadFileIcon />}
              variant="outlined"
              onClick={() => navigate("/app/leads/import")}
            >
              Import Leads
            </Button>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setAddVisitEntryOpen(true)}
          >
            Add Visit
          </Button>
        </Stack>
      </Stack>

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search company, contact, phone..."
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
            setStatusFilter(e.target.value as LeadStatus | "");
          }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {LEAD_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Interest level"
          size="small"
          sx={{ minWidth: 160, flexShrink: 0 }}
          value={interestLevelFilter}
          onChange={(e) => {
            setPage(0);
            setInterestLevelFilter(e.target.value);
          }}
        >
          <MenuItem value="">All interest levels</MenuItem>
          {(interestLevels ?? []).map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
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
                No leads yet.
              </Typography>
            </Paper>
          )}

          {data.content.length > 0 && visibleLeads.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No leads match your search.
              </Typography>
            </Paper>
          )}

          {/* Mobile: a card per lead, leading with Status/Interest so they're never
              scrolled out of view the way they'd be in a horizontally-scrolling table -
              that was the actual bug reported (Status/Interest invisible on phones). */}
          {isMobile && visibleLeads.length > 0 && (
            <Stack spacing={1.5}>
              {visibleLeads.map((lead) => (
                <Card key={lead.id} variant="outlined">
                  <CardActionArea onClick={() => navigate(`/app/leads/${lead.id}`)}>
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {lead.companyName}
                        </Typography>
                        <Chip
                          label={LEAD_STATUS_LABELS[lead.status]}
                          color={LEAD_STATUS_COLORS[lead.status]}
                          size="small"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {lead.contactPerson} · {lead.contactNo}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                        {lead.interestLevelId && (
                          <Chip
                            label={interestLevelMap.get(lead.interestLevelId) ?? "—"}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {lead.nextFollowupDate && (
                          <Chip
                            label={`Follow-up: ${lead.nextFollowupDate}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {canFilterByOwner && (
                          <Chip
                            label={
                              lead.status === "LOST"
                                ? "Unassigned – Lost"
                                : (ownerMap.get(lead.ownerId) ?? "Unassigned")
                            }
                            size="small"
                            variant="outlined"
                            color={lead.status === "LOST" ? "error" : "default"}
                          />
                        )}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          )}

          {/* Tablet/desktop: the full table. */}
          {!isMobile && visibleLeads.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Company</TableCell>
                    <TableCell>Contact Person</TableCell>
                    <TableCell>Contact No</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Interest Level</TableCell>
                    <TableCell>Next Follow-up</TableCell>
                    {canFilterByOwner && <TableCell>Owner</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/app/leads/${lead.id}`)}
                    >
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
                        {lead.interestLevelId ? (
                          <Chip
                            label={
                              interestLevelMap.get(lead.interestLevelId) ?? "—"
                            }
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{lead.nextFollowupDate ?? "—"}</TableCell>
                      {canFilterByOwner && (
                        <TableCell>
                          {lead.status === "LOST" ? (
                            <Chip label="Unassigned – Lost" size="small" color="error" variant="outlined" />
                          ) : (
                            (ownerMap.get(lead.ownerId) ?? lead.ownerId)
                          )}
                        </TableCell>
                      )}
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

      <AddVisitEntryDialog
        open={addVisitEntryOpen}
        onClose={() => setAddVisitEntryOpen(false)}
        onSelectNewLead={() => {
          setAddVisitEntryOpen(false);
          setDialogOpen(true);
        }}
        onSelectExistingLead={(lead) => {
          setAddVisitEntryOpen(false);
          setVisitDialogLead(lead);
        }}
      />

      <LeadCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />

      {visitDialogLead && (
        <VisitFormDialog
          open={!!visitDialogLead}
          onClose={() => setVisitDialogLead(null)}
          leadId={visitDialogLead.id}
          lead={visitDialogLead}
        />
      )}
    </PageFill>
  );
}
