import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useLeads } from "../../api/leadsApi";
import type { Lead } from "../../api/leadsApi";
import { useProducts } from "../../api/productsApi";
import type { Product } from "../../api/productsApi";
import { useEmployees } from "../../api/employeesApi";
import { useMasterData } from "../../api/masterDataApi";
import { useBillingProfile } from "../../api/billingProfileApi";
import { isInterState, splitTax } from "../../utils/gst";
import { CreatableMasterAutocomplete } from "../../components/CreatableMasterAutocomplete";
import type { Customer } from "../../api/customersApi";
import { useCustomer } from "../../api/customersApi";
import { CustomerAutocomplete } from "../customers/CustomerAutocomplete";
import type { QuotationLineItemPayload, QuotationPayload } from "../../api/quotationsApi";
import { useCreateQuotation, useQuotation, useUpdateQuotation } from "../../api/quotationsApi";
import { parseApiError } from "../../api/errorHelpers";

type LineItemMode = "catalog" | "adhoc";

interface LineItemRow {
  key: string;
  mode: LineItemMode;
  productId: string | null;
  hsnSac: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRatePercent: string;
}

function emptyRow(): LineItemRow {
  return {
    key: crypto.randomUUID(),
    mode: "catalog",
    productId: null,
    hsnSac: "",
    description: "",
    unit: "",
    quantity: "1",
    unitPrice: "0",
    discountPercent: "0",
    taxRatePercent: "0",
  };
}

function computeLineTotals(row: LineItemRow, interState: boolean) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const discountPercent = Number(row.discountPercent) || 0;
  const taxRatePercent = Number(row.taxRatePercent) || 0;
  const lineSubtotal = quantity * unitPrice;
  const lineDiscount = lineSubtotal * (discountPercent / 100);
  const lineTaxable = lineSubtotal - lineDiscount;
  const { cgst, sgst, igst } = splitTax(lineTaxable, taxRatePercent, interState);
  return { lineSubtotal, lineDiscount, lineTaxable, cgst, sgst, igst, lineTotal: lineTaxable + cgst + sgst + igst };
}

/**
 * Combined create/edit page (edit only reachable while DRAFT/SENT, enforced server-side) -
 * plain useState for the same reasons documented on invoicing.InvoiceFormPage: a heterogeneous,
 * dynamically-shaped line-items array doesn't fit react-hook-form's static-schema pattern
 * cleanly, and this keeps one consistent style with that closest sibling page.
 */
