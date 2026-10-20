import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useAuth } from "../../auth/AuthContext";
import { useEmployee, useEmployees } from "../../api/employeesApi";
import { useMasterData } from "../../api/masterDataApi";
import type { LeadStatus, UpdateLeadPayload } from "../../api/leadsApi";
import {
  LEAD_STATUSES,
  useLead,
  useReassignLead,
  useUpdateLead,
  useUpdateLeadStatus,
} from "../../api/leadsApi";
import type { Visit, VisitStatus } from "../../api/visitsApi";
import { useUpdateVisitStatus, useVisits } from "../../api/visitsApi";
import type { ActivityType } from "../../api/activityApi";
import { ACTIVITY_TYPES, useActivity } from "../../api/activityApi";
import { parseApiError } from "../../api/errorHelpers";
import { CreatableMasterAutocomplete } from "../../components/CreatableMasterAutocomplete";
import { InterestReasonsField } from "../../components/InterestReasonsField";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "./leadStatusConfig";
import { LeadAttachmentsSection } from "./LeadAttachmentsSection";
import { LeadLostReasonDialog } from "./LeadLostReasonDialog";
import { ReassignLeadDialog } from "./ReassignLeadDialog";
import { VisitFormDialog } from "../visits/VisitFormDialog";
import {
  ACTIVITY_TYPE_LABELS,
  resolveActorName,
} from "../activity/activityConfig";

  activityIcon,
  activityColor,
  activityLabel,
const editSchema = z.object({
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
  currentProductSolution: z.string(),
  budgetRange: z.string(),
  interestReasonIds: z.array(z.string()),
  decisionMakerIdentified: z.boolean(),
  remarks: z.string(),
  nextFollowupDate: z.custom<Dayjs | null>(),
  expectedCloseDate: z.custom<Dayjs | null>(),
});
type EditFormValues = z.infer<typeof editSchema>;

const VISIT_TYPE_LABELS: Record<Visit["visitType"], string> = {
  FIELD: "Field Visit",
  TELEPHONIC: "Telephonic Visit",
};

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
  MISSED: "Missed",
};

const VISIT_STATUS_COLORS: Record<
  VisitStatus,
  "info" | "success" | "error"
> = {
  PLANNED: "info",
  COMPLETED: "success",
  MISSED: "error",
};

const emptyValues: EditFormValues = {
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
  currentProductSolution: "",
  budgetRange: "",
  interestReasonIds: [],
  decisionMakerIdentified: false,
  remarks: "",
  nextFollowupDate: null,
  expectedCloseDate: null,
};

/**
 * Lead detail + edit page. Doubles as "step 2" of lead capture: right after
 * creation (which only collects the 6 required fields) the user lands here to
 * fill in the rest, and can return any time later to keep it updated.
 */
