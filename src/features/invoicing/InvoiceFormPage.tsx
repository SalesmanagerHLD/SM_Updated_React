import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
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
import { getProductBySku, useProducts } from "../../api/productsApi";
import type { Product } from "../../api/productsApi";
import type { CreateInvoicePayload, InvoiceLineItemPayload } from "../../api/invoicesApi";
import { useCreateInvoice } from "../../api/invoicesApi";
import { parseApiError } from "../../api/errorHelpers";
import { BarcodeScanField } from "../../components/BarcodeScanField";
import { useBillingProfile } from "../../api/billingProfileApi";
import { useMasterData } from "../../api/masterDataApi";
import { isInterState, roundToRupee, splitTax } from "../../utils/gst";

type LineItemMode = "catalog" | "adhoc";

interface LineItemRow {
  key: string;
  mode: LineItemMode;
  productId: string | null;
  hsnSac: string;
  description: string;
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
  return {
    lineSubtotal,
    lineDiscount,
    lineTaxable,
    cgst,
    sgst,
    igst,
    lineTotal: lineTaxable + cgst + sgst + igst,
  };
}

/**
 * Full page (not a dialog) given the dynamic line-items complexity. Deliberately plain
 * useState rather than react-hook-form for the line items array - a heterogeneous,
 * dynamically-shaped (catalog vs ad-hoc) repeatable structure doesn't fit RHF's typical
 * static-schema pattern cleanly, and this is a "lightweight v1" feature. Top-level fields are
 * plain controlled inputs too, for the same reason (one form, one style, not a mix).
 */
