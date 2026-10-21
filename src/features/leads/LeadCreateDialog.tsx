import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs, { type Dayjs } from "dayjs";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  Grid,
  Link as MuiLink,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { LeadDuplicateMatch } from "../../api/leadsApi";
import { useCheckLeadDuplicates, useCreateLead } from "../../api/leadsApi";
import { useMasterData } from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";
import { CreatableMasterAutocomplete } from "../../components/CreatableMasterAutocomplete";
import { InterestReasonsField } from "../../components/InterestReasonsField";
import { useAuth } from "../../auth/AuthContext";

/** Last-used City/Lead Source/Industry, remembered per-org for the rest of the browser tab's
 * session (sessionStorage, not localStorage - this is a convenience default, not something
 * that should silently persist across days/devices). Common field-sales pattern: a rep
 * entering several leads in a row from the same event/territory usually wants the same City/
 * Lead Source/Industry each time rather than re-picking them from scratch. */
interface StickyLeadDefaults {
  stateId: string | null;
  stateOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  leadSourceId: string | null;
  leadSourceOther: string | null;
  industryId: string | null;
  industryOther: string | null;
}

function stickyDefaultsKey(orgId: string): string {
  return `salesmanager.leadCreateDefaults.${orgId}`;
}

function readStickyDefaults(orgId: string | null): StickyLeadDefaults | null {
  if (!orgId) return null;
  try {
    const raw = window.sessionStorage.getItem(stickyDefaultsKey(orgId));
    if (!raw) return null;
    return JSON.parse(raw) as StickyLeadDefaults;
  } catch {
    return null;
  }
}

function writeStickyDefaults(orgId: string, defaults: StickyLeadDefaults): void {
  try {
    window.sessionStorage.setItem(stickyDefaultsKey(orgId), JSON.stringify(defaults));
  } catch {
    // Best-effort only - a full disk or disabled storage shouldn't break lead creation.
  }
}

const schema = z
  .object({
    // Visit (shown first - see this dialog's own comment for why).
    logAsVisitToday: z.boolean(),
    visitType: z.enum(["FIELD", "TELEPHONIC"]),

    // Required.
    companyName: z.string().min(1, "Company name is required"),
    contactPerson: z.string().min(1, "Contact person is required"),
    contactNo: z
      .string()
      .regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
    stateId: z.string().nullable(),
    stateOther: z.string().nullable(),
    cityId: z.string().nullable(),
    cityOther: z.string().nullable(),
    leadSourceId: z.string().nullable(),
    leadSourceOther: z.string().nullable(),
    industryId: z.string().nullable(),
    industryOther: z.string().nullable(),

    // Optional - collapsed by default, filled in now if convenient or later from the
    // lead's own detail page.
    businessTypeId: z.string().nullable(),
    businessTypeOther: z.string().nullable(),
    turnover: z.string(),
    designationId: z.string().nullable(),
    designationOther: z.string().nullable(),
    email: z.string(),
    address: z.string(),
    productIds: z.array(z.string()),
    interestLevelId: z.string().nullable(),
    interestLevelOther: z.string().nullable(),
    interestReasonIds: z.array(z.string()),
    currentProductSolution: z.string(),
    budgetRange: z.string(),
    decisionMakerIdentified: z.boolean(),
    remarks: z.string(),
    nextFollowupDate: z.custom<Dayjs | null>(),
    expectedCloseDate: z.custom<Dayjs | null>(),
  })
  .refine((data) => !!(data.cityId || data.cityOther), {
    message: "City is required",
    path: ["cityId"],
  })
  .refine((data) => !!(data.leadSourceId || data.leadSourceOther), {
    message: "Lead source is required",
    path: ["leadSourceId"],
  })
  .refine((data) => !!(data.industryId || data.industryOther), {
    message: "Industry is required",
    path: ["industryId"],
  });
type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  logAsVisitToday: true,
  visitType: "FIELD",
  companyName: "",
  contactPerson: "",
  contactNo: "",
  stateId: null,
  stateOther: null,
  cityId: null,
  cityOther: null,
  leadSourceId: null,
  leadSourceOther: null,
  industryId: null,
  industryOther: null,
  businessTypeId: null,
  businessTypeOther: null,
  turnover: "",
  designationId: null,
  designationOther: null,
  email: "",
  address: "",
  productIds: [],
  interestLevelId: null,
  interestLevelOther: null,
  interestReasonIds: [],
  currentProductSolution: "",
  budgetRange: "",
  decisionMakerIdentified: false,
  remarks: "",
  nextFollowupDate: null,
  expectedCloseDate: null,
};

