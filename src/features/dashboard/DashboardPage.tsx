import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueryClient } from "@tanstack/react-query";
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
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import PercentIcon from "@mui/icons-material/Percent";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import PublicIcon from "@mui/icons-material/Public";
import BarChartIcon from "@mui/icons-material/BarChart";
import TodayIcon from "@mui/icons-material/Today";
import EventNoteIcon from "@mui/icons-material/EventNote";
import HistoryIcon from "@mui/icons-material/History";
import BoltIcon from "@mui/icons-material/Bolt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TimelineIcon from "@mui/icons-material/Timeline";
import { useAuth } from "../../auth/AuthContext";
import { useEntitlements } from "../../entitlement/EntitlementContext";
import { LEAD_STATUSES } from "../../api/leadsApi";
import type { LeadStatus } from "../../api/leadsApi";
import { useLead } from "../../api/leadsApi";
import {
  useConversionRate,
  useLeadsBySource,
  usePipelineSummary,
  useRevenue,
  useVisitsCompletedVsMissed,
} from "../../api/reportingApi";
import { useTodaysFollowUps, useVisits } from "../../api/visitsApi";
import type { Visit } from "../../api/visitsApi";
import { useActivity } from "../../api/activityApi";
import { useEmployees } from "../../api/employeesApi";
import { parseApiError } from "../../api/errorHelpers";
import { TypeIconAvatar } from "../../components/TypeIconAvatar";
import {
  CHART_PALETTE,
  DashCard as BaseDashCard,
  DonutWithLegend,
  EmptyNote,
  KpiCard,
  SectionLoading,
  useChartStyles,
} from "../../components/dashboardParts";
import type { DonutSlice } from "../../components/dashboardParts";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "../leads/leadStatusConfig";
import {
  resolveActorName,
  activityIcon,
  activityColor,
} from "../activity/activityConfig";

/** Only the stages that represent forward progress - LOST/LAPSED are drop-offs and are covered
 * by the Lead Status chart. A bar chart (not a funnel): stage counts aren't strictly shrinking,
 * so a funnel shape would distort. */
const PIPELINE_STATUSES: LeadStatus[] = ["NEW", "INTERESTED", "CONTACTED", "NEGOTIATION", "CLOSED_WON"];

const CARD_HEIGHT = 360;