export function InvoiceFormPage() {
  const navigate = useNavigate();
  const createMutation = useCreateInvoice();

  const { data: leadsPage } = useLeads({ size: 200 });
  const { data: productsPage } = useProducts({ includeInactive: false, size: 200 });
  const products = useMemo(() => productsPage?.content ?? [], [productsPage]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerContactPerson, setCustomerContactPerson] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [shipToSameAsBilling, setShipToSameAsBilling] = useState(true);
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGstin, setShipToGstin] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<Dayjs | null>(dayjs());
  const [dueDate, setDueDate] = useState<Dayjs | null>(dayjs().add(15, "day"));
  const [placeOfSupplyStateId, setPlaceOfSupplyStateId] = useState<string | null>(null);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyRow()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const { data: states } = useMasterData("STATE");
  const { data: billingProfile } = useBillingProfile(true);
  const interState = isInterState(billingProfile?.billingStateId, placeOfSupplyStateId);
  const placeOfSupplyState = useMemo(
    () => (states ?? []).find((s) => s.id === placeOfSupplyStateId) ?? null,
    [states, placeOfSupplyStateId],
  );

  const handleLeadChange = (lead: Lead | null) => {
    setSelectedLead(lead);
    if (lead) {
      if (lead.stateId) setPlaceOfSupplyStateId(lead.stateId);
      setCustomerName(lead.companyName);
      setCustomerContactPerson(lead.contactPerson ?? "");
      setCustomerPhone(lead.contactNo ?? "");
      setCustomerEmail(lead.email ?? "");
      setCustomerAddress(lead.address ?? "");
    }
  };

  const updateRow = (key: string, patch: Partial<LineItemRow>) => {
    setLineItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleProductSelect = (key: string, product: Product | null) => {
    if (!product) {
      updateRow(key, { productId: null, description: "", unitPrice: "0", taxRatePercent: "0", hsnSac: "" });
      return;
    }
    updateRow(key, {
      productId: product.id,
      description: product.name,
      unitPrice: String(product.unitPrice),
      taxRatePercent: String(product.taxRatePercent),
      hsnSac: product.hsnSacCode ?? "",
    });
  };

  const handleModeChange = (key: string, mode: LineItemMode) => {
    updateRow(key, {
      mode,
      productId: null,
      description: "",
      unitPrice: "0",
      taxRatePercent: "0",
      hsnSac: "",
    });
  };

  const addRow = () => setLineItems((rows) => [...rows, emptyRow()]);
  const removeRow = (key: string) =>
    setLineItems((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));

  /** Handles both an external keyboard-wedge barcode scanner and a manually typed SKU + Enter
   * (see BarcodeScanField) - scanning the same SKU again just bumps that line's quantity
   * rather than adding a duplicate row; a first scan reuses the still-empty starting catalog
   * row instead of appending alongside it. */
  const handleScan = async (sku: string) => {
    setScanError(null);
    setScanning(true);
    try {
      const product = await getProductBySku(sku);
      setLineItems((rows) => {
        const existingIndex = rows.findIndex((row) => row.mode === "catalog" && row.productId === product.id);
        if (existingIndex >= 0) {
          return rows.map((row, index) =>
            index === existingIndex
              ? { ...row, quantity: String((Number(row.quantity) || 0) + 1) }
              : row,
          );
        }
        const newRow: LineItemRow = {
          key: crypto.randomUUID(),
          mode: "catalog",
          productId: product.id,
          hsnSac: product.hsnSacCode ?? "",
          description: product.name,
          quantity: "1",
          unitPrice: String(product.unitPrice),
          discountPercent: "0",
          taxRatePercent: String(product.taxRatePercent),
        };
        const emptyIndex = rows.findIndex((row) => row.mode === "catalog" && !row.productId);
        if (emptyIndex >= 0) {
          return rows.map((row, index) => (index === emptyIndex ? { ...newRow, key: row.key } : row));
        }
        return [...rows, newRow];
      });
    } catch (err) {
      setScanError(parseApiError(err).message);
    } finally {
      setScanning(false);
    }
  };

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
    const { rounded, roundOff } = roundToRupee(taxableAmount + cgstTotal + sgstTotal + igstTotal);
    return {
      subtotal,
      discountTotal,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundOff,
      grandTotal: rounded,
    };
  }, [lineItems, interState]);

  const handleSubmit = async () => {
    setFormError(null);

    if (!customerName.trim()) {
      setFormError("Customer name is required");
      return;
    }
    if (!invoiceDate) {
      setFormError("Invoice date is required");
      return;
    }
    for (const row of lineItems) {
      if (row.mode === "catalog" && !row.productId) {
        setFormError("Every catalog line must have a product selected");
        return;
      }
      if (row.mode === "adhoc" && !row.description.trim()) {
        setFormError("Every custom line must have a description");
        return;
      }
      if (!(Number(row.quantity) > 0)) {
        setFormError("Every line's quantity must be greater than zero");
        return;
      }
    }

    const payloadLineItems: InvoiceLineItemPayload[] = lineItems.map((row) => {
      const discountPercent = Number(row.discountPercent) || 0;
      if (row.mode === "catalog") {
        return { productId: row.productId as string, quantity: Number(row.quantity), discountPercent };
      }
      return {
        hsnSac: row.hsnSac.trim() || undefined,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice) || 0,
        discountPercent,
        taxRatePercent: Number(row.taxRatePercent) || 0,
      };
    });

    const payload: CreateInvoicePayload = {
      leadId: selectedLead?.id,
      customerName: customerName.trim(),
      customerContactPerson: customerContactPerson.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerGstin: customerGstin.trim() || undefined,
      shipToName: shipToSameAsBilling ? undefined : shipToName.trim() || undefined,
      shipToAddress: shipToSameAsBilling ? undefined : shipToAddress.trim() || undefined,
      shipToGstin: shipToSameAsBilling ? undefined : shipToGstin.trim() || undefined,
      invoiceDate: invoiceDate.format("YYYY-MM-DD"),
      dueDate: dueDate ? dueDate.format("YYYY-MM-DD") : undefined,
      placeOfSupply: placeOfSupplyState?.label,
      placeOfSupplyStateId: placeOfSupplyStateId ?? undefined,
      reverseCharge,
      lineItems: payloadLineItems,
      notes: notes.trim() || undefined,
    };

    try {
      const invoice = await createMutation.mutateAsync(payload);
      navigate(`/app/invoices/${invoice.id}`);
    } catch (error) {
      setFormError(parseApiError(error).message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        New Invoice
      </Typography>

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Customer
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            options={leadsPage?.content ?? []}
            getOptionLabel={(lead) => `${lead.companyName} (${lead.contactPerson})`}
            value={selectedLead}
            onChange={(_, lead) => handleLeadChange(lead)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Link an existing Lead (optional)"
                helperText="Prefills the fields below - still editable, and the invoice keeps its own copy from this point on"
              />
            )}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Customer name"
              fullWidth
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <TextField
              label="Contact person"
              fullWidth
              value={customerContactPerson}
              onChange={(e) => setCustomerContactPerson(e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
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
          </Stack>
          <TextField
            label="Address"
            fullWidth
            multiline
            minRows={2}
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="GSTIN (optional)"
              fullWidth
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value)}
            />
            <DatePicker
              label="Invoice date"
              value={invoiceDate}
              onChange={setInvoiceDate}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <DatePicker
              label="Due date"
              value={dueDate}
              onChange={setDueDate}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <Autocomplete
              fullWidth
              options={states ?? []}
              getOptionLabel={(s) => s.label}
              value={placeOfSupplyState}
              onChange={(_, s) => setPlaceOfSupplyStateId(s?.id ?? null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Place of supply (state)"
                  helperText={
                    !billingProfile?.billingStateId
                      ? "Set your business state in Settings to enable IGST."
                      : interState
                        ? "Inter-state sale - IGST will be charged."
                        : "Same state - CGST + SGST will be charged."
                  }
                />
              )}
            />
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} />}
            label="Reverse charge applicable"
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Ship To
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={shipToSameAsBilling}
              onChange={(e) => setShipToSameAsBilling(e.target.checked)}
            />
          }
          label="Same as billing address"
        />
        {!shipToSameAsBilling && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Ship-to name" fullWidth value={shipToName} onChange={(e) => setShipToName(e.target.value)} />
            <TextField
              label="Ship-to address"
              fullWidth
              multiline
              minRows={2}
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
            />
            <TextField label="Ship-to GSTIN" fullWidth value={shipToGstin} onChange={(e) => setShipToGstin(e.target.value)} />
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle1">Line Items</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow}>
            Add Line
          </Button>
        </Stack>

        <Box sx={{ mb: 2, maxWidth: 360 }}>
          <BarcodeScanField
            label="Scan barcode to add a product"
            disabled={scanning}
            onScan={handleScan}
          />
        </Box>
        {scanError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setScanError(null)}>
            {scanError}
          </Alert>
        )}

        <Stack spacing={2}>
          {lineItems.map((row, index) => {
            const { lineTotal } = computeLineTotals(row, interState);
            return (
              <Box key={row.key}>
                {index > 0 && <Divider sx={{ mb: 2 }} />}
                <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                  <TextField
                    select
                    label="Type"
                    size="small"
                    value={row.mode}
                    onChange={(e) => handleModeChange(row.key, e.target.value as LineItemMode)}
                    sx={{ minWidth: 140, flexShrink: 0 }}
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
                      sx={{ flexGrow: 1 }}
                      renderInput={(params) => <TextField {...params} label="Product" size="small" />}
                    />
                  ) : (
                    <TextField
                      label="Description"
                      size="small"
                      fullWidth
                      value={row.description}
                      onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    />
                  )}

                  <TextField
                    label="Qty"
                    size="small"
                    type="number"
                    sx={{ width: 100, flexShrink: 0 }}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <TextField
                    label="HSN/SAC"
                    size="small"
                    sx={{ width: 100, flexShrink: 0 }}
                    value={row.hsnSac}
                    disabled={row.mode === "catalog"}
                    onChange={(e) => updateRow(row.key, { hsnSac: e.target.value })}
                  />
                  <TextField
                    label="Unit price"
                    size="small"
                    type="number"
                    sx={{ width: 120, flexShrink: 0 }}
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
                    {lineTotal.toFixed(2)}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => removeRow(row.key)}
                    disabled={lineItems.length === 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
          <Typography variant="body2">Subtotal: {totals.subtotal.toFixed(2)}</Typography>
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
          <Typography variant="body2">Round off: {totals.roundOff.toFixed(2)}</Typography>
          <Typography variant="subtitle1">Grand Total: {totals.grandTotal.toFixed(2)}</Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <TextField
          label="Notes (optional)"
          fullWidth
          multiline
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Paper>

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button onClick={() => navigate("/app/invoices")} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </Stack>
    </Box>
  );
}