interface LeadCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Lead capture: a "Required details" section with only the fields the backend actually
 * requires, plus an "Additional details" section (collapsed by default) for everything else
 * the Lead entity supports - filling that in now is convenient but optional, since it can
 * always be completed later from the lead's own detail page. The "log a visit today" block is
 * deliberately first, ahead of every lead field - this dialog is most often reached via the
 * Leads page's "Add Visit" entry point (see AddVisitEntryDialog), so deciding Field vs
 * Telephonic (or opting out of logging a visit at all, e.g. a lead entered secondhand from a
 * web form) is the first thing worth deciding, before typing anything about the lead itself.
 */
export function LeadCreateDialog({ open, onClose }: LeadCreateDialogProps) {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<LeadDuplicateMatch[]>([]);
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  const createMutation = useCreateLead();
  const duplicateCheck = useCheckLeadDuplicates();

  const { data: states } = useMasterData("STATE");
  const { data: cities } = useMasterData("CITY");
  const { data: leadSources } = useMasterData("LEAD_SOURCE");
  const { data: industries } = useMasterData("INDUSTRY");
  const { data: businessTypes } = useMasterData("BUSINESS_TYPE");
  const { data: designations } = useMasterData("DESIGNATION");
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  const { data: products } = useMasterData("PRODUCT");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setDuplicates([]);
    setOptionalExpanded(false);
    const sticky = readStickyDefaults(orgId);
    form.reset(sticky ? { ...emptyValues, ...sticky } : emptyValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runDuplicateCheck = async () => {
    const { contactNo, companyName } = form.getValues();
    if (!contactNo && !companyName) return;
    try {
      const matches = await duplicateCheck.mutateAsync({
        contactNo: contactNo || undefined,
        companyName: companyName || undefined,
      });
      setDuplicates(matches);
    } catch {
      // Informational only: if the duplicate check itself fails, don't block
      // the user from continuing to fill out / submit the form.
    }
  };

  const isSubmitting = createMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const lead = await createMutation.mutateAsync({
        companyName: values.companyName,
        contactPerson: values.contactPerson,
        contactNo: values.contactNo,
        stateId: values.stateId ?? undefined,
        stateOther: values.stateOther ?? undefined,
        cityId: values.cityId ?? undefined,
        cityOther: values.cityOther ?? undefined,
        leadSourceId: values.leadSourceId ?? undefined,
        leadSourceOther: values.leadSourceOther ?? undefined,
        industryId: values.industryId ?? undefined,
        industryOther: values.industryOther ?? undefined,
        businessTypeId: values.businessTypeId ?? undefined,
        businessTypeOther: values.businessTypeOther ?? undefined,
        turnover: values.turnover.trim() ? Number(values.turnover) : undefined,
        designationId: values.designationId ?? undefined,
        designationOther: values.designationOther ?? undefined,
        email: values.email.trim() || undefined,
        address: values.address.trim() || undefined,
        productIds: values.productIds.length > 0 ? values.productIds : undefined,
        interestLevelId: values.interestLevelId ?? undefined,
        interestLevelOther: values.interestLevelOther ?? undefined,
        interestReasonIds: values.interestReasonIds.length > 0 ? values.interestReasonIds : undefined,
        currentProductSolution: values.currentProductSolution.trim() || undefined,
        budgetRange: values.budgetRange.trim() || undefined,
        decisionMakerIdentified: values.decisionMakerIdentified,
        remarks: values.remarks.trim() || undefined,
        nextFollowupDate: values.nextFollowupDate
          ? values.nextFollowupDate.format("YYYY-MM-DD")
          : undefined,
        expectedCloseDate: values.expectedCloseDate
          ? values.expectedCloseDate.format("YYYY-MM-DD")
          : undefined,
        logAsVisitToday: values.logAsVisitToday,
        visitType: values.logAsVisitToday ? values.visitType : undefined,
      });
      if (orgId) {
        writeStickyDefaults(orgId, {
          stateId: values.stateId,
          stateOther: values.stateOther,
          cityId: values.cityId,
          cityOther: values.cityOther,
          leadSourceId: values.leadSourceId,
          leadSourceOther: values.leadSourceOther,
          industryId: values.industryId,
          industryOther: values.industryOther,
        });
      }
      onClose();
      navigate(`/app/leads/${lead.id}`);
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
      for (const fieldError of parsed.fieldErrors) {
        if (fieldError.field in values) {
          form.setError(fieldError.field as keyof FormValues, {
            message: fieldError.message,
          });
        }
      }
    }
  };

  const stateOptions = states ?? [];
  const cityOptions = cities ?? [];
  const leadSourceOptions = leadSources ?? [];
  const industryOptions = industries ?? [];
  const businessTypeOptions = businessTypes ?? [];
  const designationOptions = designations ?? [];
  const interestLevelOptions = interestLevels ?? [];
  const productOptions = products ?? [];

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>Add Lead</DialogTitle>
      <Stack
        component="form"
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          // Industry/Lead Source are backend-required but now live inside the collapsed
          // Additional Details accordion - auto-expand it so a validation error there is
          // never hidden from view.
          if (errors.industryId || errors.leadSourceId) {
            setOptionalExpanded(true);
          }
        })}
        noValidate
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {duplicates.length > 0 && (
              <Alert severity="warning" onClose={() => setDuplicates([])}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Possible duplicate lead(s) found:
                </Typography>
                <Stack spacing={0.5}>
                  {duplicates.map((match) => (
                    <MuiLink
                      key={match.id}
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={() => navigate(`/app/leads/${match.id}`)}
                      sx={{ textAlign: "left" }}
                    >
                      {match.companyName} — {match.contactPerson} (
                      {match.contactNo})
                    </MuiLink>
                  ))}
                </Stack>
              </Alert>
            )}

            <Controller
              control={form.control}
              name="logAsVisitToday"
              render={({ field }) => (
                <Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Log this as today's visit"
                  />
                  <FormHelperText sx={{ mt: -1 }}>
                    Creates an initial visit record dated today. Uncheck for
                    leads entered secondhand (e.g. from a web form) where
                    there's been no direct contact yet.
                  </FormHelperText>
                </Stack>
              )}
            />
            {form.watch("logAsVisitToday") && (
              <Controller
                control={form.control}
                name="visitType"
                render={({ field }) => (
                  <TextField
                    select
                    label="Visit type"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    sx={{ maxWidth: 240 }}
                  >
                    <MenuItem value="FIELD">Field Visit</MenuItem>
                    <MenuItem value="TELEPHONIC">Telephonic Visit</MenuItem>
                  </TextField>
                )}
              />
            )}

            <Divider />

            <Typography variant="subtitle2">Required details</Typography>
            <TextField
              label="Company name"
              fullWidth
              autoFocus
              {...form.register("companyName", { onBlur: runDuplicateCheck })}
              error={!!form.formState.errors.companyName}
              helperText={form.formState.errors.companyName?.message}
            />
            <Controller
              control={form.control}
              name="businessTypeId"
              render={({ field }) => (
                <CreatableMasterAutocomplete
                  label="Business type"
                  options={businessTypeOptions}
                  idValue={field.value}
                  otherValue={form.watch("businessTypeOther")}
                  onChange={({ id, other }) => {
                    field.onChange(id);
                    form.setValue("businessTypeOther", other);
                  }}
                />
              )}
            />
            <TextField
              label="Contact person"
              fullWidth
              {...form.register("contactPerson")}
              error={!!form.formState.errors.contactPerson}
              helperText={form.formState.errors.contactPerson?.message}
            />
            <Controller
              control={form.control}
              name="designationId"
              render={({ field }) => (
                <CreatableMasterAutocomplete
                  label="Designation"
                  options={designationOptions}
                  idValue={field.value}
                  otherValue={form.watch("designationOther")}
                  onChange={({ id, other }) => {
                    field.onChange(id);
                    form.setValue("designationOther", other);
                  }}
                />
              )}
            />
            <TextField
              label="Contact number"
              fullWidth
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
              {...form.register("contactNo", { onBlur: runDuplicateCheck })}
              error={!!form.formState.errors.contactNo}
              helperText={form.formState.errors.contactNo?.message}
            />
            <Controller
              control={form.control}
              name="stateId"
              render={({ field }) => (
                <CreatableMasterAutocomplete
                  label="State"
                  options={stateOptions}
                  idValue={field.value}
                  otherValue={form.watch("stateOther")}
                  onChange={({ id, other }) => {
                    field.onChange(id);
                    form.setValue("stateOther", other);
                  }}
                />
              )}
            />
            <Controller
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <CreatableMasterAutocomplete
                  label="City"
                  options={cityOptions}
                  idValue={field.value}
                  otherValue={form.watch("cityOther")}
                  onChange={({ id, other }) => {
                    field.onChange(id);
                    form.setValue("cityOther", other);
                    // Cascade to State only when a real City was picked (it has
                    // a parentId to cascade from); free-text City entry leaves
                    // State untouched.
                    if (id) {
                      const matchedCity = cityOptions.find((c) => c.id === id);
                      form.setValue("stateId", matchedCity?.parentId ?? null);
                      form.setValue("stateOther", null);
                    }
                  }}
                  error={!!form.formState.errors.cityId}
                  helperText={form.formState.errors.cityId?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="productIds"
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={productOptions}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={productOptions.filter((p) => (field.value ?? []).includes(p.id))}
                  onChange={(_, selected) => field.onChange(selected.map((s) => s.id))}
                  renderInput={(params) => <TextField {...params} label="Products" />}
                />
              )}
            />
            <Controller
              control={form.control}
              name="interestLevelId"
              render={({ field }) => (
                <CreatableMasterAutocomplete
                  label="Interest level"
                  options={interestLevelOptions}
                  idValue={field.value}
                  otherValue={form.watch("interestLevelOther")}
                  onChange={({ id, other }) => {
                    field.onChange(id);
                    form.setValue("interestLevelOther", other);
                  }}
                />
              )}
            />
            <Controller
              control={form.control}
              name="interestReasonIds"
              render={({ field }) => (
                <InterestReasonsField
                  interestLevelId={form.watch("interestLevelId")}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="decisionMakerIdentified"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Decision maker identified"
                />
              )}
            />
            <Controller
              control={form.control}
              name="nextFollowupDate"
              render={({ field }) => (
                <DatePicker
                  label="Next follow-up date"
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  minDate={dayjs()}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              )}
            />
            <Controller
              control={form.control}
              name="expectedCloseDate"
              render={({ field }) => (
                <DatePicker
                  label="Expected close date"
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              )}
            />
            <TextField
              label="Remarks"
              fullWidth
              multiline
              minRows={2}
              {...form.register("remarks")}
            />

            <Accordion
              expanded={optionalExpanded}
              onChange={(_, expanded) => setOptionalExpanded(expanded)}
              disableGutters
              variant="outlined"
              sx={{ "&:before": { display: "none" } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  Additional details (optional)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      control={form.control}
                      name="industryId"
                      render={({ field }) => (
                        <CreatableMasterAutocomplete
                          label="Industry"
                          options={industryOptions}
                          idValue={field.value}
                          otherValue={form.watch("industryOther")}
                          onChange={({ id, other }) => {
                            field.onChange(id);
                            form.setValue("industryOther", other);
                          }}
                          error={!!form.formState.errors.industryId}
                          helperText={form.formState.errors.industryId?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      control={form.control}
                      name="leadSourceId"
                      render={({ field }) => (
                        <CreatableMasterAutocomplete
                          label="Lead source"
                          options={leadSourceOptions}
                          idValue={field.value}
                          otherValue={form.watch("leadSourceOther")}
                          onChange={({ id, other }) => {
                            field.onChange(id);
                            form.setValue("leadSourceOther", other);
                          }}
                          error={!!form.formState.errors.leadSourceId}
                          helperText={form.formState.errors.leadSourceId?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Turnover"
                      type="number"
                      fullWidth
                      {...form.register("turnover")}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Email" fullWidth {...form.register("email")} />
                  </Grid>

                  <Grid size={12}>
                    <TextField
                      label="Address"
                      fullWidth
                      multiline
                      minRows={2}
                      {...form.register("address")}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Current product / solution"
                      fullWidth
                      {...form.register("currentProductSolution")}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Budget range"
                      fullWidth
                      {...form.register("budgetRange")}
                    />
                  </Grid>

                  <Grid size={12}>
                    <FormHelperText>
                      Attachments (business card, brochure, etc.) can be added from this
                      lead's detail page once it's created.
                    </FormHelperText>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
