import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  Badge,
  Box,
  ButtonBase,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import { LEAD_STATUSES } from "../../api/leadsApi";
import type { LeadStatus } from "../../api/leadsApi";
import type { GetLeadDashboardParams } from "../../api/reportingApi";
import { useMasterData } from "../../api/masterDataApi";
import { useEmployees } from "../../api/employeesApi";
import { LEAD_STATUS_LABELS } from "../leads/leadStatusConfig";

type SelectKey =
  | "status"
  | "ownerId"
  | "stateId"
  | "cityId"
  | "productId"
  | "interestLevelId"
  | "interestReasonId"
  | "businessTypeId";
type DateKey = "nextFollowupDate" | "expectedCloseDate";

export type ReportFilterValues = Record<SelectKey, string> & Record<DateKey, Dayjs | null>;

const EMPTY: ReportFilterValues = {
  status: "",
  ownerId: "",
  stateId: "",
  cityId: "",
  productId: "",
  interestLevelId: "",
  interestReasonId: "",
  businessTypeId: "",
  nextFollowupDate: null,
  expectedCloseDate: null,
};

/** Quick report periods. The actual dates are worked out here, never typed by the user. */
export type ReportPeriod = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom";

export const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom" },
];

/** The [from, to] range a preset stands for, relative to today (weeks run Monday to Sunday,
 * quarters are calendar quarters Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec). */
function periodRange(period: ReportPeriod, now: Dayjs): [Dayjs, Dayjs] | null {
  switch (period) {
    case "today":
      return [now.startOf("day"), now.endOf("day")];
    case "week": {
      const start = now.subtract((now.day() + 6) % 7, "day").startOf("day");
      return [start, start.add(6, "day").endOf("day")];
    }
    case "month":
      return [now.startOf("month"), now.endOf("month")];
    case "quarter": {
      const start = now.month(now.month() - (now.month() % 3)).startOf("month");
      return [start, start.add(2, "month").endOf("month")];
    }
    case "year":
      return [now.startOf("year"), now.endOf("year")];
    default:
      return null;
  }
}

const fmt = (d: Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined);

