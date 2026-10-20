import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { Customer } from "../../api/customersApi";
import { useLeads } from "../../api/leadsApi";
import { useProducts } from "../../api/productsApi";
import { useQuotations } from "../../api/quotationsApi";
import { useBillingProfile } from "../../api/billingProfileApi";
import { useMasterData } from "../../api/masterDataApi";
import type { PurchaseOrder, PurchaseOrderPayload } from "../../api/purchaseOrdersApi";
import {
  prefillPurchaseOrderFromQuotation,
  useCreatePurchaseOrder,
  usePurchaseOrderAttachments,
  useUpdatePurchaseOrder,
} from "../../api/purchaseOrdersApi";
import { downloadLeadAttachment } from "../../api/attachmentsApi";
import { parseApiError } from "../../api/errorHelpers";
import { isInterState, splitTax } from "../../utils/gst";
import { CustomerAutocomplete } from "../customers/CustomerAutocomplete";

const positiveNumber = (label: string) =>
  z
    .string()
    .refine((v) => v.trim() !== "" && Number(v) > 0, `${label} must be greater than zero`);
const nonNegativeNumber = (label: string) =>
  z.string().refine((v) => v.trim() !== "" && Number(v) >= 0, `${label} must not be negative`);

const lineSchema = z.object({
  productId: z.string().nullable(),
  quotationLineId: z.string().nullable(),
  description: z.string().trim().min(1, "Description is required").max(500),
  hsnSac: z.string().max(20),
  unit: z.string().max(50),
  quantity: positiveNumber("Quantity"),
  rate: nonNegativeNumber("Rate"),
  taxRatePercent: nonNegativeNumber("Tax %"),
});

const schema = z.object({
  leadId: z.string().min(1, "Choose the lead this order belongs to"),
  quotationId: z.string().nullable(),
  poNumber: z.string().trim().min(1, "PO number is required").max(100),
  poDate: z.string().min(1, "PO date is required"),
  deliveryDate: z.string(),
  paymentTermsDays: z
    .string()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 365),
      "Payment terms must be 0-365 days"),
  customerName: z.string().max(255),
  customerGstin: z
    .string()
    .refine((v) => v === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v),
      "Enter a valid 15-character GSTIN"),
  billingAddress: z.string().max(1000),
  shippingAddress: z.string().max(1000),
  placeOfSupplyStateId: z.string().nullable(),
  notes: z.string().max(2000),
  lineItems: z.array(lineSchema),
});
type FormValues = z.infer<typeof schema>;
type LineValues = FormValues["lineItems"][number];

function emptyLine(): LineValues {
  return {
    productId: null,
    quotationLineId: null,
    description: "",
    hsnSac: "",
    unit: "",
    quantity: "1",
    rate: "0",
    taxRatePercent: "0",
  };
}

function emptyValues(leadId: string): FormValues {
  return {
    leadId,
    quotationId: null,
    poNumber: "",
    poDate: dayjs().format("YYYY-MM-DD"),
    deliveryDate: "",
    paymentTermsDays: "",
    customerName: "",
    customerGstin: "",
    billingAddress: "",
    shippingAddress: "",
    placeOfSupplyStateId: null,
    notes: "",
    lineItems: [emptyLine()],
  };
}

function valuesFromPayload(p: PurchaseOrderPayload): FormValues {
  return {
    leadId: p.leadId,
    quotationId: p.quotationId ?? null,
    poNumber: p.poNumber ?? "",
    poDate: p.poDate,
    deliveryDate: p.deliveryDate ?? "",
    paymentTermsDays: p.paymentTermsDays != null ? String(p.paymentTermsDays) : "",
    customerName: p.customerName ?? "",
    customerGstin: p.customerGstin ?? "",
    billingAddress: p.billingAddress ?? "",
    shippingAddress: p.shippingAddress ?? "",
    placeOfSupplyStateId: p.placeOfSupplyStateId ?? null,
    notes: p.notes ?? "",
    lineItems: (p.lineItems ?? []).map((l) => ({
      productId: l.productId ?? null,
      quotationLineId: l.quotationLineId ?? null,
      description: l.description,
      hsnSac: l.hsnSac ?? "",
      unit: l.unit ?? "",
      quantity: String(l.quantity),
      rate: String(l.rate),
      taxRatePercent: String(l.taxRatePercent),
    })),
  };
}

