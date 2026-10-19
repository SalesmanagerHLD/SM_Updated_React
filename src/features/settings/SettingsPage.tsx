import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useQueryClient } from "@tanstack/react-query";
import TextField from "@mui/material/TextField";
import { useAuth } from "../../auth/AuthContext";
import { useEntitlements } from "../../entitlement/EntitlementContext";
import { parseApiError } from "../../api/errorHelpers";
import {
  MY_THEME_PREFERENCE_QUERY_KEY,
  ORGANIZATION_THEME_QUERY_KEY,
  useMyThemePreference,
  useOrganizationTheme,
  useUpdateMyThemePreference,
  useUpdateOrganizationTheme,
  type ThemeSettings,
} from "../../api/themeApi";
import {
  getLogoBlobUrl,
  useBillingProfile,
  useDeleteLogo,
  useUpdateBillingProfile,
  useUploadLogo,
} from "../../api/billingProfileApi";
import { Link as RouterLink } from "react-router-dom";
import { useMasterData } from "../../api/masterDataApi";
import { CalendarConnectionSection } from "./CalendarConnectionSection";

type Mode = "LIGHT" | "DARK";
type Density = "COMFORTABLE" | "COMPACT";
type UiStyle = "STANDARD" | "MINIMALIST";

/** Hardcoded fallbacks — must match createAppTheme.ts / ThemeContext.tsx exactly. */
const HARDCODED_DEFAULTS = {
  primaryColor: "#6366f1",
  mode: "DARK" as Mode,
  density: "COMFORTABLE" as Density,
  uiStyle: "STANDARD" as UiStyle,
};

/** How long to wait after the last edit before actually saving to the server.
 * The preview (via the shared React Query cache) is applied immediately on every
 * change; only the network round-trip is debounced. */
const SAVE_DEBOUNCE_MS = 500;

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Typography sx={{ minWidth: 140 }}>{label}</Typography>
      <Box
        component="label"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Box
          component="input"
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          sx={{
            width: 44,
            height: 32,
            padding: 0,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            cursor: disabled ? "default" : "pointer",
            background: "none",
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {value.toUpperCase()}
        </Typography>
      </Box>
    </Stack>
  );
}

function ResetButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      size="small"
      startIcon={<RestartAltIcon fontSize="small" />}
      onClick={onClick}
      disabled={disabled}
    >
      Use organization default
    </Button>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>
      {children}
    </Paper>
  );
}

/**
 * The seller header shown on a generated invoice PDF - a plain explicit-Save form (not the
 * live-debounced-per-keystroke pattern above), since this is filled in rarely, not dragged/
 * tweaked live like a color picker. View is open to any entitled user (matching the backend's
 * GET), editing is ADMIN-only.
 */
/** Logo upload accepts PNG/JPEG only, capped at 2MB - mirrors BillingProfileService's
 * server-side validation exactly (the server is authoritative; this is UX only, same
 * discipline as every other form in this app). */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg"];

