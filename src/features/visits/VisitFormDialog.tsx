import { useEffect, useState } from "react";
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
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import type { Lead } from "../../api/leadsApi";
import type {
  CreateVisitPayload,
  UpdateVisitPayload,
  Visit,
  VisitSameDayMatch,
  VisitType,
} from "../../api/visitsApi";
import {
  VISIT_TYPES,
  useCheckVisitSameDay,
  useCreateVisit,
  useUpdateVisit,
} from "../../api/visitsApi";
import { useMasterData } from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";
import { CreatableMasterAutocomplete } from "../../components/CreatableMasterAutocomplete";
import { InterestReasonsField } from "../../components/InterestReasonsField";

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  FIELD: "Field Visit",
  TELEPHONIC: "Telephonic Visit",
};

const schema = z.object({
  visitType: z.enum(["FIELD", "TELEPHONIC"]),
  visitDate: z
    .custom<Dayjs | null>()
    .refine((v) => v != null && v.isValid(), "Visit date is required"),
  scheduledTime: z.custom<Dayjs | null>(),
  purposeId: z.string().nullable(),
  purposeOther: z.string().nullable(),
  contactPerson: z.string(),
  designationId: z.string().nullable(),
  designationOther: z.string().nullable(),
  contactNo: z.string(),
  email: z.string(),
  stateId: z.string().nullable(),
  stateOther: z.string().nullable(),
  cityId: z.string().nullable(),
  cityOther: z.string().nullable(),
  address: z.string(),
  budgetRange: z.string(),
  interestLevelId: z.string().nullable(),
  interestLevelOther: z.string().nullable(),
  interestReasonIds: z.array(z.string()),
  productIds: z.array(z.string()),
  remarks: z.string(),
  decisionMakerIdentified: z.boolean(),
  nextVisitDate: z.custom<Dayjs | null>(),
  alreadyCompleted: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const blankValues: FormValues = {
  visitType: "FIELD",
  visitDate: dayjs(),
  scheduledTime: null,
  purposeId: null,
  purposeOther: null,
  contactPerson: "",
  designationId: null,
  designationOther: null,
  contactNo: "",
  email: "",
  stateId: null,
  stateOther: null,
  cityId: null,
  cityOther: null,
  address: "",
  budgetRange: "",
  interestLevelId: null,
  interestLevelOther: null,
  interestReasonIds: [],
  productIds: [],
  remarks: "",
  decisionMakerIdentified: false,
  nextVisitDate: null,
  alreadyCompleted: true,
};

interface VisitFormDialogProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  lead: Lead;
  /** When provided, the dialog edits this visit instead of creating a new one. */
  visit?: Visit | null;
}

/**
 * Shared create/edit dialog for Visits. In create mode, contact-detail fields
 * default from the parent Lead's current values (editable here without
 * affecting the Lead); in edit mode they default from the visit's own stored
 * values, since those may already have been customized on a prior visit.
 */
export function VisitFormDialog({
  open,
  onClose,
  leadId,
  lead,
  visit,
}: VisitFormDialogProps) {
  const isEditMode = !!visit;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [formError, setFormError] = useState<string | null>(null);
  const [sameDayMatches, setSameDayMatches] = useState<VisitSameDayMatch[]>([]);
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  const createMutation = useCreateVisit();
  const updateMutation = useUpdateVisit();
  const sameDayCheck = useCheckVisitSameDay();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Advisory only, and only meaningful in create mode - editing an existing
  // visit would otherwise just "match" itself. Multiple visits per lead per
  // day are a legitimate, supported scenario (see the CRM plan) - this is a
  // heads-up, never a block.
  const runSameDayCheck = async (visitDate: Dayjs | null) => {
    if (isEditMode || !visitDate || !visitDate.isValid()) return;
    try {
      const matches = await sameDayCheck.mutateAsync({
        leadId,
        visitDate: visitDate.format("YYYY-MM-DD"),
      });
      setSameDayMatches(matches);
    } catch {
      // Informational only: don't block the user from continuing if the check itself fails.
    }
  };

  const { data: purposes } = useMasterData("VISIT_PURPOSE");
  const { data: designations } = useMasterData("DESIGNATION");
  const { data: states } = useMasterData("STATE");
  const { data: cities } = useMasterData("CITY");
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  const { data: products } = useMasterData("PRODUCT");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: blankValues,
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setSameDayMatches([]);
    setOptionalExpanded(false);

    if (visit) {
      form.reset({
        visitType: visit.visitType,
        visitDate: dayjs(visit.visitDate),
        scheduledTime: visit.scheduledTime
          ? dayjs(visit.scheduledTime, ["HH:mm:ss", "HH:mm"])
          : null,
        purposeId: visit.purposeId,
        purposeOther: visit.purposeOther,
        contactPerson: visit.contactPerson ?? "",
        designationId: visit.designationId,
        designationOther: visit.designationOther,
        contactNo: visit.contactNo ?? "",
        email: visit.email ?? "",
        stateId: visit.stateId,
        stateOther: visit.stateOther,
        cityId: visit.cityId,
        cityOther: visit.cityOther,
        address: visit.address ?? "",
        budgetRange: visit.budgetRange ?? "",
        interestLevelId: visit.interestLevelId,
        interestLevelOther: visit.interestLevelOther,
        interestReasonIds: visit.interestReasonIds ?? [],
        productIds: visit.productIds ?? [],
        remarks: visit.remarks ?? "",
        decisionMakerIdentified: visit.decisionMakerIdentified ?? false,
        nextVisitDate: visit.nextVisitDate ? dayjs(visit.nextVisitDate) : null,
        alreadyCompleted: visit.status === "COMPLETED",
      });
    } else {
      form.reset({
        ...blankValues,
        contactPerson: lead.contactPerson ?? "",
        designationId: lead.designationId,
        designationOther: lead.designationId ? null : lead.designationOther,
        contactNo: lead.contactNo ?? "",
        email: lead.email ?? "",
        stateId: lead.stateId,
        stateOther: lead.stateId ? null : lead.stateOther,
        cityId: lead.cityId,
        cityOther: lead.cityId ? null : lead.cityOther,
        address: lead.address ?? "",
        budgetRange: lead.budgetRange ?? "",
        interestLevelId: lead.interestLevelId,
        interestLevelOther: lead.interestLevelId ? null : lead.interestLevelOther,
        interestReasonIds: lead.interestReasonIds ?? [],
      });
      void runSameDayCheck(dayjs());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit, lead]);

  const purposeOptions = purposes ?? [];
  const designationOptions = designations ?? [];
  const stateOptions = states ?? [];
  const cityOptions = cities ?? [];
  const interestLevelOptions = interestLevels ?? [];
  const productOptions = products ?? [];

  const cityOptionsForState = (stateId: string | null) =>
    stateId ? cityOptions.filter((c) => c.parentId === stateId) : cityOptions;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const shared: UpdateVisitPayload = {
      visitType: values.visitType,
      visitDate: values.visitDate ? values.visitDate.format("YYYY-MM-DD") : undefined,
      scheduledTime: values.scheduledTime
        ? values.scheduledTime.format("HH:mm:ss")
        : undefined,
      purposeId: values.purposeId ?? undefined,
      purposeOther: values.purposeOther ?? undefined,
      contactPerson: values.contactPerson.trim() || undefined,
      designationId: values.designationId ?? undefined,
      designationOther: values.designationOther ?? undefined,
      contactNo: values.contactNo.trim() || undefined,
      email: values.email.trim() || undefined,
      stateId: values.stateId ?? undefined,
      stateOther: values.stateOther ?? undefined,
      cityId: values.cityId ?? undefined,
      cityOther: values.cityOther ?? undefined,
      address: values.address.trim() || undefined,
      budgetRange: values.budgetRange.trim() || undefined,
      interestLevelId: values.interestLevelId ?? undefined,
      interestLevelOther: values.interestLevelOther ?? undefined,
      interestReasonIds: values.interestReasonIds,
      productIds: values.productIds,
      remarks: values.remarks.trim() || undefined,
      decisionMakerIdentified: values.decisionMakerIdentified,
      nextVisitDate: values.nextVisitDate
        ? values.nextVisitDate.format("YYYY-MM-DD")
        : undefined,
    };

    try {
      if (isEditMode && visit) {
        await updateMutation.mutateAsync({ id: visit.id, payload: shared });
      } else {
        const payload: CreateVisitPayload = {
          ...shared,
          leadId,
          visitDate: values.visitDate!.format("YYYY-MM-DD"),
          visitType: values.visitType,
          status: values.alreadyCompleted ? "COMPLETED" : undefined,
        };
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
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

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle>{isEditMode ? "Edit Visit" : "Add Visit"}</DialogTitle>
      <Stack component="form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {/* Visit type comes first and stands alone, full-width - it's the first thing
                worth deciding whenever a visit is being added (this dialog is now most often
                reached via the Leads page's "Add Visit" entry point), and it's just one field,
                so it doesn't need to share a row with date/time. */}
            <Controller
              control={form.control}
              name="visitType"
              render={({ field }) => (
                <TextField
                  select
                  label="Visit type"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  sx={{ maxWidth: 280 }}
                >
                  {VISIT_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {VISIT_TYPE_LABELS[t]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {sameDayMatches.length > 0 && (
              <Alert severity="warning" onClose={() => setSameDayMatches([])}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  This lead already has {sameDayMatches.length === 1 ? "a visit" : "visits"} on
                  this date - you can still add another if that's intentional:
                </Typography>
                <Stack spacing={0.5}>
                  {sameDayMatches.map((match) => (
                    <Typography key={match.id} variant="body2" color="text.secondary">
                      {VISIT_TYPE_LABELS[match.visitType]} - {match.status}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={form.control}
                  name="visitDate"
                  render={({ field }) => (
                    <DatePicker
                      label="Visit date"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        void runSameDayCheck(value);
                      }}
                      minDate={dayjs()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!form.formState.errors.visitDate,
                          helperText: form.formState.errors.visitDate?.message,
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={form.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <TimePicker
                      label="Scheduled time (optional)"
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={form.control}
                  name="purposeId"
                  render={({ field }) => (
                    <CreatableMasterAutocomplete
                      label="Purpose"
                      options={purposeOptions}
                      idValue={field.value}
                      otherValue={form.watch("purposeOther")}
                      onChange={({ id, other }) => {
                        field.onChange(id);
                        form.setValue("purposeOther", other);
                      }}
                    />
                  )}
                />
              </Grid>

              {!isEditMode && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    control={form.control}
                    name="alreadyCompleted"
                    render={({ field }) => (
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                          <Checkbox
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        }
                        label="This visit already happened (log as completed)"
                      />
                    )}
                  />
                </Grid>
              )}
            </Grid>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Required details
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Contact person"
                  fullWidth
                  {...form.register("contactPerson")}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Contact number"
                  fullWidth
                  slotProps={{ htmlInput: { inputMode: "numeric" } }}
                  {...form.register("contactNo")}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={form.control}
                  name="cityId"
                  render={({ field }) => (
                    <CreatableMasterAutocomplete
                      label="City"
                      options={cityOptionsForState(form.watch("stateId"))}
                      idValue={field.value}
                      otherValue={form.watch("cityOther")}
                      onChange={({ id, other }) => {
                        field.onChange(id);
                        form.setValue("cityOther", other);
                        if (id) {
                          const matchedCity = cityOptions.find((c) => c.id === id);
                          form.setValue("stateId", matchedCity?.parentId ?? null);
                          form.setValue("stateOther", null);
                        }
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
                      renderInput={(params) => (
                        <TextField {...params} label="Products discussed" />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
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
              </Grid>
              <Grid size={12}>
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
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={form.control}
                  name="nextVisitDate"
                  render={({ field }) => (
                    <DatePicker
                      label="Next visit date (optional)"
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      minDate={dayjs()}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Remarks"
                  fullWidth
                  multiline
                  minRows={2}
                  {...form.register("remarks")}
                />
              </Grid>
            </Grid>

            <Accordion
              expanded={optionalExpanded}
              onChange={(_, expanded) => setOptionalExpanded(expanded)}
              disableGutters
              variant="outlined"
              sx={{ mt: 2, "&:before": { display: "none" } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Additional details (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Email" fullWidth {...form.register("email")} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Budget range"
                      fullWidth
                      {...form.register("budgetRange")}
                    />
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
            {isSubmitting ? "Saving..." : isEditMode ? "Save changes" : "Create"}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
