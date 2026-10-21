import { alpha, createTheme, type Theme } from "@mui/material/styles";

/**
 * Fully-resolved theme inputs, ready for MUI consumption (lowercase mode/density,
 * merged from org branding + personal preference + hardcoded fallbacks — see
 * `resolveEffectiveTheme` in `./ThemeContext.tsx` for how this is produced).
 */
export interface EffectiveThemeSettings {
  primaryColor: string;
  mode: "light" | "dark";
  density: "comfortable" | "compact";
  uiStyle: "standard" | "minimalist";
}

/**
 * Builds the MUI theme from fully-resolved settings. Org branding + optional
 * per-user override are merged upstream (see ThemeContext.tsx); this factory only
 * ever sees the final, effective values. The ultimate fallback for anyone who
 * hasn't customized anything is set in ThemeContext.tsx's HARDCODED_DEFAULTS
 * (indigo "#6366f1", light mode, comfortable density, as of the 2026-07-29 reskin).
 */
export function createAppTheme(settings: EffectiveThemeSettings): Theme {
  const isCompact = settings.density === "compact";
  const isMinimalist = settings.uiStyle === "minimalist";

  // NOTE: this MUI version's createTheme internals call Object.keys(components)
  // unconditionally, which throws if `components` is `undefined` — so this must
  // always be a real object (possibly empty), never `undefined`.
  const densityComponents = isCompact
    ? {
        MuiButton: {
          defaultProps: {
            size: "small" as const,
          },
        },
        MuiTextField: {
          defaultProps: {
            size: "small" as const,
            margin: "dense" as const,
          },
        },
        MuiFormControl: {
          defaultProps: {
            size: "small" as const,
            margin: "dense" as const,
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              paddingTop: 6,
              paddingBottom: 6,
            },
          },
        },
        MuiToolbar: {
          styleOverrides: {
            regular: {
              minHeight: 52,
            },
          },
        },
      }
    : {};

  // "Minimalist" UI style (Settings > Theme): a flatter, lower-visual-noise look layered on
  // top of the base/density component overrides below - no shadows, a plain left-border nav
  // highlight instead of the default rounded/filled pill, lighter Chip/heading weights. Never
  // touches palette colors (primary/secondary/mode) - those stay exactly as chosen, this is
  // purely about reducing decoration, not re-theming hue.
  const minimalistComponents = isMinimalist
    ? {
        MuiPaper: {
          styleOverrides: {
            elevation1: { boxShadow: "none" },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: { boxShadow: "none" },
          },
        },
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 400 },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: ({ theme }: { theme: Theme }) => ({
              borderRadius: 0,
              marginLeft: 0,
              marginRight: 0,
              width: "100%",
              "&.Mui-selected": {
                backgroundColor: "transparent",
                color: theme.palette.primary.main,
                borderLeft: `3px solid ${theme.palette.primary.main}`,
                paddingLeft: `calc(${theme.spacing(2)} - 3px)`,
                "& .MuiListItemIcon-root": {
                  color: theme.palette.primary.main,
                },
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }),
          },
        },
      }
    : {};

  // Component/style refinements that apply regardless of density or the chosen
  // primary color — a small, broadly-applicable polish pass over MUI's defaults.
  // Merged with `densityComponents` below (density-specific defaultProps for
  // MuiButton/MuiTextField/MuiFormControl win over these when compact, since
  // Object.assign keeps the last write per top-level key — see merge below).
  const baseComponents = {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none" as const,
          fontWeight: 500,
        },
      },
    },
    // Sidebar: same size/weight as body copy, medium-weight labels, tidy 20px icons.
    MuiListItemText: {
      styleOverrides: {
        primary: { fontSize: "0.8125rem", fontWeight: 500 },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 34, "& .MuiSvgIcon-root": { fontSize: 18 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        outlined: ({ theme }: { theme: Theme }) => ({
          borderColor: theme.palette.divider,
        }),
        elevation1: ({ theme }: { theme: Theme }) => ({
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)"
              : "0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)",
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    // Header cells must be OPAQUE: action.hover alone is a translucent tint, so on a sticky
    // header the scrolling rows showed through the header text. Paint the tint as a gradient
    // layer over a solid paper background instead - same look, nothing bleeds through.
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          "& .MuiTableCell-root": {
            backgroundColor: theme.palette.background.paper,
            backgroundImage: `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
            fontWeight: 600,
          },
        }),
      },
    },
    // Header cells stick to the top of their table's scroll box. List pages (see PageFill) make
    // that box fill the screen, so the page itself stays put and only the rows scroll.
    MuiTable: {
      defaultProps: {
        stickyHeader: true,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    // Pill-style active nav item (sidebar only - ListItemButton isn't used
    // anywhere else in the app) instead of MUI's default flat rectangular
    // selected highlight - a small, broadly-noticeable "modern app" touch.
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          borderRadius: (theme.shape.borderRadius as number) * 2,
          marginLeft: theme.spacing(1),
          marginRight: theme.spacing(1),
          width: `calc(100% - ${theme.spacing(2)})`,
          "&.Mui-selected": {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.main,
            "& .MuiListItemIcon-root": {
              color: theme.palette.primary.main,
            },
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.18),
            },
          },
        }),
      },
    },
    // A flat, bordered surface (no solid color fill, no drop shadow) instead of MUI's
    // default solid-primary AppBar - matches the "chrome recedes, content leads" look
    // of both reference designs discussed in the UI reskin pass, and works identically
    // in light/dark since it's driven by palette.background/divider, not a hardcoded color.
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundColor: theme.palette.background.paper,
          backgroundImage: "none",
          color: theme.palette.text.primary,
          boxShadow: "none",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiToolbar: {
      styleOverrides: {
        regular: { minHeight: 56 },
      },
    },
    // The permanent sidebar Drawer gets the same flat-bordered treatment, so it reads
    // as one continuous surface with the AppBar rather than a separate colored block.
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }: { theme: Theme }) => ({
          borderRight: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  };

  // Density and minimalist overrides are applied per-component on top of the base ones, so
  // each layer's defaultProps/styleOverrides (which an earlier layer may not set) merge in
  // rather than clobbering an earlier layer's keys for the same component. Minimalist is
  // applied last so it wins over density/base for any component key both touch (e.g.
  // MuiListItemButton, MuiChip).
  const components: Record<string, unknown> = { ...baseComponents };
  for (const [key, value] of Object.entries(densityComponents)) {
    components[key] = { ...(components[key] as object | undefined), ...value };
  }
  for (const [key, value] of Object.entries(minimalistComponents)) {
    components[key] = { ...(components[key] as object | undefined), ...value };
  }

  // Richer surface tones than MUI's defaults (which use a fairly flat mid-grey for dark
  // mode, and pure white-on-white for light mode) - a near-black background with a
  // slightly-lighter paper tone gives dark mode actual depth between "page" and "card",
  // and a soft off-white background does the same in light mode against white cards.
  const backgroundPalette =
    settings.mode === "dark"
      ? { default: "#0b0d14", paper: "#12141f" }
      : { default: "#f6f7fb", paper: "#ffffff" };

  return createTheme({
    palette: {
      mode: settings.mode,
      primary: {
        main: settings.primaryColor,
      },
      secondary: {
        main: "#00897b",
      },
      background: backgroundPalette,
      divider:
        settings.mode === "dark" ? "rgba(255, 255, 255, 0.09)" : "rgba(17, 24, 39, 0.08)",
    },
    shape: {
      borderRadius: isMinimalist ? 4 : 12,
    },
    typography: {
      fontFamily:
        '"Roboto", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
      // One compact, lighter scale for the whole app (shell, nav, pages, dashboard) so
      // nothing reads bolder or larger than its neighbours.
      fontSize: 12,
      h4: { fontSize: "1.375rem", fontWeight: 600, lineHeight: 1.25 },
      h5: { fontSize: "1.125rem", fontWeight: isMinimalist ? 500 : 600, lineHeight: 1.3 },
      h6: { fontSize: "0.9375rem", fontWeight: isMinimalist ? 500 : 600, lineHeight: 1.4 },
      subtitle1: { fontSize: "0.875rem", fontWeight: isMinimalist ? 400 : 500 },
      subtitle2: { fontSize: "0.75rem", fontWeight: isMinimalist ? 400 : 500 },
      body1: { fontSize: "0.8125rem" },
      body2: { fontSize: "0.75rem" },
      caption: { fontSize: "0.6875rem" },
      button: { fontSize: "0.75rem", fontWeight: 500 },
    },
    components,
  });
}