function valuesFromPurchaseOrder(po: PurchaseOrder): FormValues {
  return {
    leadId: po.leadId,
    quotationId: po.quotationId,
    poNumber: po.poNumber,
    poDate: po.poDate,
    deliveryDate: po.deliveryDate ?? "",
    paymentTermsDays: po.paymentTermsDays != null ? String(po.paymentTermsDays) : "",
    customerName: po.customerName,
    customerGstin: po.customerGstin ?? "",
    billingAddress: po.billingAddress ?? "",
    shippingAddress: po.shippingAddress ?? "",
    placeOfSupplyStateId: po.placeOfSupplyStateId,
    notes: po.notes ?? "",
    lineItems: po.lineItems.map((l) => ({
      productId: l.productId,
      quotationLineId: l.quotationLineId,
      description: l.description,
      hsnSac: l.hsnSac ?? "",
      unit: l.unit ?? "",
      quantity: String(l.quantityOrdered),
      rate: String(l.rate),
      taxRatePercent: String(l.taxRatePercent),
    })),
  };
}

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fixed lead (opened from a lead page). Without it the dialog asks for one. */
  leadId?: string;
  /** When present, the dialog edits this purchase order. */
  purchaseOrder?: PurchaseOrder | null;
  onSaved?: (po: PurchaseOrder) => void;
}

