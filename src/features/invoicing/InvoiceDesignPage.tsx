import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {
  DesignFontFamily,
  DesignLogoAlign,
  DesignLogoSize,
  DesignMargin,
  DesignPageSize,
  DesignPreset,
  DesignTextSize,
  InvoiceDesignSettings,
} from "../../api/invoiceDesignApi";
import {
  previewInvoiceDesign,
  useInvoiceDesign,
  useResetInvoiceDesign,
  useSaveInvoiceDesign,
} from "../../api/invoiceDesignApi";
import { parseApiError } from "../../api/errorHelpers";

const PREVIEW_DEBOUNCE_MS = 500;

const PRESETS: { value: DesignPreset; label: string }[] = [
  { value: "CLASSIC", label: "Classic" },
  { value: "BAND", label: "Colour band" },
  { value: "COMPACT", label: "Compact" },
];

/** Relative luminance (WCAG) of a #RRGGBB colour - used to warn when the accent would be hard
 * to read as text on white paper. */
function luminance(hex: string): number {
  const channel = (start: number) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const isHexColour = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);

/**
 * Admin-only editor: pick a layout, colour, font, logo options and which optional fields show,
 * with a live preview of the REAL PDF (rendered by the backend, so what the admin sees is what
 * the customer gets). Settings only - never free HTML - and the GST-required fields are not
 * offered here at all, so no design can remove them. Each issued invoice keeps the design in
 * force when it was issued, so saving here never rewrites old invoices.
 */
