import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";

export type InvoiceStatus = "UNPAID" | "PAID";

export interface InvoiceLineItem {
  id: string;
  productId: string | null;
  hsnSac: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTaxableAmount?: number;
  lineTaxAmount: number;
  lineCgstAmount: number;
  lineSgstAmount: number;
  lineIgstAmount?: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  leadId: string | null;
  ownerId: string;
  createdBy: string;
  customerName: string;
  customerContactPerson: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerGstin: string | null;
  shipToName: string | null;
  shipToAddress: string | null;
  shipToGstin: string | null;
  invoiceDate: string;
  dueDate: string | null;
  placeOfSupply: string | null;
  placeOfSupplyStateId?: string | null;
  reverseCharge: boolean;
  quotationId: string | null;
  subtotal: number;
  discountTotal?: number;
  taxableAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  taxTotal: number;
  roundOff?: number;
  grandTotal: number;
  status: InvoiceStatus;
  notes: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GetInvoicesParams {
  status?: InvoiceStatus;
  ownerId?: string;
  page?: number;
  size?: number;
}

/** Exactly one of productId or description+unitPrice must be set - see backend
 * InvoiceService's line-item validation. */
export interface InvoiceLineItemPayload {
  productId?: string;
  hsnSac?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
  taxRatePercent?: number;
}

export interface CreateInvoicePayload {
  leadId?: string;
  customerName: string;
  customerContactPerson?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  invoiceDate: string;
  dueDate?: string;
  placeOfSupply?: string;
  /** STATE master-data id; compared with the billing profile's stateId to pick IGST vs CGST+SGST. */
  placeOfSupplyStateId?: string;
  reverseCharge?: boolean;
  lineItems: InvoiceLineItemPayload[];
  notes?: string;
}

export async function getInvoices(
  params: GetInvoicesParams = {},
): Promise<PagedResponse<Invoice>> {
  const response = await axiosInstance.get<PagedResponse<Invoice>>("/invoices", {
    params,
  });
  return response.data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const response = await axiosInstance.get<Invoice>(`/invoices/${id}`);
  return response.data;
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const response = await axiosInstance.post<Invoice>("/invoices", payload);
  return response.data;
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<Invoice> {
  const response = await axiosInstance.patch<Invoice>(`/invoices/${id}/status`, { status });
  return response.data;
}

/** Downloads and triggers a save-as for the invoice PDF - same blob-URL technique
 * utils/exportToCsv.ts already uses for CSV downloads. */
export async function downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const response = await axiosInstance.get(`/invoices/${id}/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens the invoice PDF inline in a new tab (the browser's own PDF viewer) instead of forcing
 * a download - lets the user review it before deciding to download/print. The endpoint itself
 * is identical to downloadInvoicePdf's (same bytes); only what the frontend does with the blob
 * differs (window.open vs. an anchor's download attribute).
 *
 * previewWindow must be opened SYNCHRONOUSLY by the caller's click handler, before this async
 * function's first await - opening a new window only counts as "opened by user gesture" while
 * still inside that synchronous call stack, otherwise most browsers block it as a popup. This
 * function then points that already-open (blank) tab at the fetched PDF once ready.
 */
export async function previewInvoicePdf(id: string, previewWindow: Window | null): Promise<void> {
  const response = await axiosInstance.get(`/invoices/${id}/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  if (previewWindow) {
    previewWindow.location.href = url;
  }
  // Revoked well after the tab has had time to load the PDF from the blob URL - not
  // immediately (the new tab still needs it) and not never (would leak memory indefinitely
  // across many previews in one session).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useInvoices(params: GetInvoicesParams = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => getInvoices(params),
  });
}

export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => getInvoice(id as string),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      // A catalog line deducts stock - the Products list should reflect it immediately.
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      updateInvoiceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
