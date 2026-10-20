import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";
import type { InvoiceStatus } from "./invoicesApi";
import type { LeadAttachment } from "./attachmentsApi";

export type PurchaseOrderStatus =
  | "RECEIVED"
  | "ACCEPTED"
  | "PARTLY_BILLED"
  | "FULLY_BILLED"
  | "CANCELLED";

export interface PurchaseOrderLine {
  id: string;
  productId: string | null;
  quotationLineId: string | null;
  description: string;
  hsnSac: string | null;
  unit: string | null;
  quantityOrdered: number;
  quantityBilled: number;
  quantityRemaining: number;
  rate: number;
  taxRatePercent: number;
  lineTaxableAmount: number;
  lineTaxAmount: number;
  lineTotal: number;
  /** Net rate on the linked quotation line, or null when there is none. */
  quotationRate: number | null;
  priceDiffersFromQuotation: boolean;
}

export interface PurchaseOrderInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  grandTotal: number;
  poOverrideReason: string | null;
}

export interface PurchaseOrder {
  id: string;
  leadId: string;
  quotationId: string | null;
  customerId: string | null;
  ownerId: string;
  poNumber: string;
  poDate: string;
  deliveryDate: string | null;
  paymentTermsDays: number | null;
  status: PurchaseOrderStatus;
  customerName: string;
  customerGstin: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  placeOfSupplyStateId: string | null;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  hasPriceDifference: boolean;
  lineItems: PurchaseOrderLine[];
  /** Only filled on the detail endpoint. */
  invoices: PurchaseOrderInvoice[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLinePayload {
  productId?: string | null;
  quotationLineId?: string | null;
  description: string;
  hsnSac?: string;
  unit?: string;
  quantity: number;
  rate: number;
  taxRatePercent: number;
}

export interface PurchaseOrderPayload {
  leadId: string;
  quotationId?: string | null;
  customerId?: string | null;
  poNumber: string;
  poDate: string;
  deliveryDate?: string | null;
  paymentTermsDays?: number | null;
  customerName?: string;
  customerGstin?: string;
  billingAddress?: string;
  shippingAddress?: string;
  placeOfSupplyStateId?: string | null;
  notes?: string;
  /** Omit on update to change only the header (required once the PO has been invoiced). */
  lineItems?: PurchaseOrderLinePayload[];
}

export interface GetPurchaseOrdersParams {
  leadId?: string;
  status?: PurchaseOrderStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  size?: number;
}

/** A pre-filled, UNSAVED invoice body for the PO's remaining quantities. */
export interface PurchaseOrderInvoiceDraft {
  leadId: string;
  customerId: string | null;
  placeOfSupplyStateId: string | null;
  customerName: string;
  customerAddress: string | null;
  customerGstin: string | null;
  shipToName: string | null;
  shipToAddress: string | null;
  invoiceDate: string;
  dueDate: string | null;
  poId: string;
  poNumber: string;
  poDate: string;
  notes: string | null;
  lineItems: {
    poLineId: string;
    productId: string | null;
    description: string;
    hsnSac: string | null;
    unit: string | null;
    quantity: number;
    unitPrice: number;
    taxRatePercent: number;
  }[];
}

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  RECEIVED: "Received",
  ACCEPTED: "Accepted",
  PARTLY_BILLED: "Partly billed",
  FULLY_BILLED: "Fully billed",
  CANCELLED: "Cancelled",
};

export const PO_STATUS_COLORS: Record<
  PurchaseOrderStatus,
  "default" | "info" | "warning" | "success" | "error"
> = {
  RECEIVED: "default",
  ACCEPTED: "info",
  PARTLY_BILLED: "warning",
  FULLY_BILLED: "success",
  CANCELLED: "error",
};

export async function getPurchaseOrders(
  params: GetPurchaseOrdersParams = {},
): Promise<PagedResponse<PurchaseOrder>> {
  const response = await axiosInstance.get<PagedResponse<PurchaseOrder>>("/purchase-orders", { params });
  return response.data;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await axiosInstance.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return response.data;
}

export async function prefillPurchaseOrderFromQuotation(quotationId: string): Promise<PurchaseOrderPayload> {
  const response = await axiosInstance.get<PurchaseOrderPayload>("/purchase-orders/prefill", {
    params: { quotationId },
  });
  return response.data;
}

export async function getPurchaseOrderInvoiceDraft(id: string): Promise<PurchaseOrderInvoiceDraft> {
  const response = await axiosInstance.post<PurchaseOrderInvoiceDraft>(`/purchase-orders/${id}/invoice`);
  return response.data;
}

export async function getPurchaseOrderAttachments(id: string): Promise<(LeadAttachment & { poId: string | null })[]> {
  const response = await axiosInstance.get<(LeadAttachment & { poId: string | null })[]>(
    `/purchase-orders/${id}/attachments`,
  );
  return response.data;
}

export async function uploadPurchaseOrderAttachment(id: string, file: File): Promise<LeadAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.post<LeadAttachment>(`/purchase-orders/${id}/attachments`, formData);
  return response.data;
}

export function usePurchaseOrders(
  params: GetPurchaseOrdersParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["purchaseOrders", params],
    queryFn: () => getPurchaseOrders(params),
    enabled: options?.enabled ?? true,
  });
}

export function usePurchaseOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: ["purchaseOrders", "detail", id],
    queryFn: () => getPurchaseOrder(id as string),
    enabled: !!id,
  });
}

export function usePurchaseOrderAttachments(id: string | null | undefined) {
  return useQuery({
    queryKey: ["purchaseOrders", "attachments", id],
    queryFn: () => getPurchaseOrderAttachments(id as string),
    enabled: !!id,
  });
}

function useInvalidatePurchaseOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
}

export function useCreatePurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, file }: { payload: PurchaseOrderPayload; file?: File | null }) => {
      const response = await axiosInstance.post<PurchaseOrder>("/purchase-orders", payload);
      const po = response.data;
      let uploadFailed = false;
      if (file) {
        try {
          await uploadPurchaseOrderAttachment(po.id, file);
        } catch {
          // The PO itself is saved; the caller is told the scan didn't upload.
          uploadFailed = true;
        }
      }
      return { po, uploadFailed };
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["leadAttachments"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload, file }: { id: string; payload: PurchaseOrderPayload; file?: File | null }) => {
      const response = await axiosInstance.put<PurchaseOrder>(`/purchase-orders/${id}`, payload);
      let uploadFailed = false;
      if (file) {
        try {
          await uploadPurchaseOrderAttachment(id, file);
        } catch {
          uploadFailed = true;
        }
      }
      return { po: response.data, uploadFailed };
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["leadAttachments"] });
    },
  });
}

export function useAcceptPurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await axiosInstance.post<PurchaseOrder>(`/purchase-orders/${id}/accept`)).data,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await axiosInstance.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason })).data,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useUploadPurchaseOrderAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadPurchaseOrderAttachment(id, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders", "attachments", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["leadAttachments"] });
    },
  });
}
