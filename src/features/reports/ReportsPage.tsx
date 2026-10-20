import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CancelIcon from "@mui/icons-material/Cancel";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import BusinessIcon from "@mui/icons-material/Business";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import TodayIcon from "@mui/icons-material/Today";
import PersonIcon from "@mui/icons-material/Person";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import InventoryIcon from "@mui/icons-material/Inventory2";
import WhatshotOutlinedIcon from "@mui/icons-material/WhatshotOutlined";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import GridOnIcon from "@mui/icons-material/GridOn";
import PlaceIcon from "@mui/icons-material/Place";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import { LEAD_STATUSES, getLeads, useLeads } from "../../api/leadsApi";
import type { LeadStatus } from "../../api/leadsApi";
import {
  useInterestLevelStatusMatrix,
  useInterestReasons,
  useLeadDashboard,
  usePipelineSummary,
  useTeamProgress,
  useVisitsByType,
  useVisitsCompletedVsMissed,
} from "../../api/reportingApi";
import type { TeamMemberProgress } from "../../api/reportingApi";
import { parseApiError } from "../../api/errorHelpers";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "../leads/leadStatusConfig";
import { exportToCsv } from "../../utils/exportToCsv";
import {
  DashCard,
  DonutWithLegend,
  EmptyNote,
  KpiCard,
  SectionLoading,
  useChartStyles,
} from "../../components/dashboardParts";
import type { DonutSlice, PaletteKey } from "../../components/dashboardParts";
import { DataTable } from "../../components/DataTable";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { ReportFilterBar, ReportPeriodBar, useReportFilters } from "./ReportFilters";
import type { ReportFilters } from "./ReportFilters";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "performance", label: "Performance" },
  { id: "visits", label: "Visits" },
  { id: "team", label: "Team" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CHART_HEIGHT = 240;

const pct = (value: number) => `${value.toFixed(1)}%`;

function useLeadStatusHexColors(): Record<LeadStatus, string> {
  const theme = useTheme();
  return useMemo(() => {
    const hex: Record<string, string> = {
      info: theme.palette.info.main,
      primary: theme.palette.primary.main,
      warning: theme.palette.warning.main,
      error: theme.palette.error.main,
      success: theme.palette.success.main,
      default: theme.palette.grey[500],
    };
    const result = {} as Record<LeadStatus, string>;
    for (const status of LEAD_STATUSES) result[status] = hex[LEAD_STATUS_COLORS[status]];
    return result;
  }, [theme]);
}

function ExportButton({ onClick, disabled, loading }: { onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Button size="small" startIcon={<FileDownloadIcon />} onClick={onClick} disabled={disabled || loading}>
      {loading ? "Exporting…" : "Export"}
    </Button>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  return <Alert severity="error">{parseApiError(error).message}</Alert>;
}

/** Label / value rows - used for the small follow-up and expected-closure summaries. */
function StatRows({ rows }: { rows: { label: string; value: number; color?: PaletteKey }[] }) {
  return (
    <Stack spacing={0}>
      {rows.map((row) => (
        <Stack
          key={row.label}
          direction="row"
          sx={{ justifyContent: "space-between", py: 0.9, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}
        >
          <Typography variant="body2" color="text.secondary">
            {row.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }} color={row.color ? `${row.color}.main` : undefined}>
            {row.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

// ───────────────────────────── Overview ─────────────────────────────

/** Which MUI palette colour an interest level's bars use - by its name, so Hot/Warm/Cold keep
 * their familiar red/amber/blue even if an admin renames or adds levels. */
function levelColor(label: string): "error" | "warning" | "info" | "primary" {
  const name = label.toLowerCase();
  if (name.includes("hot")) return "error";
  if (name.includes("warm")) return "warning";
  if (name.includes("cold")) return "info";
  return "primary";
}

/** "Why is it Hot/Warm/Cold?" - for each interest level, the reasons admins defined and how many
 * leads carry each (a lead with several reasons counts once under each). */
function InterestReasonsCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading, isError, error } = useInterestReasons({
    dateFrom: filters.params.dateFrom,
    dateTo: filters.params.dateTo,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { reason: string; count: number }[]>();
    for (const row of data?.rows ?? []) {
      map.set(row.interestLevel, [...(map.get(row.interestLevel) ?? []), { reason: row.reason, count: row.count }]);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <DashCard icon={<PsychologyAltIcon />} color="secondary" title="Why leads are Hot / Warm / Cold">
      {isLoading && <SectionLoading />}
      {isError && <ErrorNote error={error} />}
      {data && grouped.length === 0 && (
        <EmptyNote>
          No reasons recorded yet. Admins can set them up under Masters → Interest Reason, then pick them when adding a
          lead.
        </EmptyNote>
      )}
      {grouped.length > 0 && (
        <Grid container spacing={3}>
          {grouped.map(([level, reasons]) => {
            const max = Math.max(...reasons.map((r) => r.count), 1);
            const color = levelColor(level);
            return (
              <Grid key={level} size={{ xs: 12, md: 6, xl: 4 }}>
                <Chip size="small" label={level} color={color} sx={{ mb: 1 }} />
                <Stack spacing={1}>
                  {reasons.map((r) => (
                    <Box key={r.reason}>
                      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                        <Typography variant="body2" noWrap>
                          {r.reason}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {r.count}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        color={color}
                        value={(r.count / max) * 100}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      )}
      {data && grouped.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          {data.leadsWithReasons} lead{data.leadsWithReasons === 1 ? "" : "s"} with reasons. Follows the period; other
          filters don't apply here.
        </Typography>
      )}
    </DashCard>
  );
}

function OverviewTab({ filters }: { filters: ReportFilters }) {
  const theme = useTheme();
  const chart = useChartStyles();
  const statusColors = useLeadStatusHexColors();
  const { data, isLoading, isError, error } = useLeadDashboard(filters.params);
  const pipeline = usePipelineSummary();

  if (isLoading) return <SectionLoading />;
  if (isError) return <ErrorNote error={error} />;
  if (!data) return null;

  const interestSlices: DonutSlice[] = [
    { label: "Hot", value: data.hotLeads, color: theme.palette.error.main },
    { label: "Warm", value: data.warmLeads, color: theme.palette.warning.main },
    { label: "Cold", value: data.coldLeads, color: theme.palette.info.main },
    { label: "Not set", value: data.notSetInterestCount, color: theme.palette.grey[500] },
  ];
  const interestTotal = interestSlices.reduce((sum, s) => sum + s.value, 0);
  const statusSlices: DonutSlice[] = LEAD_STATUSES.map((status) => ({
    label: LEAD_STATUS_LABELS[status],
    value: pipeline.data?.byStatus[status] ?? 0,
    color: statusColors[status],
  }));

  const kpis: { label: string; value: string | number; caption: string; icon: React.ReactNode; color: PaletteKey }[] = [
    { label: "Total Leads", value: data.totalLeads, caption: "Matching filters", icon: <GroupsIcon />, color: "primary" },
    { label: "Hot", value: data.hotLeads, caption: "High interest", icon: <LocalFireDepartmentIcon />, color: "error" },
    { label: "Warm", value: data.warmLeads, caption: "Medium interest", icon: <WhatshotIcon />, color: "warning" },
    { label: "Cold", value: data.coldLeads, caption: "Low interest", icon: <AcUnitIcon />, color: "info" },
    { label: "Today's Follow-ups", value: data.todayFollowUpCount, caption: "Due today", icon: <EventAvailableIcon />, color: "primary" },
    { label: "Overdue", value: data.overdueFollowUpCount, caption: "Follow-ups missed", icon: <EventBusyIcon />, color: "error" },
    { label: "Closed Won", value: data.closedWonCount, caption: "Converted", icon: <EmojiEventsIcon />, color: "success" },
    { label: "Closed Lost", value: data.closedLostCount, caption: "Lost", icon: <CancelIcon />, color: "error" },
    { label: "Conversion", value: pct(data.conversionRatePercent), caption: "Won / total", icon: <TrendingUpIcon />, color: "success" },
    { label: "Closing This Month", value: data.expectedClosures.thisMonth, caption: "Expected closures", icon: <TodayIcon />, color: "secondary" },
  ];

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {kpis.map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
            <KpiCard {...kpi} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <DashCard icon={<WhatshotOutlinedIcon />} color="error" title="By Interest Level">
            {interestTotal === 0 ? (
              <EmptyNote>No leads match.</EmptyNote>
            ) : (
              <Box sx={{ minHeight: CHART_HEIGHT, display: "flex" }}>
                <DonutWithLegend slices={interestSlices} centerValue={interestTotal} centerLabel="LEADS" />
              </Box>
            )}
          </DashCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <DashCard icon={<DonutLargeIcon />} color="info" title="Pipeline by Status">
            {pipeline.isLoading && <SectionLoading />}
            {pipeline.data && pipeline.data.totalLeads === 0 && <EmptyNote>No leads yet.</EmptyNote>}
            {pipeline.data && pipeline.data.totalLeads > 0 && (
              <Box sx={{ minHeight: CHART_HEIGHT, display: "flex" }}>
                <DonutWithLegend
                  slices={statusSlices.filter((s) => s.value > 0)}
                  centerValue={pipeline.data.totalLeads}
                  centerLabel="ALL LEADS"
                />
              </Box>
            )}
          </DashCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <DashCard icon={<BusinessIcon />} color="warning" title="By Business Type">
            {data.byBusinessType.length === 0 ? (
              <EmptyNote>No data.</EmptyNote>
            ) : (
              <Box sx={{ height: CHART_HEIGHT }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byBusinessType} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                    <RechartsTooltip {...chart.tooltip} />
                    <Bar dataKey="count" name="Leads" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </DashCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <DashCard icon={<TodayIcon />} color="primary" title="Follow-ups & Closures">
            <StatRows
              rows={[
                { label: "Today", value: data.followUpSummary.todayCount },
                { label: "Tomorrow", value: data.followUpSummary.tomorrowCount },
                { label: "Next 7 days", value: data.followUpSummary.next7DaysCount },
                { label: "Overdue", value: data.followUpSummary.overdueCount, color: "error" },
                { label: "Unassigned", value: data.followUpSummary.unassignedCount },
                { label: "Closing this week", value: data.expectedClosures.thisWeek },
                { label: "Closing this month", value: data.expectedClosures.thisMonth },
                { label: "Closing next month", value: data.expectedClosures.nextMonth },
              ]}
            />
          </DashCard>
        </Grid>
      </Grid>

      <InterestReasonsCard filters={filters} />
    </Stack>
  );
}

// ───────────────────────────── Leads ─────────────────────────────

function LeadsTab({ filters }: { filters: ReportFilters }) {
  const navigate = useNavigate();
  const { params } = filters;
  const leadParams = {
    status: params.status,
    ownerId: params.ownerId,
    interestLevelId: params.interestLevelId,
    interestReasonId: params.interestReasonId,
    stateId: params.stateId,
    cityId: params.cityId,
    productId: params.productId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };
  // The page number belongs to one filter set: changing any filter starts again from page 1.
  const filterKey = JSON.stringify(leadParams);
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const [pageSize, setPageSize] = useRowsPerPage();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const { data, isLoading, isError, error } = useLeads({ ...leadParams, page, size: pageSize });
  const matrix = useInterestLevelStatusMatrix();

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getLeads({ ...leadParams, size: 1000 });
      exportToCsv(`leads-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Company", value: (l) => l.companyName },
        { label: "Contact Person", value: (l) => l.contactPerson },
        { label: "Contact No", value: (l) => l.contactNo },
        { label: "Status", value: (l) => LEAD_STATUS_LABELS[l.status] },
        { label: "Created", value: (l) => dayjs(l.createdAt).format("YYYY-MM-DD") },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <DashCard
        icon={<ListAltIcon />}
        title="All Leads"
        action={
          <ExportButton onClick={handleExport} loading={exportLoading} disabled={!data || data.totalElements === 0} />
        }
      >
        {exportError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setExportError(null)}>
            {exportError}
          </Alert>
        )}
        {isLoading && <SectionLoading />}
        {isError && <ErrorNote error={error} />}
        {data && (
          <>
            <DataTable
              rows={data.content}
              rowKey={(l) => l.id}
              onRowClick={(l) => navigate(`/app/leads/${l.id}`)}
              emptyText="No leads match these filters."
              columns={[
                { label: "Company", render: (l) => l.companyName },
                { label: "Contact", render: (l) => l.contactPerson },
                { label: "Phone", render: (l) => l.contactNo },
                {
                  label: "Status",
                  render: (l) => <Chip size="small" label={LEAD_STATUS_LABELS[l.status]} color={LEAD_STATUS_COLORS[l.status]} />,
                },
                { label: "Created", render: (l) => dayjs(l.createdAt).format("DD MMM YYYY") },
              ]}
            />
            <TablePager
              page={page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              pageSize={pageSize}
              onPageChange={(next) => setPageState({ key: filterKey, page: next })}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPageState({ key: filterKey, page: 0 });
              }}
            />
          </>
        )}
      </DashCard>

      <DashCard icon={<GridOnIcon />} color="secondary" title="Interest Level × Status">
        {matrix.isLoading && <SectionLoading />}
        {matrix.isError && <ErrorNote error={matrix.error} />}
        {matrix.data && (
          <DataTable
            rows={matrix.data.rows}
            rowKey={(r) => r.interestLevel}
            columns={[
              { label: "Interest level", render: (r) => r.interestLevel },
              ...LEAD_STATUSES.map((status) => ({
                label: LEAD_STATUS_LABELS[status],
                align: "right" as const,
                render: (r: { byStatus: Record<LeadStatus, number> }) => r.byStatus[status] ?? 0,
              })),
              { label: "Total", align: "right", render: (r) => <strong>{r.total}</strong> },
            ]}
          />
        )}
      </DashCard>
    </Stack>
  );
}

// ───────────────────────────── Performance ─────────────────────────────

function PerformanceTab({ filters }: { filters: ReportFilters }) {
  const { data, isLoading, isError, error } = useLeadDashboard(filters.params);
  const pipeline = usePipelineSummary();

  const exportOwners = () => {
    if (!pipeline.data) return;
    exportToCsv(`per-salesperson-breakdown-${dayjs().format("YYYY-MM-DD")}.csv`, pipeline.data.byOwner, [
      { label: "Owner", value: (o) => o.ownerName },
      { label: "Lead Count", value: (o) => o.leadCount },
      { label: "Closed-Won Count", value: (o) => o.closedWonCount },
      { label: "Win Rate", value: (o) => (o.leadCount === 0 ? "" : pct((o.closedWonCount / o.leadCount) * 100)) },
    ]);
  };

  return (
    <Stack spacing={2}>
      {isLoading && <SectionLoading />}
      {isError && <ErrorNote error={error} />}
      {data && (
        <>
          <DashCard icon={<LeaderboardIcon />} title="Employee Performance">
            <DataTable
              rows={data.employeePerformance}
              rowKey={(r) => r.employeeName}
              columns={[
                { label: "Employee", render: (r) => r.employeeName },
                { label: "Total leads", align: "right", render: (r) => r.total },
                { label: "Hot", align: "right", render: (r) => r.hot },
                { label: "Follow-up pending", align: "right", render: (r) => r.followUpPending },
                { label: "Won", align: "right", render: (r) => r.won },
                { label: "Conv. %", align: "right", render: (r) => pct(r.conversionRatePercent) },
              ]}
            />
          </DashCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <DashCard icon={<BusinessIcon />} color="info" title="Company Wise">
                <DataTable
                  rows={data.companyWiseSummary.slice(0, 50)}
                  rowKey={(r) => r.company}
                  columns={[
                    { label: "Company", render: (r) => r.company },
                    { label: "Total", align: "right", render: (r) => r.total },
                    { label: "Hot", align: "right", render: (r) => r.hot },
                    { label: "Won", align: "right", render: (r) => r.won },
                    { label: "Lost", align: "right", render: (r) => r.lost },
                  ]}
                />
              </DashCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <DashCard icon={<LocationCityIcon />} color="warning" title="City Wise">
                <DataTable
                  rows={data.cityWiseSummary.slice(0, 50)}
                  rowKey={(r) => r.city}
                  columns={[
                    { label: "City", render: (r) => r.city },
                    { label: "Total", align: "right", render: (r) => r.total },
                    { label: "Hot", align: "right", render: (r) => r.hot },
                    { label: "Won", align: "right", render: (r) => r.won },
                  ]}
                />
              </DashCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <DashCard icon={<InventoryIcon />} color="success" title="Product Performance">
                <DataTable
                  rows={data.productPerformance.slice(0, 50)}
                  rowKey={(r) => r.product}
                  columns={[
                    { label: "Product", render: (r) => r.product },
                    { label: "Total", align: "right", render: (r) => r.total },
                    { label: "Won", align: "right", render: (r) => r.won },
                    { label: "Conv. %", align: "right", render: (r) => pct(r.conversionRatePercent) },
                  ]}
                />
              </DashCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <DashCard icon={<WhatshotOutlinedIcon />} color="error" title="Interest Level Performance">
                <DataTable
                  rows={data.interestLevelPerformance}
                  rowKey={(r) => r.interestLevel}
                  columns={[
                    { label: "Interest level", render: (r) => r.interestLevel },
                    { label: "Total", align: "right", render: (r) => r.total },
                    { label: "Won", align: "right", render: (r) => r.won },
                    { label: "Conv. %", align: "right", render: (r) => pct(r.conversionRatePercent) },
                  ]}
                />
              </DashCard>
            </Grid>
          </Grid>
        </>
      )}

      <DashCard
        icon={<FilterAltIcon />}
        color="secondary"
        title="Per-Salesperson Breakdown"
        action={<ExportButton onClick={exportOwners} disabled={!pipeline.data || pipeline.data.byOwner.length === 0} />}
      >
        {pipeline.isLoading && <SectionLoading />}
        {pipeline.isError && <ErrorNote error={pipeline.error} />}
        {pipeline.data && (
          <DataTable
            rows={pipeline.data.byOwner}
            rowKey={(o) => o.ownerId}
            columns={[
              { label: "Owner", render: (o) => o.ownerName },
              { label: "Leads", align: "right", render: (o) => o.leadCount },
              { label: "Closed won", align: "right", render: (o) => o.closedWonCount },
              {
                label: "Win rate",
                align: "right",
                render: (o) => (o.leadCount === 0 ? "—" : pct((o.closedWonCount / o.leadCount) * 100)),
              },
            ]}
          />
        )}
      </DashCard>
      <Typography variant="caption" color="text.secondary">
        The per-salesperson breakdown covers all leads and ignores the filters above.
      </Typography>
    </Stack>
  );
}

// ───────────────────────────── Visits ─────────────────────────────

function VisitsTab({ filters }: { filters: ReportFilters }) {
  const theme = useTheme();
  const chart = useChartStyles();
  // Visits follow the page-level period (their own visit date, not lead creation date).
  const from = filters.params.dateFrom;
  const to = filters.params.dateTo;
  const summary = useVisitsCompletedVsMissed(from, to);
  const byType = useVisitsByType(from, to);

  const statusData = summary.data
    ? [
        { name: "Completed", value: summary.data.completed, color: theme.palette.success.main },
        { name: "Planned", value: summary.data.planned, color: theme.palette.info.main },
        { name: "Missed", value: summary.data.missed, color: theme.palette.error.main },
      ]
    : [];
  const typeSlices: DonutSlice[] = byType.data
    ? [
        { label: "Field", value: byType.data.byType.FIELD ?? 0, color: theme.palette.primary.main },
        { label: "Telephonic", value: byType.data.byType.TELEPHONIC ?? 0, color: theme.palette.secondary.main },
      ]
    : [];

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Completion"
            value={summary.data ? pct(summary.data.completionRatePercent) : "…"}
            caption="Completed visits"
            icon={<EventAvailableIcon />}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Completed" value={summary.data?.completed ?? "…"} caption="Done" icon={<EventAvailableIcon />} color="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Planned" value={summary.data?.planned ?? "…"} caption="Upcoming" icon={<TodayIcon />} color="info" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Missed" value={summary.data?.missed ?? "…"} caption="Not done" icon={<EventBusyIcon />} color="error" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <DashCard icon={<EventAvailableIcon />} color="success" title="Completed vs Missed">
            {summary.isLoading && <SectionLoading />}
            {summary.isError && <ErrorNote error={summary.error} />}
            {summary.data && (
              <Box sx={{ height: CHART_HEIGHT + 20 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                    <RechartsTooltip {...chart.tooltip} />
                    <Bar dataKey="value" name="Visits" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </DashCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <DashCard icon={<PlaceIcon />} color="info" title="Visits by Type">
            {byType.isLoading && <SectionLoading />}
            {byType.isError && <ErrorNote error={byType.error} />}
            {byType.data && byType.data.total === 0 && <EmptyNote>No visits yet.</EmptyNote>}
            {byType.data && byType.data.total > 0 && (
              <Box sx={{ minHeight: CHART_HEIGHT, display: "flex" }}>
                <DonutWithLegend slices={typeSlices} centerValue={byType.data.total} centerLabel="VISITS" />
              </Box>
            )}
          </DashCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

// ───────────────────────────── Team ─────────────────────────────

function TeamTab() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useTeamProgress();

  const handleExport = () => {
    if (!data) return;
    exportToCsv(`team-progress-${dayjs().format("YYYY-MM-DD")}.csv`, data.members, [
      { label: "Team Member", value: (m) => m.employeeName },
      { label: "Total Leads", value: (m) => m.totalLeads },
      ...LEAD_STATUSES.map((status) => ({
        label: LEAD_STATUS_LABELS[status],
        value: (m: TeamMemberProgress) => m.leadCountsByStatus[status] ?? 0,
      })),
      { label: "Visits Due Today", value: (m) => m.visitsDueToday },
      { label: "Visits Upcoming (7d)", value: (m) => m.visitsUpcoming },
      { label: "Last Activity", value: (m) => (m.lastActivityAt ? dayjs(m.lastActivityAt).format("YYYY-MM-DD HH:mm") : "") },
    ]);
  };

  return (
    <DashCard
      icon={<GroupWorkIcon />}
      title="Team Progress"
      action={<ExportButton onClick={handleExport} disabled={!data || data.members.length === 0} />}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Each team member's lead pipeline, upcoming visits and last activity. Click a row for details.
      </Typography>
      {isLoading && <SectionLoading />}
      {isError && <ErrorNote error={error} />}
      {data && (
        <DataTable
          rows={data.members}
          rowKey={(m) => m.employeeId}
          onRowClick={(m) => navigate(`/app/team/${m.employeeId}`)}
          emptyText="No team members to show yet."
          columns={[
            { label: "Team member", render: (m) => <><PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: "-2px", color: "text.secondary" }} />{m.employeeName}</> },
            { label: "Total", align: "right", render: (m) => <strong>{m.totalLeads}</strong> },
            ...LEAD_STATUSES.map((status) => ({
              label: LEAD_STATUS_LABELS[status],
              align: "right" as const,
              render: (m: TeamMemberProgress) => m.leadCountsByStatus[status] ?? 0,
            })),
            {
              label: "Due today",
              align: "right",
              render: (m) => (m.visitsDueToday > 0 ? <Chip label={m.visitsDueToday} size="small" color="warning" /> : 0),
            },
            { label: "Upcoming (7d)", align: "right", render: (m) => m.visitsUpcoming },
            {
              label: "Last activity",
              render: (m) => (m.lastActivityAt ? dayjs(m.lastActivityAt).format("DD MMM YYYY, HH:mm") : "No activity yet"),
            },
          ]}
        />
      )}
    </DashCard>
  );
}

// ───────────────────────────── Page ─────────────────────────────

/**
 * Reports, split into five sub-sections (Overview, Leads, Performance, Visits, Team) so the page
 * is short and easy to navigate. One search-style filter bar drives the lead-based tabs; the
 * selected tab is kept in the URL (?tab=) so a section can be bookmarked or shared.
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "overview";
  const filters = useReportFilters();
  const filtered = tab === "overview" || tab === "leads" || tab === "performance";
  const dated = tab !== "team";

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Reports
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2, px: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, next: TabId) => setSearchParams(next === "overview" ? {} : { tab: next }, { replace: true })}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} sx={{ textTransform: "none", minHeight: 44 }} />
          ))}
        </Tabs>
      </Paper>

      {dated && <ReportPeriodBar filters={filters} />}
      {filtered && <ReportFilterBar filters={filters} scope={tab === "leads" ? "leads" : "all"} />}

      {tab === "overview" && <OverviewTab filters={filters} />}
      {tab === "leads" && <LeadsTab filters={filters} />}
      {tab === "performance" && <PerformanceTab filters={filters} />}
      {tab === "visits" && <VisitsTab filters={filters} />}
      {tab === "team" && <TeamTab />}
    </Box>
  );
}