function LogoUploadRow({ isAdmin, hasLogo }: { isAdmin: boolean; hasLogo: boolean }) {
  const uploadMutation = useUploadLogo();
  const deleteMutation = useDeleteLogo();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (hasLogo) {
      getLogoBlobUrl().then((url) => {
        if (!cancelled && url) {
          objectUrl = url;
          setPreviewUrl(url);
        }
      });
    } else {
      setPreviewUrl(null);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError("Logo must be a PNG or JPEG image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo file must be at most 2MB");
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
    } catch (err) {
      // The backend's top-level message is a generic "Validation failed" summary - the
      // actually-useful, specific reason (e.g. "this file's content doesn't match PNG or
      // JPEG") lives in fieldErrors. There's no per-field input to show it under here (it's
      // a single file picker, not a multi-field form), so prefer it over the generic summary.
      const parsed = parseApiError(err);
      setError(parsed.fieldErrors[0]?.message ?? parsed.message);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  if (!isAdmin && !hasLogo) {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2">Logo (optional)</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        {previewUrl && (
          <Box
            component="img"
            src={previewUrl}
            alt="Organization logo"
            sx={{ maxHeight: 56, maxWidth: 160, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
          />
        )}
        {isAdmin && (
          <>
            <Button
              size="small"
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : hasLogo ? "Replace logo" : "Upload logo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={handleFileChange}
            />
            {hasLogo && (
              <Button size="small" color="error" onClick={handleDelete} disabled={deleteMutation.isPending}>
                Remove
              </Button>
            )}
          </>
        )}
      </Stack>
    </Stack>
  );
}

function BillingProfileSection() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const profileQuery = useBillingProfile(true);
  const updateMutation = useUpdateBillingProfile();
  const { data: states } = useMasterData("STATE");

  const [billingAddress, setBillingAddress] = useState("");
  const [billingGstin, setBillingGstin] = useState("");
  const [billingStateId, setBillingStateId] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [invoiceHeaderText, setInvoiceHeaderText] = useState("");
  const [invoiceFooterText, setInvoiceFooterText] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [upiId, setUpiId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (profileQuery.data && !loadedRef.current) {
      loadedRef.current = true;
      setBillingAddress(profileQuery.data.billingAddress ?? "");
      setBillingGstin(profileQuery.data.billingGstin ?? "");
      setBillingStateId(profileQuery.data.billingStateId ?? "");
      setBillingPhone(profileQuery.data.billingPhone ?? "");
      setInvoiceHeaderText(profileQuery.data.invoiceHeaderText ?? "");
      setInvoiceFooterText(profileQuery.data.invoiceFooterText ?? "");
      setBankName(profileQuery.data.bankName ?? "");
      setBankAccountNumber(profileQuery.data.bankAccountNumber ?? "");
      setBankIfsc(profileQuery.data.bankIfsc ?? "");
      setBankBranch(profileQuery.data.bankBranch ?? "");
      setUpiId(profileQuery.data.upiId ?? "");
    }
  }, [profileQuery.data]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        billingAddress: billingAddress || undefined,
        billingGstin: billingGstin || undefined,
        billingStateId: billingStateId || undefined,
        billingPhone: billingPhone || undefined,
        invoiceHeaderText: invoiceHeaderText || undefined,
        invoiceFooterText: invoiceFooterText || undefined,
        bankName: bankName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        bankIfsc: bankIfsc || undefined,
        bankBranch: bankBranch || undefined,
        upiId: upiId || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <SectionCard
      title="Invoice billing profile"
      description={
        isAdmin
          ? `Shown as the seller header and payment details on every generated Quotation/Invoice PDF, alongside "${profileQuery.data?.businessName ?? ""}".`
          : "Set by your administrator - shown as the seller header on generated Quotation/Invoice PDFs."
      }
    >
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {saved && !error && <Alert severity="success">Saved.</Alert>}
        {profileQuery.isLoading ? (
          <Typography color="text.secondary">Loading...</Typography>
        ) : (
          <>
            <LogoUploadRow isAdmin={isAdmin} hasLogo={profileQuery.data?.hasLogo ?? false} />
            {isAdmin && (
              <Box>
                <Button component={RouterLink} to="/app/settings/invoice-design" variant="outlined" size="small">
                  Customize invoice design
                </Button>
              </Box>
            )}
            <TextField
              label="Business address"
              fullWidth
              multiline
              minRows={2}
              disabled={!isAdmin}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="GSTIN (optional)"
                fullWidth
                disabled={!isAdmin}
                value={billingGstin}
                onChange={(e) => setBillingGstin(e.target.value)}
              />
              <TextField
                label="Phone"
                fullWidth
                disabled={!isAdmin}
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
              />
            </Stack>
            <TextField
              select
              label="State"
              fullWidth
              disabled={!isAdmin}
              value={billingStateId}
              onChange={(e) => setBillingStateId(e.target.value)}
              helperText="Your business's home state. Sales to a different state are charged IGST instead of CGST + SGST."
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {(states ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Header text (optional)"
              fullWidth
              multiline
              minRows={1}
              helperText="Shown just below your business details at the top of the PDF, e.g. a tagline or jurisdiction note."
              disabled={!isAdmin}
              value={invoiceHeaderText}
              onChange={(e) => setInvoiceHeaderText(e.target.value)}
            />
            <TextField
              label="Footer text (optional)"
              fullWidth
              multiline
              minRows={2}
              helperText="Shown at the bottom of the PDF, e.g. bank details, terms, or a thank-you note."
              disabled={!isAdmin}
              value={invoiceFooterText}
              onChange={(e) => setInvoiceFooterText(e.target.value)}
            />
            <Typography variant="subtitle2">Payment details (shown on the Invoice PDF)</Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Bank name"
                fullWidth
                disabled={!isAdmin}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <TextField
                label="Account number"
                fullWidth
                disabled={!isAdmin}
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="IFSC code"
                fullWidth
                disabled={!isAdmin}
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value)}
              />
              <TextField
                label="Branch"
                fullWidth
                disabled={!isAdmin}
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
              />
            </Stack>
            <TextField
              label="UPI ID"
              fullWidth
              disabled={!isAdmin}
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
            {isAdmin && (
              <Box>
                <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </Box>
            )}
          </>
        )}
      </Stack>
    </SectionCard>
  );
}

