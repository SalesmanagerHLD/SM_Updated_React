import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, CircularProgress, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

/**
 * Building blocks shared by the Dashboard and the Reports page so both look like one product:
 * a rounded card with a tinted icon + title header, KPI tiles, a donut with a centre figure and
 * a compact legend, and one set of chart colours/tooltip styling.
 */

export const CHART_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899"];

export type PaletteKey = "primary" | "success" | "warning" | "error" | "info" | "secondary";

export function SectionLoading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexGrow: 1, py: 4 }}>
      <CircularProgress size={26} />
    </Box>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexGrow: 1, py: 4 }}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

/** Shared card chrome: tinted icon + title on the left, optional "View all" link on the right,
 * fixed height so a row of cards lines up whatever it contains. */
export function DashCard({
  icon,
  color = "primary",
  title,
  linkTo,
  linkLabel = "View all",
  action,
  height = "100%",
  children,
}: {
  icon: ReactNode;
  color?: PaletteKey;
  title: string;
  linkTo?: string;
  linkLabel?: string;
  /** Extra control (e.g. an Export button) shown at the right of the header. */
  action?: ReactNode;
  /** Fixed height for rows of cards that must line up (dashboard); omit to fit content. */
  height?: number | string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const main = theme.palette[color].main;
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, height, display: "flex", flexDirection: "column", borderRadius: 3 }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: alpha(main, 0.12),
              color: main,
              "& svg": { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
            {title}
          </Typography>
        </Stack>
        {action}
        {linkTo && (
          <MuiLink component={RouterLink} to={linkTo} variant="caption" underline="hover" sx={{ flexShrink: 0 }}>
            {linkLabel}
          </MuiLink>
        )}
      </Stack>
      {children}
    </Paper>
  );
}

export function KpiCard({
  label,
  value,
  caption,
  icon,
  color,
  captionColor,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  icon: ReactNode;
  color: PaletteKey;
  captionColor?: PaletteKey;
}) {
  const theme = useTheme();
  const main = theme.palette[color].main;
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 3 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            display: "flex",
            p: 0.75,
            borderRadius: 1.5,
            bgcolor: alpha(main, 0.12),
            color: main,
            "& svg": { fontSize: 18 },
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography variant="h5" sx={{ mt: 1, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: captionColor ? theme.palette[captionColor].main : "text.secondary" }}
      >
        {caption}
      </Typography>
    </Paper>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut with the headline figure in the middle and a compact legend (swatch, label, count)
 * beside it - reads at a glance, unlike labels drawn around the ring. */
export function DonutWithLegend({
  slices,
  centerValue,
  centerLabel,
}: {
  slices: DonutSlice[];
  centerValue: ReactNode;
  centerLabel: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexGrow: 1, minHeight: 0 }}>
      <Box sx={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={slices.filter((s) => s.value > 0).length > 1 ? 2 : 0}
              stroke="none"
            >
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <RechartsTooltip />
          </PieChart>
        </ResponsiveContainer>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
            {centerValue}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 0.5 }}>
            {centerLabel}
          </Typography>
        </Box>
      </Box>
      <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
        {slices.map((slice) => (
          <Stack key={slice.label} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: slice.color, flexShrink: 0 }} />
            <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>
              {slice.label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {slice.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export function useChartStyles() {
  const theme = useTheme();
  return {
    grid: theme.palette.divider,
    axis: theme.palette.text.secondary,
    tooltip: {
      contentStyle: {
        borderRadius: 8,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.background.paper,
        color: theme.palette.text.primary,
        fontSize: 12,
      },
      cursor: { fill: alpha(theme.palette.text.primary, 0.05) },
    },
  };
}