export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const { data: lead, isLoading, isError, error } = useLead(id);
  const updateMutation = useUpdateLead();
  const statusMutation = useUpdateLeadStatus();
  const reassignMutation = useReassignLead();
  const owner = useEmployee(isAdmin ? lead?.ownerId : undefined);

  const { data: states } = useMasterData("STATE");
  const { data: cities } = useMasterData("CITY");
  const { data: leadSources } = useMasterData("LEAD_SOURCE");
  const { data: industries } = useMasterData("INDUSTRY");
  const { data: businessTypes } = useMasterData("BUSINESS_TYPE");
  const { data: designations } = useMasterData("DESIGNATION");
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  const { data: products } = useMasterData("PRODUCT");
  const { data: visitPurposes } = useMasterData("VISIT_PURPOSE");

  const { data: visitsPage, isLoading: visitsLoading } = useVisits(
    { leadId: id, size: 100 },
    { enabled: !!id },
  );
  const updateVisitStatusMutation = useUpdateVisitStatus();

  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | "">("");
  const { data: activityPage, isLoading: activityLoading } = useActivity(
    { leadId: id, size: 100, type: activityTypeFilter || undefined },
    { enabled: !!id },
  );
  // Actors on a lead's activity can be any employee who touched it (not just
  // its current owner), so resolve names from the full employee list rather
  // than the single-owner lookup above.
  const { data: employeesPage } = useEmployees({ size: 200 });
  const employeeNameById = new Map(
    (employeesPage?.content ?? []).map((emp) => [emp.id, emp.fullName]),
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [visitStatusError, setVisitStatusError] = useState<string | null>(null);
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  const visitPurposeMap = new Map((visitPurposes ?? []).map((p) => [p.id, p.label]));

  const openCreateVisit = () => {
    setEditingVisit(null);
    setVisitDialogOpen(true);
  };

  const openEditVisit = (visit: Visit) => {
    setEditingVisit(visit);
    setVisitDialogOpen(true);
  };

  const handleMarkVisitCompleted = async (visit: Visit) => {
    setVisitStatusError(null);
    try {
      await updateVisitStatusMutation.mutateAsync({
        id: visit.id,
        payload: { status: "COMPLETED" },
      });
    } catch (err) {
      setVisitStatusError(parseApiError(err).message);
    }
  };

  const handleConfirmReassign = async (newOwnerId: string) => {
    if (!lead) return;
    setReassignError(null);
    try {
      await reassignMutation.mutateAsync({ id: lead.id, newOwnerId });
      setReassignDialogOpen(false);
    } catch (err) {
      setReassignError(parseApiError(err).message);
    }
  };

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!lead) return;
    form.reset({
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      contactNo: lead.contactNo,
      stateId: lead.stateId,
      stateOther: lead.stateOther,
      cityId: lead.cityId,
      cityOther: lead.cityOther,
      leadSourceId: lead.leadSourceId,
      leadSourceOther: lead.leadSourceOther,
      industryId: lead.industryId,
      industryOther: lead.industryOther,
      businessTypeId: lead.businessTypeId,
      businessTypeOther: lead.businessTypeOther,
      turnover: lead.turnover != null ? String(lead.turnover) : "",
      designationId: lead.designationId,
      designationOther: lead.designationOther,
      email: lead.email ?? "",
      address: lead.address ?? "",
      productIds: lead.productIds ?? [],
      interestLevelId: lead.interestLevelId,
      interestLevelOther: lead.interestLevelOther,
      currentProductSolution: lead.currentProductSolution ?? "",
      budgetRange: lead.budgetRange ?? "",
      decisionMakerIdentified: lead.decisionMakerIdentified ?? false,
      interestReasonIds: lead.interestReasonIds ?? [],
      remarks: lead.remarks ?? "",
      nextFollowupDate: lead.nextFollowupDate ? dayjs(lead.nextFollowupDate) : null,
      expectedCloseDate: lead.expectedCloseDate
        ? dayjs(lead.expectedCloseDate)
        : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const stateOptions = states ?? [];
  const cityOptions = cities ?? [];
  const leadSourceOptions = leadSources ?? [];
  const industryOptions = industries ?? [];
  const businessTypeOptions = businessTypes ?? [];
  const designationOptions = designations ?? [];
  const interestLevelOptions = interestLevels ?? [];
  const productOptions = products ?? [];

  const cityOptionsForState = (stateId: string | null) =>
    stateId ? cityOptions.filter((c) => c.parentId === stateId) : cityOptions;

  // Mirrors the backend's LeadService#isHotInterestLevel gating: the full status dropdown is
  // only shown while Interest Level is Hot; otherwise the lead is locked to Interested (Lost
  // stays reachable via its own always-visible action, see the header below). Optional-chained
  // since `lead` is still undefined on the very first render, before the isLoading/isError
  // guards below return early.
  const isHotInterestLevel = lead?.interestLevelId
    ? (interestLevelOptions.find((i) => i.id === lead.interestLevelId)?.code ?? "").toUpperCase() === "HOT"
    : false;

  const isSaving = updateMutation.isPending;

  const onSubmit = async (values: EditFormValues) => {
    if (!lead) return;
    setFormError(null);
    const payload: UpdateLeadPayload = {
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
      productIds: values.productIds,
      interestLevelId: values.interestLevelId ?? undefined,
      interestLevelOther: values.interestLevelOther ?? undefined,
      currentProductSolution: values.currentProductSolution.trim() || undefined,
      budgetRange: values.budgetRange.trim() || undefined,
      decisionMakerIdentified: values.decisionMakerIdentified,
      interestReasonIds: values.interestReasonIds,
      remarks: values.remarks.trim() || undefined,
      nextFollowupDate: values.nextFollowupDate
        ? values.nextFollowupDate.format("YYYY-MM-DD")
        : undefined,
      expectedCloseDate: values.expectedCloseDate
        ? values.expectedCloseDate.format("YYYY-MM-DD")
        : undefined,
    };
    try {
      await updateMutation.mutateAsync({ id: lead.id, payload });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      for (const fieldError of parsed.fieldErrors) {
        if (fieldError.field in values) {
          form.setError(fieldError.field as keyof EditFormValues, {
            message: fieldError.message,
          });
        }
      }
    }
  };

  const handleStatusSelect = async (newStatus: LeadStatus) => {
    if (!lead || newStatus === lead.status) return;
    setStatusError(null);
    if (newStatus === "LOST") {
      setLostDialogOpen(true);
      return;
    }
    try {
      await statusMutation.mutateAsync({
        id: lead.id,
        payload: { status: newStatus },
      });
    } catch (err) {
      setStatusError(parseApiError(err).message);
    }
  };

  const handleConfirmLost = async (
    lostReasonId: string | null,
    lostReasonOther: string | null,
  ) => {
    if (!lead) return;
    setStatusError(null);
    try {
      await statusMutation.mutateAsync({
        id: lead.id,
        payload: {
          status: "LOST",
          lostReasonId: lostReasonId ?? undefined,
          lostReasonOther: lostReasonOther ?? undefined,
        },
      });
      setLostDialogOpen(false);
    } catch (err) {
      setStatusError(parseApiError(err).message);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !lead) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/app/leads")}
          sx={{ mb: 2 }}
        >
          Back to leads
        </Button>
        <Alert severity="error">
          {error ? parseApiError(error).message : "Lead not found."}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/app/leads")}
        sx={{ mb: 2 }}
      >
        Back to leads
      </Button>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h5">{lead.companyName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Created {dayjs(lead.createdAt).format("DD MMM YYYY, HH:mm")}
              {isAdmin && owner.data ? ` · Owner: ${owner.data.fullName}` : ""}
              {lead.status === "LOST" ? " · Unassigned – available for reassignment" : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Chip
              label={LEAD_STATUS_LABELS[lead.status]}
              color={LEAD_STATUS_COLORS[lead.status]}
            />
            {isHotInterestLevel ? (
              <TextField
                select
                label="Change status"
                size="small"
                sx={{ minWidth: 180 }}
                value={lead.status}
                disabled={statusMutation.isPending}
                onChange={(e) => handleStatusSelect(e.target.value as LeadStatus)}
              >
                {LEAD_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              lead.status !== "LOST" && (
                <Button
                  size="small"
                  color="error"
                  disabled={statusMutation.isPending}
                  onClick={() => {
                    setStatusError(null);
                    setLostDialogOpen(true);
                  }}
                >
                  Mark as Lost
                </Button>
              )
            )}
            {isAdmin && (
              <Button
                startIcon={<SwapHorizIcon />}
                variant="outlined"
                onClick={() => {
                  setReassignError(null);
                  setReassignDialogOpen(true);
                }}
              >
                Reassign
              </Button>
            )}
          </Stack>
        </Stack>
        {statusError && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            onClose={() => setStatusError(null)}
          >
            {statusError}
          </Alert>
        )}
        {lead.status === "LOST" && (lead.lostReasonId || lead.lostReasonOther) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Marked lost.
          </Alert>
        )}
      </Paper>

      <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
      <Paper
        variant="outlined"
        component="form"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        sx={{ p: 3 }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Lead details
        </Typography>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Company name"
              fullWidth
              {...form.register("companyName")}
              error={!!form.formState.errors.companyName}
              helperText={form.formState.errors.companyName?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
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
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Contact person"
              fullWidth
              {...form.register("contactPerson")}
              error={!!form.formState.errors.contactPerson}
              helperText={form.formState.errors.contactPerson?.message}
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
              error={!!form.formState.errors.contactNo}
              helperText={form.formState.errors.contactNo?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={form.control}
              name="productIds"
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={productOptions}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={productOptions.filter((p) =>
                    (field.value ?? []).includes(p.id),
                  )}
                  onChange={(_, selected) =>
                    field.onChange(selected.map((s) => s.id))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Products" />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }} sx={{ display: "flex", alignItems: "center" }}>
            <Controller
              control={form.control}
          <Grid size={{ xs: 12, sm: 6 }}>
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
              name="nextFollowupDate"
              render={({ field }) => (
                <DatePicker
                  label="Next follow-up date"
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
              <Grid size={{ xs: 12, sm: 4 }}>
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
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
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
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
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
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Current product / solution"
                  fullWidth
                  {...form.register("currentProductSolution")}
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

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Budget range"
                  fullWidth
                  {...form.register("budgetRange")}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            <LeadAttachmentsSection leadId={lead.id} />
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
        >
          <Typography variant="h6">Visits</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={openCreateVisit}
          >
            Add Visit
          </Button>
        </Stack>

        {visitStatusError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setVisitStatusError(null)}
          >
            {visitStatusError}
          </Alert>
        )}

        {visitsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!visitsLoading && (visitsPage?.content.length ?? 0) === 0 && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No visits logged yet.
          </Typography>
        )}

        {!visitsLoading && (visitsPage?.content.length ?? 0) > 0 && (
          <Stack spacing={1.5}>
            {visitsPage!.content
              .slice()
              .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
              .map((visit) => (
                <Paper key={visit.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                    }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <Typography variant="subtitle2">
                          {dayjs(visit.visitDate).format("DD MMM YYYY")}
                          {visit.scheduledTime ? ` · ${visit.scheduledTime.slice(0, 5)}` : ""}
                        </Typography>
                        <Chip
                          label={VISIT_TYPE_LABELS[visit.visitType]}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={VISIT_STATUS_LABELS[visit.status]}
                          color={VISIT_STATUS_COLORS[visit.status]}
                          size="small"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {visit.purposeId
                          ? (visitPurposeMap.get(visit.purposeId) ?? "—")
                          : (visit.purposeOther ?? "No purpose recorded")}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {visit.status === "PLANNED" && (
                        <Button
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          disabled={updateVisitStatusMutation.isPending}
                          onClick={() => handleMarkVisitCompleted(visit)}
                        >
                          Mark Completed
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openEditVisit(visit)}
                      >
                        Edit
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
          </Stack>
        )}
      </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Activity</Typography>
          <TextField
            select
            label="Type"
            size="small"
            sx={{ minWidth: 160 }}
            value={activityTypeFilter}
            onChange={(e) => setActivityTypeFilter(e.target.value as ActivityType | "")}
          >
            <MenuItem value="">All types</MenuItem>
            {ACTIVITY_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {activityLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!activityLoading && (activityPage?.content.length ?? 0) === 0 && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No activity yet.
          </Typography>
        )}

        {!activityLoading && (activityPage?.content.length ?? 0) > 0 && (
          <Stack spacing={0}>
            {activityPage!.content.map((entry, index) => {
              const Icon = activityIcon(entry.type);
              const isLast = index === activityPage!.content.length - 1;
              return (
                <Stack key={entry.id} direction="row" spacing={2}>
                  <Stack sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        bgcolor: `${activityColor(entry.type)}.main`,
                        color: `${activityColor(entry.type)}.contrastText`,
                        flexShrink: 0,
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    {!isLast && (
                      <Box
                        sx={{
                          width: "2px",
                          flexGrow: 1,
                          bgcolor: "divider",
                          my: 0.5,
                        }}
                      />
                    )}
                  </Stack>
                  <Box sx={{ pb: 2.5, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 0.25 }}
                    >
                      <Typography variant="subtitle2">
                        {activityLabel(entry.type)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(entry.createdAt).format("DD MMM YYYY, HH:mm")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2">
                      {entry.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {resolveActorName(entry.actorId, employeeNameById)}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Paper>
      </Grid>
      </Grid>

      <LeadLostReasonDialog
        open={lostDialogOpen}
        isPending={statusMutation.isPending}

        errorMessage={lostDialogOpen ? statusError : null}
        onCancel={() => setLostDialogOpen(false)}
        onConfirm={handleConfirmLost}
      />

      <ReassignLeadDialog
        open={reassignDialogOpen}
        isPending={reassignMutation.isPending}
        errorMessage={reassignDialogOpen ? reassignError : null}
        currentOwnerId={lead.ownerId}
        onCancel={() => setReassignDialogOpen(false)}
        onConfirm={handleConfirmReassign}
      />

      <VisitFormDialog
        open={visitDialogOpen}
        onClose={() => setVisitDialogOpen(false)}
        leadId={lead.id}
        lead={lead}
        visit={editingVisit}
      />
    </Box>
  );
}