/** One shared filter state for the whole Reports page, so every tab sees the same filters. */
export function useReportFilters() {
  const [values, setValues] = useState<ReportFilterValues>(EMPTY);
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [customFrom, setCustomFrom] = useState<Dayjs | null>(null);
  const [customTo, setCustomTo] = useState<Dayjs | null>(null);

  // The date range sent to every report: a preset's computed range, the custom pair, or none.
  const range = useMemo(() => {
    if (period === "custom") return { from: customFrom, to: customTo };
    const preset = periodRange(period, dayjs());
    return { from: preset?.[0] ?? null, to: preset?.[1] ?? null };
  }, [period, customFrom, customTo]);

  const set = <K extends keyof ReportFilterValues>(key: K, value: ReportFilterValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const clear = () => setValues(EMPTY);

  const params: GetLeadDashboardParams = useMemo(
    () => ({
      status: (values.status || undefined) as LeadStatus | undefined,
      ownerId: values.ownerId || undefined,
      stateId: values.stateId || undefined,
      cityId: values.cityId || undefined,
      productId: values.productId || undefined,
      interestLevelId: values.interestLevelId || undefined,
      interestReasonId: values.interestReasonId || undefined,
      businessTypeId: values.businessTypeId || undefined,
      nextFollowupDate: fmt(values.nextFollowupDate),
      expectedCloseDate: fmt(values.expectedCloseDate),
      dateFrom: fmt(range.from),
      dateTo: fmt(range.to),
    }),
    [values, range],
  );

  const activeCount = Object.values(values).filter((v) => (typeof v === "string" ? v !== "" : v !== null)).length;
  return {
    values,
    set,
    clear,
    params,
    activeCount,
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range,
  };
}

export type ReportFilters = ReturnType<typeof useReportFilters>;

interface ReportFilterBarProps {
  filters: ReportFilters;
  /** "leads" hides the filters the lead-list endpoint can't apply (business type, follow-up and
   * expected-close dates), so the popover never offers a filter that would silently do nothing. */
  scope?: "all" | "leads";
}

/**
 * A single search-style bar instead of a wall of fields: click it to open a compact filter
 * panel, and the active filters sit beside it as removable chips.
 */
export function ReportFilterBar({ filters, scope = "all" }: ReportFilterBarProps) {
  const { values, set, clear, activeCount } = filters;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const { data: employees } = useEmployees({ size: 200 });
  const { data: states } = useMasterData("STATE");
  const { data: cities } = useMasterData("CITY");
  const { data: products } = useMasterData("PRODUCT");
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  const { data: businessTypes } = useMasterData("BUSINESS_TYPE");
  const { data: interestReasons } = useMasterData("INTEREST_REASON", true);
  const levelLabelById = new Map((interestLevels ?? []).map((i) => [i.id, i.label]));

  const selects: { key: SelectKey; label: string; options: { id: string; label: string }[]; leadsToo: boolean }[] = [
    {
      key: "ownerId",
      label: "Employee",
      options: (employees?.content ?? []).map((e) => ({ id: e.id, label: e.fullName })),
      leadsToo: true,
    },
    { key: "stateId", label: "State", options: (states ?? []).map((s) => ({ id: s.id, label: s.label })), leadsToo: true },
    { key: "cityId", label: "City", options: (cities ?? []).map((c) => ({ id: c.id, label: c.label })), leadsToo: true },
    { key: "productId", label: "Product", options: (products ?? []).map((p) => ({ id: p.id, label: p.label })), leadsToo: true },
    {
      key: "interestLevelId",
      label: "Interest",
      options: (interestLevels ?? []).map((i) => ({ id: i.id, label: i.label })),
      leadsToo: true,
    },
    {
      key: "interestReasonId",
      label: "Interest reason",
      // "Hot: Budget approved" - the level is part of the name since reasons repeat across levels.
      options: (interestReasons ?? []).map((r) => ({
        id: r.id,
        label: `${r.parentId ? (levelLabelById.get(r.parentId) ?? "") : ""}: ${r.label}`.replace(/^: /, ""),
      })),
      leadsToo: true,
    },
    {
      key: "businessTypeId",
      label: "Business type",
      options: (businessTypes ?? []).map((b) => ({ id: b.id, label: b.label })),
      leadsToo: false,
    },
    {
      key: "status",
      label: "Status",
      options: LEAD_STATUSES.map((s) => ({ id: s, label: LEAD_STATUS_LABELS[s] })),
      leadsToo: true,
    },
  ];
  const dates: { key: DateKey; label: string; leadsToo: boolean }[] = [
    { key: "nextFollowupDate", label: "Next follow-up", leadsToo: false },
    { key: "expectedCloseDate", label: "Expected close", leadsToo: false },
  ];
  const visibleSelects = selects.filter((s) => scope === "all" || s.leadsToo);
  const visibleDates = dates.filter((d) => scope === "all" || d.leadsToo);

  const chips: { key: keyof ReportFilterValues; text: string }[] = [];
  for (const s of visibleSelects) {
    const value = values[s.key];
    if (value) chips.push({ key: s.key, text: `${s.label}: ${s.options.find((o) => o.id === value)?.label ?? "…"}` });
  }
  for (const d of visibleDates) {
    const value = values[d.key];
    if (value) chips.push({ key: d.key, text: `${d.label}: ${value.format("DD MMM YYYY")}` });
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Paper
          variant="outlined"
          component={ButtonBase}
          onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
          aria-haspopup="dialog"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1,
            px: 1.5,
            height: 38,
            width: { xs: "100%", sm: 420 },
            maxWidth: "100%",
            borderRadius: 2.5,
            color: "text.secondary",
            "&:hover": { borderColor: "primary.main" },
          }}
        >
          <SearchIcon fontSize="small" />
          <Typography variant="body2" color="text.secondary" noWrap sx={{ flexGrow: 1, textAlign: "left" }}>
            Search or filter reports…
          </Typography>
          <Badge badgeContent={activeCount} color="primary" invisible={activeCount === 0}>
            <TuneIcon fontSize="small" />
          </Badge>
        </Paper>

        {chips.map((chip) => (
          <Chip
            key={chip.key}
            size="small"
            label={chip.text}
            onDelete={() => set(chip.key, (typeof values[chip.key] === "string" ? "" : null) as never)}
          />
        ))}
        {activeCount > 0 && (
          <Button size="small" onClick={clear}>
            Clear all
          </Button>
        )}
      </Stack>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.5, p: 2, width: { xs: "calc(100vw - 32px)", sm: 600 }, borderRadius: 3 } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Filter reports
        </Typography>
        <Grid container spacing={1.5}>
          {visibleSelects.map((s) => (
            <Grid key={s.key} size={{ xs: 6, sm: 4 }}>
              <TextField
                select
                fullWidth
                label={s.label}
                margin="none"
                value={values[s.key]}
                onChange={(e) => set(s.key, e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {s.options.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ))}
          {visibleDates.map((d) => (
            <Grid key={d.key} size={{ xs: 6, sm: 4 }}>
              <DatePicker
                label={d.label}
                value={values[d.key]}
                onChange={(v) => set(d.key, v)}
                slotProps={{ textField: { fullWidth: true, size: "small", margin: "none" }, field: { clearable: true } }}
              />
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" sx={{ justifyContent: "space-between", mt: 2 }}>
          <Button size="small" onClick={clear} disabled={activeCount === 0}>
            Clear all
          </Button>
          <Button size="small" variant="contained" onClick={() => setAnchor(null)}>
            Done
          </Button>
        </Stack>
      </Popover>
    </Box>
  );
}

/**
 * Quick period picker for the top of the Reports page: one tap for this week / month / quarter /
 * year, or "Custom" to reveal a created-from / created-to pair. The date range itself is computed
 * behind the scenes (see periodRange) and fed to every report.
 */
export function ReportPeriodBar({ filters }: { filters: ReportFilters }) {
  const { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, range } = filters;

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, mb: 1.5 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={period}
        onChange={(_, next: ReportPeriod | null) => next && setPeriod(next)}
        aria-label="Report period"
        sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { textTransform: "none", px: 1.5, py: 0.5 } }}
      >
        {PERIOD_OPTIONS.map((option) => (
          <ToggleButton key={option.id} value={option.id}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {period === "custom" ? (
        <>
          <DatePicker
            label="Created from"
            value={customFrom}
            onChange={setCustomFrom}
            maxDate={customTo ?? undefined}
            slotProps={{ textField: { size: "small", margin: "none", sx: { width: 160 } }, field: { clearable: true } }}
          />
          <DatePicker
            label="Created to"
            value={customTo}
            onChange={setCustomTo}
            minDate={customFrom ?? undefined}
            slotProps={{ textField: { size: "small", margin: "none", sx: { width: 160 } }, field: { clearable: true } }}
          />
        </>
      ) : (
        range.from &&
        range.to && (
          <Typography variant="caption" color="text.secondary">
            {range.from.format("DD MMM YYYY")} – {range.to.format("DD MMM YYYY")}
          </Typography>
        )
      )}
    </Stack>
  );
}