export function InvoiceDesignPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const designQuery = useInvoiceDesign(true);
  const saveMutation = useSaveInvoiceDesign();
  const resetMutation = useResetInvoiceDesign();

  const [draft, setDraft] = useState<InvoiceDesignSettings | null>(null);
  const [tab, setTab] = useState<"settings" | "preview">("settings");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (designQuery.data && !loadedRef.current) {
      loadedRef.current = true;
      setDraft(designQuery.data.settings);
    }
  }, [designQuery.data]);

  const saved = designQuery.data?.settings ?? null;
  const dirty = useMemo(
    () => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );
  const accentValid = !!draft && isHexColour(draft.accentColor);
  const accentTooLight = accentValid && draft ? luminance(draft.accentColor) > 0.6 : false;

  // Live preview: wait for the admin to stop changing things, cancel any request still in
  // flight, then swap in the new PDF and free the old one.
  useEffect(() => {
    if (!draft || !accentValid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const url = await previewInvoiceDesign(draft, controller.signal);
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      } catch (err) {
        if (!controller.signal.aborted) setPreviewError(parseApiError(err).message);
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, accentValid]);

  useEffect(
    () => () => {
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    },
    [],
  );

  const update = <K extends keyof InvoiceDesignSettings>(key: K, value: InvoiceDesignSettings[K]) => {
    setMessage(null);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const handleSave = async () => {
    if (!draft) return;
    setMessage(null);
    try {
      await saveMutation.mutateAsync(draft);
      setMessage({ severity: "success", text: "Design saved. New invoices will use it; existing invoices keep theirs." });
    } catch (err) {
      setMessage({ severity: "error", text: parseApiError(err).message });
    }
  };

  const handleReset = async () => {
    setMessage(null);
    try {
      const result = await resetMutation.mutateAsync();
      setDraft(result.settings);
      setMessage({ severity: "success", text: "Design reset to the default." });
    } catch (err) {
      setMessage({ severity: "error", text: parseApiError(err).message });
    }
  };

  if (designQuery.isLoading || !draft) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        {designQuery.isError ? (
          <Alert severity="error">{parseApiError(designQuery.error).message}</Alert>
        ) : (
          <CircularProgress />
        )}
      </Box>
    );
  }

  const settingsPanel = (
    <Stack spacing={1}>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Layout</AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={draft.preset}
              onChange={(_, v: DesignPreset | null) => v && update("preset", v)}
            >
              {PRESETS.map((p) => (
                <ToggleButton key={p.value} value={p.value}>
                  {p.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                size="small"
                label="Page size"
                fullWidth
                value={draft.pageSize}
                onChange={(e) => update("pageSize", e.target.value as DesignPageSize)}
              >
                <MenuItem value="A4">A4</MenuItem>
                <MenuItem value="A5">A5</MenuItem>
                <MenuItem value="LETTER">Letter</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Margins"
                fullWidth
                value={draft.margin}
                onChange={(e) => update("margin", e.target.value as DesignMargin)}
              >
                <MenuItem value="NARROW">Narrow</MenuItem>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="WIDE">Wide</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Colour and font</AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <input
                type="color"
                aria-label="Accent colour"
                value={accentValid ? draft.accentColor : "#222222"}
                onChange={(e) => update("accentColor", e.target.value.toUpperCase())}
                style={{ width: 48, height: 36, border: 0, padding: 0, background: "none" }}
              />
              <TextField
                size="small"
                label="Accent colour"
                value={draft.accentColor}
                error={!accentValid}
                helperText={!accentValid ? "Use a #RRGGBB colour" : undefined}
                onChange={(e) => update("accentColor", e.target.value)}
              />
            </Stack>
            {accentTooLight && (
              <Alert severity="warning">
                This colour is very light - headings and the table header may be hard to read on paper.
              </Alert>
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                select
                size="small"
                label="Font"
                fullWidth
                value={draft.fontFamily}
                onChange={(e) => update("fontFamily", e.target.value as DesignFontFamily)}
              >
                <MenuItem value="SANS">Sans-serif (Helvetica)</MenuItem>
                <MenuItem value="SERIF">Serif (Times)</MenuItem>
                <MenuItem value="MONO">Monospace (Courier)</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Text size"
                fullWidth
                value={draft.textSize}
                onChange={(e) => update("textSize", e.target.value as DesignTextSize)}
              >
                <MenuItem value="SMALL">Small</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LARGE">Large</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Header and logo</AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={<Switch checked={draft.showLogo} onChange={(e) => update("showLogo", e.target.checked)} />}
              label="Show logo"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                size="small"
                label="Logo size"
                fullWidth
                disabled={!draft.showLogo}
                value={draft.logoSize}
                onChange={(e) => update("logoSize", e.target.value as DesignLogoSize)}
              >
                <MenuItem value="SMALL">Small</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LARGE">Large</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Logo position"
                fullWidth
                disabled={!draft.showLogo}
                value={draft.logoAlign}
                onChange={(e) => update("logoAlign", e.target.value as DesignLogoAlign)}
              >
                <MenuItem value="LEFT">Left</MenuItem>
                <MenuItem value="CENTER">Centre</MenuItem>
                <MenuItem value="RIGHT">Right</MenuItem>
              </TextField>
            </Stack>
            <FormControlLabel
              control={
                <Switch checked={draft.showSellerPhone} onChange={(e) => update("showSellerPhone", e.target.checked)} />
              }
              label="Show phone number"
            />
            <Typography variant="caption" color="text.secondary">
              The logo itself is uploaded under Settings, Invoice billing profile. Business name, address and
              GSTIN always show.
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Totals and footer</AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch checked={draft.showPaidBalance} onChange={(e) => update("showPaidBalance", e.target.checked)} />
              }
              label="Show paid and balance due"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.showAmountInWords}
                  onChange={(e) => update("showAmountInWords", e.target.checked)}
                />
              }
              label="Show amount in words"
            />
            <FormControlLabel
              control={
                <Switch checked={draft.showBankDetails} onChange={(e) => update("showBankDetails", e.target.checked)} />
              }
              label="Show bank and UPI details"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="Bill-to label"
                fullWidth
                value={draft.billToLabel}
                slotProps={{ htmlInput: { maxLength: 30 } }}
                onChange={(e) => update("billToLabel", e.target.value)}
              />
              <TextField
                size="small"
                label="Ship-to label"
                fullWidth
                value={draft.shipToLabel}
                slotProps={{ htmlInput: { maxLength: 30 } }}
                onChange={(e) => update("shipToLabel", e.target.value)}
              />
            </Stack>
            <TextField
              label="Terms and conditions"
              multiline
              minRows={3}
              fullWidth
              value={draft.termsAndConditions}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              onChange={(e) => update("termsAndConditions", e.target.value)}
              helperText="Printed above the signature on every invoice."
            />
            <Typography variant="caption" color="text.secondary">
              The document title, invoice number, dates, place of supply, items table, tax totals and signature
              line are required for a GST invoice and cannot be turned off.
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );

  const previewPanel = (
    <Paper variant="outlined" sx={{ position: "relative", height: { xs: 560, md: "calc(100vh - 200px)" }, minHeight: 520 }}>
      {previewLoading && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ position: "absolute", top: 8, right: 8, zIndex: 1, alignItems: "center", bgcolor: "background.paper", px: 1, borderRadius: 1 }}
        >
          <CircularProgress size={14} />
          <Typography variant="caption">Updating</Typography>
        </Stack>
      )}
      {previewError && (
        <Alert severity="error" sx={{ m: 1 }}>
          {previewError}
        </Alert>
      )}
      {previewUrl && (
        <iframe
          title="Invoice preview"
          src={previewUrl}
          style={{ width: "100%", height: "100%", border: 0, opacity: previewLoading ? 0.6 : 1 }}
        />
      )}
      {!previewUrl && !previewError && !previewLoading && (
        <Typography color="text.secondary" sx={{ p: 3 }}>
          Preview will appear here.
        </Typography>
      )}
    </Paper>
  );

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}
      >
        <Box>
          <Typography variant="h5">Invoice design</Typography>
          <Typography variant="body2" color="text.secondary">
            Applies to new invoices. Invoices already issued keep the design they were issued with.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={handleReset}
            disabled={resetMutation.isPending || (designQuery.data?.isDefault ?? true) && !dirty}
          >
            Reset to default
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!dirty || !accentValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Stack>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {isMobile ? (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="settings" label="Settings" />
            <Tab value="preview" label="Preview" />
          </Tabs>
          {tab === "settings" ? settingsPanel : previewPanel}
        </>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 2, alignItems: "start" }}>
          <Box>{settingsPanel}</Box>
          {previewPanel}
        </Box>
      )}
    </Box>
  );
}