export function PurchaseOrderFormDialog({ open, onClose, leadId, purchaseOrder, onSaved }: PurchaseOrderFormDialogProps) {
  const isEdit = !!purchaseOrder;
  // Once an invoice exists the lines are frozen server-side (cancelled invoices still point at them).
  const linesLocked = isEdit && (purchaseOrder?.invoices.length ?? 0) > 0;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const { data: leadsPage } = useLeads({ size: 200 }, { enabled: open && !leadId && !isEdit });
  const { data: productsPage } = useProducts({ includeInactive: false, size: 200 });
  const { data: states } = useMasterData("STATE");
  const { data: billingProfile } = useBillingProfile(open);
  const { data: existingAttachments } = usePurchaseOrderAttachments(isEdit ? purchaseOrder?.id : null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(leadId ?? ""),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
  const watchedLeadId = useWatch({ control: form.control, name: "leadId" });
  const watchedLines = useWatch({ control: form.control, name: "lineItems" });
  const watchedState = useWatch({ control: form.control, name: "placeOfSupplyStateId" });

  const { data: quotationsPage } = useQuotations({ size: 200 }, { enabled: open && !!watchedLeadId && !linesLocked });
  const leadQuotations = useMemo(
    () => (quotationsPage?.content ?? []).filter((q) => q.leadId === watchedLeadId),
    [quotationsPage, watchedLeadId],
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setFile(null);
    setCustomer(null);
    form.reset(isEdit && purchaseOrder ? valuesFromPurchaseOrder(purchaseOrder) : emptyValues(leadId ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, purchaseOrder, leadId]);

  const interState = isInterState(billingProfile?.billingStateId, watchedState);
  const totals = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const line of watchedLines ?? []) {
      const lineTaxable = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
      const t = splitTax(lineTaxable, Number(line.taxRatePercent) || 0, interState);
      taxable += lineTaxable;
      cgst += t.cgst;
      sgst += t.sgst;
      igst += t.igst;
    }
    return { taxable, cgst, sgst, igst, grand: taxable + cgst + sgst + igst };
  }, [watchedLines, interState]);

  const handleCustomerPick = (picked: Customer | null) => {
    setCustomer(picked);
    if (!picked) return;
    form.setValue("customerName", picked.name);
    form.setValue("customerGstin", picked.gstin ?? "");
    form.setValue("billingAddress", picked.address ?? "");
    if (!form.getValues("shippingAddress")) form.setValue("shippingAddress", picked.address ?? "");
    if (picked.stateId) form.setValue("placeOfSupplyStateId", picked.stateId);
  };

  const handleCopyFromQuotation = async (quotationId: string) => {
    setFormError(null);
    setCopyBusy(true);
    try {
      const prefill = await prefillPurchaseOrderFromQuotation(quotationId);
      const current = form.getValues();
      const copied = valuesFromPayload(prefill);
      // Keep what the user already typed for the customer's own PO number / dates.
      form.reset({
        ...copied,
        leadId: current.leadId || copied.leadId,
        poNumber: current.poNumber,
        poDate: current.poDate || copied.poDate,
        deliveryDate: current.deliveryDate,
        paymentTermsDays: current.paymentTermsDays,
        notes: current.notes,
      });
    } catch (error) {
      setFormError(parseApiError(error).message);
    } finally {
      setCopyBusy(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const payload: PurchaseOrderPayload = {
      leadId: values.leadId,
      quotationId: values.quotationId,
      customerId: customer?.id ?? purchaseOrder?.customerId ?? null,
      poNumber: values.poNumber.trim(),
      poDate: values.poDate,
      deliveryDate: values.deliveryDate || null,
      paymentTermsDays: values.paymentTermsDays === "" ? null : Number(values.paymentTermsDays),
      customerName: values.customerName.trim() || undefined,
      customerGstin: values.customerGstin.trim() || undefined,
      billingAddress: values.billingAddress.trim() || undefined,
      shippingAddress: values.shippingAddress.trim() || undefined,
      placeOfSupplyStateId: values.placeOfSupplyStateId,
      notes: values.notes.trim() || undefined,
    };
    if (!linesLocked) {
      if (values.lineItems.length === 0) {
        setFormError("Add at least one line");
        return;
      }
      payload.lineItems = values.lineItems.map((l) => ({
        productId: l.productId,
        quotationLineId: l.quotationLineId,
        description: l.description.trim(),
        hsnSac: l.hsnSac.trim() || undefined,
        unit: l.unit.trim() || undefined,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        taxRatePercent: Number(l.taxRatePercent),
      }));
    }
    try {
      const result =
        isEdit && purchaseOrder
          ? await updateMutation.mutateAsync({ id: purchaseOrder.id, payload, file })
          : await createMutation.mutateAsync({ payload, file });
      if (result.uploadFailed) {
        // Saved, but the scan didn't go up: keep the dialog's message visible by closing after notice.
        window.alert("The purchase order was saved, but the PO document failed to upload. You can upload it from the PO page.");
      }
      onSaved?.(result.po);
      onClose();
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
      for (const fe of parsed.fieldErrors) {
        if (fe.field in form.getValues()) {
          form.setError(fe.field as keyof FormValues, { message: fe.message });
        }
      }
    }
  };

  const errors = form.formState.errors;
  const stateOptions = states ?? [];

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg" fullScreen={isMobile}>
      <DialogTitle>{isEdit ? `Edit purchase order ${purchaseOrder?.poNumber}` : "Add purchase order"}</DialogTitle>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError && <Alert severity="error" onClose={() => setFormError(null)}>{formError}</Alert>}

            {!leadId && !isEdit && (
              <Controller
                control={form.control}
                name="leadId"
                render={({ field }) => (
                  <Autocomplete
                    options={leadsPage?.content ?? []}
                    getOptionLabel={(l) => `${l.companyName} (${l.contactPerson})`}
                    value={(leadsPage?.content ?? []).find((l) => l.id === field.value) ?? null}
                    onChange={(_, lead) => {
                      field.onChange(lead?.id ?? "");
                      form.setValue("quotationId", null);
                      if (lead && !form.getValues("customerName")) form.setValue("customerName", lead.companyName);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Lead" required error={!!errors.leadId}
                        helperText={errors.leadId?.message} />
                    )}
                  />
                )}
              />
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Customer's PO number"
                required
                fullWidth
                error={!!errors.poNumber}
                helperText={errors.poNumber?.message ?? "Exactly as printed on the customer's PO"}
                {...form.register("poNumber")}
              />
              <TextField
                label="PO date"
                type="date"
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.poDate}
                helperText={errors.poDate?.message}
                {...form.register("poDate")}
              />
              <TextField
                label="Delivery date"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                {...form.register("deliveryDate")}
              />
              <TextField
                label="Payment terms (days)"
                type="number"
                fullWidth
                error={!!errors.paymentTermsDays}
                helperText={errors.paymentTermsDays?.message ?? "Sets the invoice due date"}
                {...form.register("paymentTermsDays")}
              />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption" color="text.secondary">Customer</Typography></Divider>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <CustomerAutocomplete
                  value={customer}
                  onChange={handleCustomerPick}
                  label="Fill from customer master (optional)"
                />
              </Box>
              <TextField label="Customer name" fullWidth error={!!errors.customerName}
                helperText={errors.customerName?.message ?? "Defaults to the lead's company"}
                {...form.register("customerName")} />
              <TextField label="GSTIN" fullWidth error={!!errors.customerGstin}
                helperText={errors.customerGstin?.message} {...form.register("customerGstin")} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Billing address" fullWidth multiline minRows={2} {...form.register("billingAddress")} />
              <TextField label="Shipping address" fullWidth multiline minRows={2} {...form.register("shippingAddress")} />
              <Controller
                control={form.control}
                name="placeOfSupplyStateId"
                render={({ field }) => (
                  <Autocomplete
                    fullWidth
                    options={stateOptions}
                    getOptionLabel={(s) => s.label}
                    value={stateOptions.find((s) => s.id === field.value) ?? null}
                    onChange={(_, s) => field.onChange(s?.id ?? null)}
                    renderInput={(params) => (
                      <TextField {...params} label="Place of supply (state)"
                        helperText={!billingProfile?.billingStateId
                          ? "Set your business state in Settings to enable IGST."
                          : interState ? "Inter-state - IGST" : "Same state - CGST + SGST"} />
                    )}
                  />
                )}
              />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption" color="text.secondary">Lines</Typography></Divider>

            {linesLocked && (
              <Alert severity="info">
                An invoice has been raised against this purchase order, so its lines can no longer be changed.
                You can still edit the header details.
              </Alert>
            )}

            {!linesLocked && (
              <Controller
                control={form.control}
                name="quotationId"
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    label="Copy lines from a quotation (optional)"
                    value={field.value ?? ""}
                    disabled={copyBusy || !watchedLeadId}
                    onChange={(e) => {
                      const id = e.target.value;
                      field.onChange(id || null);
                      if (id) void handleCopyFromQuotation(id);
                    }}
                    helperText={watchedLeadId && leadQuotations.length === 0
                      ? "This lead has no quotations." : "Replaces the lines below with the quotation's"}
                    sx={{ maxWidth: 420 }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {leadQuotations.map((q) => (
                      <MenuItem key={q.id} value={q.id}>
                        {q.quotationNumber} - {q.grandTotal}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}

            <Stack spacing={1.5}>
              {fields.map((field, index) => {
                const lineErrors = errors.lineItems?.[index];
                const qty = Number(watchedLines?.[index]?.quantity) || 0;
                const rate = Number(watchedLines?.[index]?.rate) || 0;
                return (
                  <Stack key={field.id} direction={{ xs: "column", md: "row" }} spacing={1.5}
                    sx={{ alignItems: { md: "flex-start" } }}>
                    <Autocomplete
                      size="small"
                      sx={{ width: { md: 200 }, flexShrink: 0 }}
                      disabled={linesLocked}
                      options={productsPage?.content ?? []}
                      getOptionLabel={(p) => p.name}
                      value={(productsPage?.content ?? []).find((p) => p.id === watchedLines?.[index]?.productId) ?? null}
                      onChange={(_, product) => {
                        form.setValue(`lineItems.${index}.productId`, product?.id ?? null);
                        if (product) {
                          form.setValue(`lineItems.${index}.description`, product.name);
                          form.setValue(`lineItems.${index}.hsnSac`, product.hsnSacCode ?? "");
                          form.setValue(`lineItems.${index}.unit`, product.unitOfMeasure ?? "");
                          form.setValue(`lineItems.${index}.rate`, String(product.unitPrice));
                          form.setValue(`lineItems.${index}.taxRatePercent`, String(product.taxRatePercent));
                        }
                      }}
                      renderInput={(params) => <TextField {...params} label="Catalog product (optional)" />}
                    />
                    <TextField size="small" label="Description" fullWidth disabled={linesLocked}
                      error={!!lineErrors?.description} helperText={lineErrors?.description?.message}
                      {...form.register(`lineItems.${index}.description`)} />
                    <TextField size="small" label="HSN/SAC" sx={{ width: { md: 110 }, flexShrink: 0 }} disabled={linesLocked}
                      {...form.register(`lineItems.${index}.hsnSac`)} />
                    <TextField size="small" label="Unit" sx={{ width: { md: 80 }, flexShrink: 0 }} disabled={linesLocked}
                      {...form.register(`lineItems.${index}.unit`)} />
                    <TextField size="small" label="Qty" type="number" sx={{ width: { md: 90 }, flexShrink: 0 }} disabled={linesLocked}
                      error={!!lineErrors?.quantity} helperText={lineErrors?.quantity?.message}
                      {...form.register(`lineItems.${index}.quantity`)} />
                    <TextField size="small" label="Rate" type="number" sx={{ width: { md: 110 }, flexShrink: 0 }} disabled={linesLocked}
                      error={!!lineErrors?.rate} helperText={lineErrors?.rate?.message}
                      {...form.register(`lineItems.${index}.rate`)} />
                    <TextField size="small" label="Tax %" type="number" sx={{ width: { md: 80 }, flexShrink: 0 }} disabled={linesLocked}
                      error={!!lineErrors?.taxRatePercent} helperText={lineErrors?.taxRatePercent?.message}
                      {...form.register(`lineItems.${index}.taxRatePercent`)} />
                    <Typography variant="body2" sx={{ width: { md: 100 }, flexShrink: 0, pt: { md: 1 }, textAlign: "right" }}>
                      {(qty * rate).toFixed(2)}
                    </Typography>
                    {!linesLocked && (
                      <IconButton size="small" onClick={() => remove(index)} disabled={fields.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                );
              })}
            </Stack>

            {!linesLocked && (
              <Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => append(emptyLine())}>
                  Add line
                </Button>
              </Box>
            )}

            {!linesLocked && (
              <Stack spacing={0.25} sx={{ alignItems: "flex-end" }}>
                <Typography variant="body2">Taxable amount: {totals.taxable.toFixed(2)}</Typography>
                {interState ? (
                  <Typography variant="body2">IGST: {totals.igst.toFixed(2)}</Typography>
                ) : (
                  <>
                    <Typography variant="body2">CGST: {totals.cgst.toFixed(2)}</Typography>
                    <Typography variant="body2">SGST: {totals.sgst.toFixed(2)}</Typography>
                  </>
                )}
                <Typography variant="subtitle1">Grand total: {totals.grand.toFixed(2)}</Typography>
              </Stack>
            )}

            <TextField label="Notes" fullWidth multiline minRows={2} {...form.register("notes")} />

            <Divider textAlign="left"><Typography variant="caption" color="text.secondary">Customer's PO document</Typography></Divider>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Button component="label" size="small" variant="outlined" startIcon={<UploadFileIcon />}>
                {file ? "Change file" : "Choose file"}
                <input type="file" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {file ? file.name : "PDF, image or document (max 10 MB) - uploaded when you save"}
              </Typography>
              {file && <Button size="small" onClick={() => setFile(null)}>Remove</Button>}
            </Stack>
            {existingAttachments && existingAttachments.length > 0 && (
              <Stack spacing={0.5}>
                {existingAttachments.map((a) => (
                  <Button key={a.id} size="small" sx={{ justifyContent: "flex-start" }}
                    onClick={() => void downloadLeadAttachment(a)}>
                    {a.fileName}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Add purchase order"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