/**
 * Settings page (route: /app/settings, open to all authenticated users).
 *
 * Two independent sections, each backed by its own query/mutation pair from
 * `api/themeApi.ts`:
 *  - "Organization branding": visible to everyone, editable only by ADMIN.
 *  - "My preference": visible and editable by everyone, with a per-field
 *    "Use organization default" action that clears that field back to null.
 *
 * Instant preview: every control change writes straight into the shared React
 * Query cache (the same query keys `AppThemeProvider` reads), so the app's live
 * theme updates immediately. The actual network save is debounced by
 * SAVE_DEBOUNCE_MS; if it fails, the cache (and this page's local draft) is
 * rolled back to the last confirmed server value and the error is surfaced.
 */
export function SettingsPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const { hasEntitlement } = useEntitlements();
  const hasInventoryManagement = hasEntitlement("INVENTORY_MANAGEMENT");
  const hasCalendarSync = hasEntitlement("CALENDAR_SYNC");
  const queryClient = useQueryClient();

  const orgQuery = useOrganizationTheme();
  const prefQuery = useMyThemePreference();
  const orgMutation = useUpdateOrganizationTheme();
  const prefMutation = useUpdateMyThemePreference();

  const [orgError, setOrgError] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);

  const [orgDraft, setOrgDraft] = useState<{
    primaryColor: string;
    mode: Mode;
    density: Density;
    uiStyle: UiStyle;
  }>(HARDCODED_DEFAULTS);

  const [prefDraft, setPrefDraft] = useState<ThemeSettings>({
    primaryColor: null,
    mode: null,
    density: null,
    uiStyle: null,
  });

  // Last server-confirmed values, used to roll back an optimistic preview if the
  // debounced save fails. Deliberately NOT the query cache itself, since this
  // page writes optimistic previews into that same cache.
  const orgConfirmedRef = useRef<ThemeSettings | null>(null);
  const prefConfirmedRef = useRef<ThemeSettings | null>(null);

  const orgSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (orgQuery.data && orgConfirmedRef.current === null) {
      orgConfirmedRef.current = orgQuery.data;
      setOrgDraft({
        primaryColor: orgQuery.data.primaryColor ?? HARDCODED_DEFAULTS.primaryColor,
        mode: (orgQuery.data.mode as Mode | undefined) ?? HARDCODED_DEFAULTS.mode,
        density:
          (orgQuery.data.density as Density | undefined) ?? HARDCODED_DEFAULTS.density,
        uiStyle:
          (orgQuery.data.uiStyle as UiStyle | undefined) ?? HARDCODED_DEFAULTS.uiStyle,
      });
    }
  }, [orgQuery.data]);

  useEffect(() => {
    if (prefQuery.data && prefConfirmedRef.current === null) {
      prefConfirmedRef.current = prefQuery.data;
      setPrefDraft(prefQuery.data);
    }
  }, [prefQuery.data]);

  useEffect(() => {
    return () => {
      if (orgSaveTimer.current) clearTimeout(orgSaveTimer.current);
      if (prefSaveTimer.current) clearTimeout(prefSaveTimer.current);
    };
  }, []);

  // --- Organization branding (admin-editable) ---

  function commitOrgChange(patch: Partial<ThemeSettings>) {
    if (!isAdmin) return;
    setOrgError(null);

    const nextDraft = { ...orgDraft, ...patch } as typeof orgDraft;
    setOrgDraft(nextDraft);
    queryClient.setQueryData(ORGANIZATION_THEME_QUERY_KEY, nextDraft);

    if (orgSaveTimer.current) clearTimeout(orgSaveTimer.current);
    orgSaveTimer.current = setTimeout(() => {
      orgMutation.mutate(patch, {
        onSuccess: (saved) => {
          orgConfirmedRef.current = saved;
        },
        onError: (error) => {
          const parsed = parseApiError(error);
          setOrgError(parsed.message);
          const fallback = orgConfirmedRef.current;
          if (fallback) {
            queryClient.setQueryData(ORGANIZATION_THEME_QUERY_KEY, fallback);
            setOrgDraft({
              primaryColor: fallback.primaryColor ?? HARDCODED_DEFAULTS.primaryColor,
              mode: (fallback.mode as Mode | undefined) ?? HARDCODED_DEFAULTS.mode,
              density:
                (fallback.density as Density | undefined) ?? HARDCODED_DEFAULTS.density,
              uiStyle:
                (fallback.uiStyle as UiStyle | undefined) ?? HARDCODED_DEFAULTS.uiStyle,
            });
          }
        },
      });
    }, SAVE_DEBOUNCE_MS);
  }

  // --- Personal preference (everyone) ---

  function commitPrefChange(patch: Partial<ThemeSettings>) {
    setPrefError(null);

    const nextDraft = { ...prefDraft, ...patch };
    setPrefDraft(nextDraft);
    queryClient.setQueryData(MY_THEME_PREFERENCE_QUERY_KEY, nextDraft);

    if (prefSaveTimer.current) clearTimeout(prefSaveTimer.current);
    prefSaveTimer.current = setTimeout(() => {
      prefMutation.mutate(patch, {
        onSuccess: (saved) => {
          prefConfirmedRef.current = saved;
        },
        onError: (error) => {
          const parsed = parseApiError(error);
          setPrefError(parsed.message);
          const fallback = prefConfirmedRef.current;
          if (fallback) {
            queryClient.setQueryData(MY_THEME_PREFERENCE_QUERY_KEY, fallback);
            setPrefDraft(fallback);
          }
        },
      });
    }, SAVE_DEBOUNCE_MS);
  }

  /** Reset actions bypass the debounce — they're a single discrete action, not
   * a continuous drag, so there's no reason to wait before saving. */
  function resetPrefField(field: "primaryColor" | "mode" | "density" | "uiStyle") {
    if (prefSaveTimer.current) clearTimeout(prefSaveTimer.current);
    setPrefError(null);
    const nextDraft = { ...prefDraft, [field]: null };
    setPrefDraft(nextDraft);
    queryClient.setQueryData(MY_THEME_PREFERENCE_QUERY_KEY, nextDraft);
    const patch: ThemeSettings = { [field]: null } as ThemeSettings;
    prefMutation.mutate(
      patch,
      {
        onSuccess: (saved) => {
          prefConfirmedRef.current = saved;
        },
        onError: (error) => {
          const parsed = parseApiError(error);
          setPrefError(parsed.message);
          const fallback = prefConfirmedRef.current;
          if (fallback) {
            queryClient.setQueryData(MY_THEME_PREFERENCE_QUERY_KEY, fallback);
            setPrefDraft(fallback);
          }
        },
      },
    );
  }

  // Effective org values, used to show what "organization default" resolves to
  // next to each personal-preference control.
  const orgPrimaryColor = orgQuery.data?.primaryColor ?? HARDCODED_DEFAULTS.primaryColor;
  const orgMode = (orgQuery.data?.mode as Mode | undefined) ?? HARDCODED_DEFAULTS.mode;
  const orgDensity =
    (orgQuery.data?.density as Density | undefined) ?? HARDCODED_DEFAULTS.density;
  const orgUiStyle =
    (orgQuery.data?.uiStyle as UiStyle | undefined) ?? HARDCODED_DEFAULTS.uiStyle;

  const prefColor = prefDraft.primaryColor ?? orgPrimaryColor;
  const prefMode = (prefDraft.mode as Mode | null) ?? orgMode;
  const prefDensity = (prefDraft.density as Density | null) ?? orgDensity;
  const prefUiStyle = (prefDraft.uiStyle as UiStyle | null) ?? orgUiStyle;

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Typography variant="h5">Settings</Typography>

      <SectionCard
        title="Organization branding"
        description={
          isAdmin
            ? "These colors and defaults apply to everyone in your organization, unless a person sets their own preference below."
            : "Set by your administrator. Contact them to request a change."
        }
      >
        <Stack spacing={2}>
          {orgError && <Alert severity="error">{orgError}</Alert>}
          {orgQuery.isLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (
            <>
              <ColorField
                label="Primary color"
                value={orgDraft.primaryColor}
                disabled={!isAdmin}
                onChange={(value) => commitOrgChange({ primaryColor: value })}
              />

              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Typography sx={{ minWidth: 140 }}>Appearance</Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={orgDraft.mode}
                  disabled={!isAdmin}
                  onChange={(_, value: Mode | null) =>
                    value && commitOrgChange({ mode: value })
                  }
                >
                  <ToggleButton value="LIGHT">Light</ToggleButton>
                  <ToggleButton value="DARK">Dark</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Typography sx={{ minWidth: 140 }}>Density</Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={orgDraft.density}
                  disabled={!isAdmin}
                  onChange={(_, value: Density | null) =>
                    value && commitOrgChange({ density: value })
                  }
                >
                  <ToggleButton value="COMFORTABLE">Comfortable</ToggleButton>
                  <ToggleButton value="COMPACT">Compact</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Typography sx={{ minWidth: 140 }}>UI style</Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={orgDraft.uiStyle}
                  disabled={!isAdmin}
                  onChange={(_, value: UiStyle | null) =>
                    value && commitOrgChange({ uiStyle: value })
                  }
                >
                  <ToggleButton value="STANDARD">Standard</ToggleButton>
                  <ToggleButton value="MINIMALIST">Minimalist</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </>
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title="My preference"
        description="Override the organization's branding just for your own account. Any field left as 'organization default' will always follow the org setting above, even if an admin changes it later."
      >
        <Stack spacing={2}>
          {prefError && <Alert severity="error">{prefError}</Alert>}
          {prefQuery.isLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (
            <>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  rowGap: 1,
                }}
              >
                <ColorField
                  label="Primary color"
                  value={prefColor}
                  onChange={(value) => commitPrefChange({ primaryColor: value })}
                />
                <ResetButton
                  onClick={() => resetPrefField("primaryColor")}
                  disabled={prefDraft.primaryColor == null}
                />
              </Stack>

              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  rowGap: 1,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Typography sx={{ minWidth: 140 }}>Appearance</Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={prefMode}
                    onChange={(_, value: Mode | null) =>
                      value && commitPrefChange({ mode: value })
                    }
                  >
                    <ToggleButton value="LIGHT">Light</ToggleButton>
                    <ToggleButton value="DARK">Dark</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <ResetButton
                  onClick={() => resetPrefField("mode")}
                  disabled={prefDraft.mode == null}
                />
              </Stack>

              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  rowGap: 1,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Typography sx={{ minWidth: 140 }}>Density</Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={prefDensity}
                    onChange={(_, value: Density | null) =>
                      value && commitPrefChange({ density: value })
                    }
                  >
                    <ToggleButton value="COMFORTABLE">Comfortable</ToggleButton>
                    <ToggleButton value="COMPACT">Compact</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <ResetButton
                  onClick={() => resetPrefField("density")}
                  disabled={prefDraft.density == null}
                />
              </Stack>

              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  rowGap: 1,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Typography sx={{ minWidth: 140 }}>UI style</Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={prefUiStyle}
                    onChange={(_, value: UiStyle | null) =>
                      value && commitPrefChange({ uiStyle: value })
                    }
                  >
                    <ToggleButton value="STANDARD">Standard</ToggleButton>
                    <ToggleButton value="MINIMALIST">Minimalist</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <ResetButton
                  onClick={() => resetPrefField("uiStyle")}
                  disabled={prefDraft.uiStyle == null}
                />
              </Stack>
            </>
          )}
        </Stack>
      </SectionCard>

      {hasInventoryManagement && <BillingProfileSection />}

      {hasCalendarSync && (
        <SectionCard
          title="Calendar Sync"
          description="Automatically add your scheduled visits to your own Google Calendar or Outlook."
        >
          <CalendarConnectionSection />
        </SectionCard>
      )}
    </Stack>
  );
}