export function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing } = useQuotation(id);
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const { data: leadsPage } = useLeads({ size: 200 });
  const { data: productsPage } = useProducts({ includeInactive: false, size: 200 });
  const products = useMemo(() => productsPage?.content ?? [], [productsPage]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const { data: employeesPage } = useEmployees({ size: 200 });
  const { data: industries } = useMasterData("INDUSTRY");
  const { data: cities } = useMasterData("CITY");
  const { data: states } = useMasterData("STATE");
  const { data: interestLevels } = useMasterData("INTEREST_LEVEL");
  const { data: businessTypes } = useMasterData("BUSINESS_TYPE");

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { data: existingCustomer } = useCustomer(existing?.customerId);

  const [customerContactPerson, setCustomerContactPerson] = useState("");
  const [customerDesignation, setCustomerDesignation] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerBillingAddress, setCustomerBillingAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  const [industryId, setIndustryId] = useState<string | null>(null);
  const [industryOther, setIndustryOther] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [cityOther, setCityOther] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const [stateOther, setStateOther] = useState<string | null>(null);
  const { data: billingProfile } = useBillingProfile(true);
  const interState = isInterState(billingProfile?.billingStateId, stateId);
  const [interestLevelId, setInterestLevelId] = useState<string | null>(null);
  const [interestLevelOther, setInterestLevelOther] = useState<string | null>(null);
  const [businessTypeId, setBusinessTypeId] = useState<string | null>(null);
  const [businessTypeOther, setBusinessTypeOther] = useState<string | null>(null);
  const [typeOfVisit, setTypeOfVisit] = useState<"" | "FIELD" | "TELEPHONIC">("");

  const [quotationDate, setQuotationDate] = useState<Dayjs | null>(dayjs());
  const [validTillDate, setValidTillDate] = useState<Dayjs | null>(dayjs().add(14, "day"));
  const [referenceEnquiryNo, setReferenceEnquiryNo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState<Dayjs | null>(null);

  const [quotationNotes, setQuotationNotes] = useState(
    "Thank you for your interest in our products.\nWe are pleased to submit our quotation for your kind consideration.\nFor any clarification, feel free to contact us.",
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    "1. Prices are valid for the period mentioned above.\n2. Payment to be made within the due date.\n3. Goods once sold will not be taken back or exchanged.",
  );
  const [internalNote, setInternalNote] = useState("");

  const [followUpDate, setFollowUpDate] = useState<Dayjs | null>(null);
  const [followUpTime, setFollowUpTime] = useState<Dayjs | null>(null);
  const [followUpByEmployeeId, setFollowUpByEmployeeId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");

  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setCustomerContactPerson(existing.customerContactPerson ?? "");
    setCustomerDesignation(existing.customerDesignation ?? "");
    setCustomerPhone(existing.customerPhone ?? "");
    setCustomerEmail(existing.customerEmail ?? "");
    setCustomerBillingAddress(existing.customerBillingAddress ?? "");
    setCustomerGstin(existing.customerGstin ?? "");
    setIndustryId(existing.industryId);
    setIndustryOther(existing.industryOther);
    setCityId(existing.cityId);
    setCityOther(existing.cityOther);
    setStateId(existing.stateId);
    setStateOther(existing.stateOther);
    setInterestLevelId(existing.interestLevelId);
    setInterestLevelOther(existing.interestLevelOther);
    setBusinessTypeId(existing.businessTypeId);
    setBusinessTypeOther(existing.businessTypeOther);
    setTypeOfVisit(existing.typeOfVisit ?? "");
    setQuotationDate(dayjs(existing.quotationDate));
    setValidTillDate(existing.validTillDate ? dayjs(existing.validTillDate) : null);
    setReferenceEnquiryNo(existing.referenceEnquiryNo ?? "");
    setExpectedCloseDate(existing.expectedCloseDate ? dayjs(existing.expectedCloseDate) : null);
    setQuotationNotes(existing.quotationNotes ?? "");
    setTermsAndConditions(existing.termsAndConditions ?? "");
    setInternalNote(existing.internalNote ?? "");
    setFollowUpDate(existing.followUpDate ? dayjs(existing.followUpDate) : null);
    setFollowUpTime(existing.followUpTime ? dayjs(existing.followUpTime, "HH:mm:ss") : null);
    setFollowUpByEmployeeId(existing.followUpByEmployeeId);
    setFollowUpNote(existing.followUpNote ?? "");
    setLineItems(
      existing.lineItems.length > 0
        ? existing.lineItems.map((line) => ({
            key: crypto.randomUUID(),
            mode: line.productId ? "catalog" : "adhoc",
            productId: line.productId,
            hsnSac: line.hsnSac ?? "",
            description: line.description,
            unit: line.unit ?? "",
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            discountPercent: String(line.discountPercent),
            taxRatePercent: String(line.taxRatePercent),
          }))
        : [emptyRow()],
    );
  }, [existing]);

  useEffect(() => {
    if (existingCustomer) setSelectedCustomer(existingCustomer);
  }, [existingCustomer]);

  const handleLeadChange = (lead: Lead | null) => {
    setSelectedLead(lead);
    if (lead) {
      setCustomerContactPerson(lead.contactPerson ?? "");
      setCustomerPhone(lead.contactNo ?? "");
      setCustomerEmail(lead.email ?? "");
      setCustomerBillingAddress(lead.address ?? "");
    }
  };

  const handleCustomerChange = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setCustomerContactPerson(customer.contactPerson ?? "");
      setCustomerPhone(customer.phone ?? "");
      setCustomerEmail(customer.email ?? "");
      setCustomerBillingAddress(customer.address ?? "");
      setCustomerGstin(customer.gstin ?? "");
      setCityId(customer.cityId);
      setStateId(customer.stateId);
      setIndustryId(customer.industryId);
    }
  };

  const updateRow = (key: string, patch: Partial<LineItemRow>) => {
    setLineItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleProductSelect = (key: string, product: Product | null) => {
    if (!product) {
      updateRow(key, { productId: null, description: "", unitPrice: "0", taxRatePercent: "0", hsnSac: "", unit: "" });
      return;
    }
    updateRow(key, {
      productId: product.id,
      description: product.name,
      unitPrice: String(product.unitPrice),
      taxRatePercent: String(product.taxRatePercent),
      hsnSac: product.hsnSacCode ?? "",
      unit: product.unitOfMeasure ?? "",
    });
  };

  const handleModeChange = (key: string, mode: LineItemMode) => {
    updateRow(key, { mode, productId: null, description: "", unitPrice: "0", taxRatePercent: "0", hsnSac: "" });
  };

  const addRow = () => setLineItems((rows) => [...rows, emptyRow()]);
  const removeRow = (key: string) =>
    setLineItems((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    for (const row of lineItems) {
      const t = computeLineTotals(row, interState);
      subtotal += t.lineSubtotal;
      discountTotal += t.lineDiscount;
      cgstTotal += t.cgst;
      sgstTotal += t.sgst;
      igstTotal += t.igst;
    }
    const taxableAmount = subtotal - discountTotal;
    return {
      subtotal,
      discountTotal,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal: taxableAmount + cgstTotal + sgstTotal + igstTotal,
    };
  }, [lineItems, interState]);

  const buildPayload = (status: "DRAFT" | "SENT"): QuotationPayload | null => {
    if (!selectedCustomer) {
      setFormError("Customer is required");
      return null;
    }
    if (!quotationDate) {
      setFormError("Quotation date is required");
      return null;
    }
    for (const row of lineItems) {
      if (row.mode === "catalog" && !row.productId) {
        setFormError("Every catalog line must have a product selected");
        return null;
      }
      if (row.mode === "adhoc" && !row.description.trim()) {
        setFormError("Every custom line must have a description");
        return null;
      }
      if (!(Number(row.quantity) > 0)) {
        setFormError("Every line's quantity must be greater than zero");
        return null;
      }
    }

    const payloadLineItems: QuotationLineItemPayload[] = lineItems.map((row) => {
      const shared = {
        quantity: Number(row.quantity),
        unit: row.unit || undefined,
        discountPercent: Number(row.discountPercent) || 0,
      };
      if (row.mode === "catalog") {
        return { ...shared, productId: row.productId as string };
      }
      return {
        ...shared,
        hsnSac: row.hsnSac || undefined,
        description: row.description,
        unitPrice: Number(row.unitPrice) || 0,
        taxRatePercent: Number(row.taxRatePercent) || 0,
      };
    });

    return {
      leadId: selectedLead?.id,
      customerId: selectedCustomer.id,
      customerContactPerson: customerContactPerson.trim() || undefined,
      customerDesignation: customerDesignation.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerBillingAddress: customerBillingAddress.trim() || undefined,
      customerGstin: customerGstin.trim() || undefined,
      industryId,
      industryOther: industryOther ?? undefined,
      cityId,
      cityOther: cityOther ?? undefined,
      stateId,
      stateOther: stateOther ?? undefined,
      interestLevelId,
      interestLevelOther: interestLevelOther ?? undefined,
      businessTypeId,
      businessTypeOther: businessTypeOther ?? undefined,
      typeOfVisit: typeOfVisit || null,
      quotationDate: quotationDate.format("YYYY-MM-DD"),
      validTillDate: validTillDate ? validTillDate.format("YYYY-MM-DD") : undefined,
      referenceEnquiryNo: referenceEnquiryNo.trim() || undefined,
      expectedCloseDate: expectedCloseDate ? expectedCloseDate.format("YYYY-MM-DD") : undefined,
      quotationNotes: quotationNotes.trim() || undefined,
      termsAndConditions: termsAndConditions.trim() || undefined,
      internalNote: internalNote.trim() || undefined,
      followUpDate: followUpDate ? followUpDate.format("YYYY-MM-DD") : undefined,
      followUpTime: followUpTime ? followUpTime.format("HH:mm:ss") : undefined,
      followUpByEmployeeId: followUpByEmployeeId ?? undefined,
      followUpNote: followUpNote.trim() || undefined,
      lineItems: payloadLineItems,
      status,
    };
  };

  const handleSubmit = async (status: "DRAFT" | "SENT") => {
    setFormError(null);
    const payload = buildPayload(status);
    if (!payload) return;
    try {
      const quotation = isEdit
        ? await updateMutation.mutateAsync({ id: id as string, payload })
        : await createMutation.mutateAsync(payload);
      navigate(`/app/quotations/${quotation.id}`);
    } catch (error) {
      setFormError(parseApiError(error).message);
    }
  };

  return (
    <Box>
      <Typography variant="h5">{isEdit ? "Edit Quotation" : "New Quotation"}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Create and send professional quotations to your customers
      </Typography>

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Quotation Details
            </Typography>
            <Stack spacing={2}>
              <DatePicker
                label="Quotation Date"
                value={quotationDate}
                onChange={setQuotationDate}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="Valid Till"
                value={validTillDate}
                onChange={setValidTillDate}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                label="Reference / Enquiry No."
                fullWidth
                value={referenceEnquiryNo}
                onChange={(e) => setReferenceEnquiryNo(e.target.value)}
              />
              <TextField
                select
                label="Type of Visit"
                fullWidth
                value={typeOfVisit}
                onChange={(e) => setTypeOfVisit(e.target.value as "" | "FIELD" | "TELEPHONIC")}
              >
                <MenuItem value="">Not set</MenuItem>
                <MenuItem value="FIELD">Field Visit</MenuItem>
                <MenuItem value="TELEPHONIC">Telephonic</MenuItem>
              </TextField>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Customer Details
            </Typography>
            <Stack spacing={2}>
              <Autocomplete
                options={leadsPage?.content ?? []}
                getOptionLabel={(lead) => `${lead.companyName} (${lead.contactPerson})`}
                value={selectedLead}
                onChange={(_, lead) => handleLeadChange(lead)}
                renderInput={(params) => (
                  <TextField {...params} label="Link an existing Lead (optional)" />
                )}
              />
              <CustomerAutocomplete value={selectedCustomer} onChange={handleCustomerChange} label="Customer *" />
              <TextField
                label="Contact Person"
                fullWidth
                value={customerContactPerson}
                onChange={(e) => setCustomerContactPerson(e.target.value)}
              />
              <TextField
                label="Designation"
                fullWidth
                value={customerDesignation}
                onChange={(e) => setCustomerDesignation(e.target.value)}
              />
              <TextField
                label="Phone"
                fullWidth
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <TextField
                label="Email"
                fullWidth
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
              <TextField
                label="Billing Address"
                fullWidth
                multiline
                minRows={2}
                value={customerBillingAddress}
                onChange={(e) => setCustomerBillingAddress(e.target.value)}
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Other Details
            </Typography>
            <Stack spacing={2}>
              <CreatableMasterAutocomplete
                label="Industry"
                options={industries ?? []}
                idValue={industryId}
                otherValue={industryOther}
                onChange={({ id: next, other }) => {
                  setIndustryId(next);
                  setIndustryOther(other);
                }}
              />
              <CreatableMasterAutocomplete
                label="State"
                options={states ?? []}
                idValue={stateId}
                otherValue={stateOther}
                onChange={({ id: next, other }) => {
                  setStateId(next);
                  setStateOther(other);
                }}
              />
              <CreatableMasterAutocomplete
                label="City"
                options={cities ?? []}
                idValue={cityId}
                otherValue={cityOther}
                onChange={({ id: next, other }) => {
                  setCityId(next);
                  setCityOther(other);
                }}
              />
              <CreatableMasterAutocomplete
                label="Interest Level"
                options={interestLevels ?? []}
                idValue={interestLevelId}
                otherValue={interestLevelOther}
                onChange={({ id: next, other }) => {
                  setInterestLevelId(next);
                  setInterestLevelOther(other);
                }}
              />
              <DatePicker
                label="Expected Close Date"
                value={expectedCloseDate}
                onChange={setExpectedCloseDate}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <CreatableMasterAutocomplete
                label="Business Type"
                options={businessTypes ?? []}
                idValue={businessTypeId}
                otherValue={businessTypeOther}
                onChange={({ id: next, other }) => {
                  setBusinessTypeId(next);
                  setBusinessTypeOther(other);
                }}
              />
              <TextField
                label="GSTIN"
                fullWidth
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
              />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle1">Products / Services</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow}>
            Add Line
          </Button>
        </Stack>

        <Stack spacing={2}>
          {lineItems.map((row, index) => {
            const t = computeLineTotals(row, interState);
            return (
              <Box key={row.key}>
                {index > 0 && <Divider sx={{ mb: 2 }} />}
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <TextField
                    select
                    label="Type"
                    size="small"
                    value={row.mode}
                    onChange={(e) => handleModeChange(row.key, e.target.value as LineItemMode)}
                    sx={{ minWidth: 130, flexShrink: 0 }}
                  >
                    <MenuItem value="catalog">Catalog product</MenuItem>
                    <MenuItem value="adhoc">Custom item</MenuItem>
                  </TextField>

                  {row.mode === "catalog" ? (
                    <Autocomplete
                      options={products}
                      getOptionLabel={(p) => p.name}
                      value={row.productId ? (productById.get(row.productId) ?? null) : null}
                      onChange={(_, product) => handleProductSelect(row.key, product)}
                      sx={{ flexGrow: 1, minWidth: 180 }}
                      renderInput={(params) => <TextField {...params} label="Product / Service" size="small" />}
                    />
                  ) : (
                    <TextField
                      label="Description"
                      size="small"
                      sx={{ flexGrow: 1, minWidth: 180 }}
                      value={row.description}
                      onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    />
                  )}

                  <TextField
                    label="HSN/SAC"
                    size="small"
                    sx={{ width: 100, flexShrink: 0 }}
                    value={row.hsnSac}
                    disabled={row.mode === "catalog"}
                    onChange={(e) => updateRow(row.key, { hsnSac: e.target.value })}
                  />
                  <TextField
                    label="Qty"
                    size="small"
                    type="number"
                    sx={{ width: 80, flexShrink: 0 }}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <TextField
                    label="Unit"
                    size="small"
                    sx={{ width: 80, flexShrink: 0 }}
                    value={row.unit}
                    onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                  />
                  <TextField
                    label="Unit Price"
                    size="small"
                    type="number"
                    sx={{ width: 110, flexShrink: 0 }}
                    value={row.unitPrice}
                    disabled={row.mode === "catalog"}
                    onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                  />
                  <TextField
                    label="Discount %"
                    size="small"
                    type="number"
                    sx={{ width: 100, flexShrink: 0 }}
                    value={row.discountPercent}
                    onChange={(e) => updateRow(row.key, { discountPercent: e.target.value })}
                  />
                  <TextField
                    label="Tax %"
                    size="small"
                    type="number"
                    sx={{ width: 90, flexShrink: 0 }}
                    value={row.taxRatePercent}
                    disabled={row.mode === "catalog"}
                    onChange={(e) => updateRow(row.key, { taxRatePercent: e.target.value })}
                  />
                  <Typography variant="body2" sx={{ width: 100, flexShrink: 0, pt: 1, textAlign: "right" }}>
                    {t.lineTotal.toFixed(2)}
                  </Typography>
                  <IconButton size="small" onClick={() => removeRow(row.key)} disabled={lineItems.length === 1}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
          <Typography variant="body2">Sub Total: {totals.subtotal.toFixed(2)}</Typography>
          <Typography variant="body2">Discount: {totals.discountTotal.toFixed(2)}</Typography>
          <Typography variant="body2">Taxable Amount: {totals.taxableAmount.toFixed(2)}</Typography>
          {interState ? (
            <Typography variant="body2">IGST: {totals.igstTotal.toFixed(2)}</Typography>
          ) : (
            <>
              <Typography variant="body2">CGST: {totals.cgstTotal.toFixed(2)}</Typography>
              <Typography variant="body2">SGST: {totals.sgstTotal.toFixed(2)}</Typography>
            </>
          )}
          <Typography variant="subtitle1" color="success.main">
            Grand Total: {totals.grandTotal.toFixed(2)}
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Quotation Notes
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              value={quotationNotes}
              onChange={(e) => setQuotationNotes(e.target.value)}
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Terms &amp; Conditions
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
            />
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Next Follow Up
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              <DatePicker
                label="Follow Up Date"
                value={followUpDate}
                onChange={setFollowUpDate}
                slotProps={{ textField: { sx: { minWidth: 180 } } }}
              />
              <TimePicker
                label="Follow Up Time"
                value={followUpTime}
                onChange={setFollowUpTime}
                slotProps={{ textField: { sx: { minWidth: 150 } } }}
              />
              <Autocomplete
                options={employeesPage?.content ?? []}
                getOptionLabel={(e) => e.fullName}
                value={employeesPage?.content.find((e) => e.id === followUpByEmployeeId) ?? null}
                onChange={(_, employee) => setFollowUpByEmployeeId(employee?.id ?? null)}
                sx={{ minWidth: 200 }}
                renderInput={(params) => <TextField {...params} label="Follow Up By" />}
              />
            </Stack>
            <TextField
              label="Follow Up Note"
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Internal Note
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              Only visible to admin &amp; team
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </Paper>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button onClick={() => navigate("/app/quotations")} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="outlined" onClick={() => handleSubmit("DRAFT")} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Draft"}
        </Button>
        <Button variant="contained" color="success" onClick={() => handleSubmit("SENT")} disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send Quotation"}
        </Button>
      </Stack>
    </Box>
  );
}