function greeting(): string {
  const hour = dayjs().hour();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "gourav.kumar@x.com" -> "Gourav" - the JWT carries only the email, so this is the friendliest
 * name available without an extra request. */
function displayName(email: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0].split(/[._-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

/** The dashboard's cards share one fixed height so each row of cards lines up. */
function DashCard(props: Omit<Parameters<typeof BaseDashCard>[0], "height">) {
  return <BaseDashCard height={CARD_HEIGHT} {...props} />;
}

function SalesPipelineCard() {
  const { data, isLoading, isError, error } = usePipelineSummary();
  const chart = useChartStyles();
  const chartData = PIPELINE_STATUSES.map((status) => ({
    name: LEAD_STATUS_LABELS[status],
    value: data?.byStatus[status] ?? 0,
  }));

  return (
    <DashCard icon={<FilterAltIcon />} title="Sales Pipeline" linkTo="/app/reports">
      {isLoading && <SectionLoading />}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {data && (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
              <RechartsTooltip {...chart.tooltip} />
              <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={18}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </DashCard>
  );
}

function LeadsBySourceCard() {
  const { data, isLoading, isError, error } = useLeadsBySource();
  const total = data?.bySource.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const slices: DonutSlice[] = (data?.bySource ?? []).map((row, index) => ({
    label: row.label,
    value: row.count,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
  }));

  return (
    <DashCard icon={<PublicIcon />} color="info" title="Leads by Source" linkTo="/app/leads">
      {isLoading && <SectionLoading />}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {data && total === 0 && <EmptyNote>No leads yet.</EmptyNote>}
      {data && total > 0 && <DonutWithLegend slices={slices} centerValue={total} centerLabel="LEADS" />}
    </DashCard>
  );
}

function VisitsOverviewCard() {
  const theme = useTheme();
  const { data, isLoading, isError, error } = useVisitsCompletedVsMissed();
  const total = data ? data.completed + data.missed + data.planned : 0;
  const slices: DonutSlice[] = data
    ? [
        { label: "Completed", value: data.completed, color: theme.palette.success.main },
        { label: "Planned", value: data.planned, color: theme.palette.info.main },
        { label: "Missed", value: data.missed, color: theme.palette.error.main },
      ]
    : [];

  return (
    <DashCard icon={<DonutLargeIcon />} color="success" title="Visits Overview" linkTo="/app/reports">
      {isLoading && <SectionLoading />}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {data && total === 0 && <EmptyNote>No visits yet.</EmptyNote>}
      {data && total > 0 && (
        <DonutWithLegend
          slices={slices}
          centerValue={`${Math.round(data.completionRatePercent)}%`}
          centerLabel="COMPLETED"
        />
      )}
    </DashCard>
  );
}

function LeadStatusCard() {
  const { data, isLoading, isError, error } = usePipelineSummary();
  const theme = useTheme();
  const chart = useChartStyles();
  const colorFor = (status: LeadStatus) => {
    const key = LEAD_STATUS_COLORS[status];
    return key === "default" ? theme.palette.grey[500] : theme.palette[key].main;
  };
  const chartData = LEAD_STATUSES.map((status) => ({
    name: LEAD_STATUS_LABELS[status],
    value: data?.byStatus[status] ?? 0,
    status,
  }));

  return (
    <DashCard icon={<BarChartIcon />} color="warning" title="Lead Status" linkTo="/app/leads">
      {isLoading && <SectionLoading />}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {data && (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
              <RechartsTooltip {...chart.tooltip} />
              <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={colorFor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </DashCard>
  );
}

/** One row for Today's Follow-ups and Upcoming Visits - resolves the parent lead's company name
 * per row (short lists, same acceptable N+1 as TodaysFollowUpsPage) and links into that lead. */
function VisitRow({ visit, showDate }: { visit: Visit; showDate: boolean }) {
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(visit.leadId);
  const when = [
    showDate ? dayjs(visit.visitDate).format("DD MMM") : null,
    visit.scheduledTime ? visit.scheduledTime.slice(0, 5) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Stack
      direction="row"
      spacing={1.5}
      onClick={() => navigate(`/app/leads/${visit.leadId}`)}
      sx={{
        alignItems: "center",
        cursor: "pointer",
        py: 1,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {isLoading ? "…" : (lead?.companyName ?? "—")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {when || "No time set"}
        </Typography>
      </Box>
    </Stack>
  );
}

function TodaysFollowUpsCard() {
  const { data: visits, isLoading } = useTodaysFollowUps();
  const top = (visits ?? []).slice(0, 5);

  return (
    <DashCard icon={<TodayIcon />} color="primary" title="Today's Follow-ups" linkTo="/app/todays-follow-ups">
      {isLoading && <SectionLoading />}
      {!isLoading && top.length === 0 && <EmptyNote>No follow-ups due today.</EmptyNote>}
      {top.length > 0 && (
        <Box sx={{ overflowY: "auto" }}>
          {top.map((visit) => (
            <VisitRow key={visit.id} visit={visit} showDate={false} />
          ))}
        </Box>
      )}
    </DashCard>
  );
}

function UpcomingVisitsCard() {
  const { data, isLoading } = useVisits({
    status: "PLANNED",
    dateFrom: dayjs().add(1, "day").format("YYYY-MM-DD"),
    dateTo: dayjs().add(7, "day").format("YYYY-MM-DD"),
    size: 5,
  });
  const visits = data?.content ?? [];

  return (
    <DashCard icon={<EventNoteIcon />} color="info" title="Upcoming Visits" linkTo="/app/leads">
      {isLoading && <SectionLoading />}
      {!isLoading && visits.length === 0 && <EmptyNote>Nothing scheduled in the next 7 days.</EmptyNote>}
      {visits.length > 0 && (
        <Box sx={{ overflowY: "auto" }}>
          {visits.map((visit) => (
            <VisitRow key={visit.id} visit={visit} showDate />
          ))}
        </Box>
      )}
    </DashCard>
  );
}

function RecentActivityCard() {
  const { data, isLoading, isError, error } = useActivity({ size: 5 });
  const { data: employeesPage } = useEmployees({ size: 200 });
  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeesPage?.content ?? []) map.set(emp.id, emp.fullName);
    return map;
  }, [employeesPage]);
  const entries = data?.content ?? [];

  return (
    <DashCard icon={<HistoryIcon />} color="secondary" title="Recent Activity" linkTo="/app/activity">
      {isLoading && <SectionLoading />}
      {isError && <Alert severity="error">{parseApiError(error).message}</Alert>}
      {!isLoading && !isError && entries.length === 0 && <EmptyNote>No activity yet.</EmptyNote>}
      {entries.length > 0 && (
        <Stack spacing={1.5} sx={{ overflowY: "auto" }}>
          {entries.map((entry) => (
            <Stack key={entry.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <TypeIconAvatar
                icon={activityIcon(entry.type)}
                color={activityColor(entry.type)}
                size={30}
              />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap>
                  {entry.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {entry.companyName} · {resolveActorName(entry.actorId, employeeNameById)} ·{" "}
                  {dayjs(entry.createdAt).format("DD MMM, HH:mm")}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </DashCard>
  );
}

function QuickActionsCard() {
  const { role } = useAuth();
  const { hasEntitlement } = useEntitlements();
  const canBill = hasEntitlement("INVENTORY_MANAGEMENT");
  const actions: { label: string; to: string; icon: ReactNode; show: boolean }[] = [
    { label: "Add Lead", to: "/app/leads", icon: <PersonAddIcon fontSize="small" />, show: true },
    { label: "Import Leads", to: "/app/leads/import", icon: <UploadFileIcon fontSize="small" />, show: role === "ADMIN" },
    { label: "New Quotation", to: "/app/quotations/new", icon: <DescriptionIcon fontSize="small" />, show: canBill },
    { label: "New Invoice", to: "/app/invoices/new", icon: <ReceiptLongIcon fontSize="small" />, show: canBill },
    { label: "Reports", to: "/app/reports", icon: <AssessmentIcon fontSize="small" />, show: true },
    { label: "Activity Log", to: "/app/activity", icon: <TimelineIcon fontSize="small" />, show: true },
  ];

  return (
    <DashCard icon={<BoltIcon />} color="warning" title="Quick Actions">
      <Grid container spacing={1.25}>
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Grid key={a.label} size={6}>
              <Button
                component={RouterLink}
                to={a.to}
                variant="outlined"
                color="inherit"
                startIcon={a.icon}
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  py: 1.25,
                  borderColor: "divider",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {a.label}
              </Button>
            </Grid>
          ))}
      </Grid>
    </DashCard>
  );
}

/**
 * Admin / TEAM_VISIBILITY-entitled-manager landing page (a plain EMPLOYEE still gets
 * TodaysFollowUpsPage at the same /app route - the org-wide aggregates here come from the same
 * reporting endpoints ReportsPage uses, which 403 for anyone without manager-level access).
 * Layout: greeting + KPI strip, then charts, then work lists - fixed-height cards so rows align.
 */
export function DashboardPage() {
  const { email } = useAuth();
  const queryClient = useQueryClient();
  const { data: pipeline } = usePipelineSummary();
  const { data: conversion } = useConversionRate();
  const { data: visitsSummary } = useVisitsCompletedVsMissed();
  const { data: revenue } = useRevenue();
  const name = displayName(email);
  const dash = "…";

  const kpis: Parameters<typeof KpiCard>[0][] = [
    {
      label: "Total Leads",
      value: pipeline?.totalLeads ?? dash,
      caption: "In your pipeline",
      icon: <GroupsIcon />,
      color: "primary",
    },
    {
      label: "Conversions",
      value: conversion?.closedWonCount ?? dash,
      caption: conversion ? `${conversion.lostCount} lost` : " ",
      icon: <EmojiEventsIcon />,
      color: "success",
    },
    {
      label: "Conversion Rate",
      value: conversion ? `${Math.round(conversion.conversionRatePercent)}%` : dash,
      caption: "Closed won / total",
      icon: <PercentIcon />,
      color: "info",
    },
    {
      label: "Open Visits",
      value: visitsSummary?.planned ?? dash,
      caption: "Planned, not yet done",
      icon: <EventAvailableIcon />,
      color: "warning",
    },
    {
      label: "Visit Completion",
      value: visitsSummary ? `${Math.round(visitsSummary.completionRatePercent)}%` : dash,
      caption: visitsSummary ? `${visitsSummary.missed} missed` : " ",
      captionColor: visitsSummary && visitsSummary.missed > 0 ? "error" : undefined,
      icon: <TaskAltIcon />,
      color: "success",
    },
  ];
  if (revenue?.entitled) {
    kpis.push({
      label: "Revenue (YTD)",
      value: `₹${revenue.revenue.toLocaleString("en-IN")}`,
      caption: "Invoiced this year",
      icon: <CurrencyRupeeIcon />,
      color: "secondary",
    });
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 3, gap: 1.5 }}
      >
        <Box>
          <Typography variant="h4">
            {greeting()}
            {name ? `, ${name}` : ""}!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Here's what's happening with your sales today.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            icon={<CalendarTodayIcon fontSize="small" />}
            label={dayjs().format("MMM D, YYYY (dddd)")}
            variant="outlined"
            sx={{ borderRadius: 2, height: 36 }}
          />
          <Tooltip title="Refresh data">
            <IconButton
              onClick={() => queryClient.invalidateQueries()}
              sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
              aria-label="Refresh dashboard"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 4, lg: 12 / kpis.length }}>
            <KpiCard {...kpi} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SalesPipelineCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <LeadsBySourceCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <VisitsOverviewCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <LeadStatusCard />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <TodaysFollowUpsCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <UpcomingVisitsCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <RecentActivityCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <QuickActionsCard />
        </Grid>
      </Grid>
    </Box>
  );
}
