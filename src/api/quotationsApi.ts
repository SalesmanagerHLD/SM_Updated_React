import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";
import type { Invoice } from "./invoicesApi";

export type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED";
export type VisitTypeValue = "FIELD" | "TELEPHONIC";

export interface QuotationLineItem {
  id: string;
  productId: string | null;
  hsnSac: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTaxableAmount: number;
  lineCgstAmount: number;
  lineSgstAmount: number;
  lineIgstAmount?: number;
  lineTotal: number;
  sortOrder: number;
}

export interface Quotation {
  id: string;
  organizationId: string;
  quotationNumber: string;
  leadId: string | null;
  customerId: string;
  customerName: string;
  customerContactPerson: string | null;
  customerDesignation: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerBillingAddress: string | null;
  customerGstin: string | null;
  industryId: string | null;
  industryOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  stateId: string | null;
  stateOther: string | null;
  interestLevelId: string | null;
  interestLevelOther: string | null;
  businessTypeId: string | null;
  businessTypeOther: string | null;
  ownerId: string;
  typeOfVisit: VisitTypeValue | null;
  quotationDate: string;
  validTillDate: string | null;
  referenceEnquiryNo: string | null;
  expectedCloseDate: string | null;
  quotationNotes: string | null;
  termsAndConditions: string | null;
  internalNote: string | null;
  followUpDate: string | null;
  followUpTime: string | null;
  followUpByEmployeeId: string | null;
  followUpNote: string | null;
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal?: number;
  grandTotal: number;
  status: QuotationStatus;
  convertedInvoiceId: string | null;
  lineItems: QuotationLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GetQuotationsParams {
  status?: QuotationStatus;
  ownerId?: string;
  customerId?: string;
  cityId?: string;
  stateId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  size?: number;
}

/** Exactly one of productId or description+unitPrice must be set - see backend
 * QuotationService's line-item validation. */
export interface QuotationLineItemPayload {
  productId?: string;
  hsnSac?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  discountPercent?: number;
  taxRatePercent?: number;
}

export interface QuotationPayload {
  leadId?: string;
  customerId: string;
  customerContactPerson?: string;
  customerDesignation?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerBillingAddress?: string;
  customerGstin?: string;
  industryId?: string | null;
  industryOther?: string;
  cityId?: string | null;
  cityOther?: string;
  stateId?: string | null;
  stateOther?: string;
  interestLevelId?: string | null;
  interestLevelOther?: string;
  businessTypeId?: string | null;
  businessTypeOther?: string;
  typeOfVisit?: VisitTypeValue | null;
  quotationDate: string;
  validTillDate?: string;
  referenceEnquiryNo?: string;
  expectedCloseDate?: string;
  quotationNotes?: string;
  termsAndConditions?: string;
  internalNote?: string;
  followUpDate?: string;
  followUpTime?: string;
  followUpByEmployeeId?: string;
  followUpNote?: string;
  lineItems: QuotationLineItemPayload[];
  status: "DRAFT" | "SENT";
}

export async function getQuotations(
  params: GetQuotationsParams = {},
): Promise<PagedResponse<Quotation>> {
  const response = await axiosInstance.get<PagedResponse<Quotation>>("/quotations", { params });
  return response.data;
}

export async function getQuotation(id: string): Promise<Quotation> {
  const response = await axiosInstance.get<Quotation>(`/quotations/${id}`);
  return response.data;
}

export async function createQuotation(payload: QuotationPayload): Promise<Quotation> {
  const response = await axiosInstance.post<Quotation>("/quotations", payload);
  return response.data;
}

export async function updateQuotation(id: string, payload: QuotationPayload): Promise<Quotation> {
  const response = await axiosInstance.put<Quotation>(`/quotations/${id}`, payload);
  return response.data;
}

export async function updateQuotationStatus(
  id: string,
  status: "APPROVED" | "REJECTED",
): Promise<Quotation> {
  const response = await axiosInstance.patch<Quotation>(`/quotations/${id}/status`, { status });
  return response.data;
}

export async function convertQuotationToInvoice(id: string): Promise<Invoice> {
  const response = await axiosInstance.post<Invoice>(`/quotations/${id}/convert-to-invoice`);
  return response.data;
}

/** Same blob-URL technique invoicesApi.ts's downloadInvoicePdf already uses. */
export async function downloadQuotationPdf(id: string, quotationNumber: string): Promise<void> {
  const response = await axiosInstance.get(`/quotations/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${quotationNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function previewQuotationPdf(id: string, previewWindow: Window | null): Promise<void> {
  const response = await axiosInstance.get(`/quotations/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  if (previewWindow) {
    previewWindow.location.href = url;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface QuotationAttachment {
  id: string;
  quotationId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

export async function getQuotationAttachments(quotationId: string): Promise<QuotationAttachment[]> {
  const response = await axiosInstance.get<QuotationAttachment[]>(`/quotations/${quotationId}/attachments`);
  return response.data;
}

export async function uploadQuotationAttachment(
  quotationId: string,
  file: File,
): Promise<QuotationAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.post<QuotationAttachment>(
    `/quotations/${quotationId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function deleteQuotationAttachment(attachmentId: string): Promise<void> {
  await axiosInstance.delete(`/quotations/attachments/${attachmentId}`);
}

export function useQuotations(params: GetQuotationsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["quotations", params],
    queryFn: () => getQuotations(params),
    enabled: options?.enabled ?? true,
  });
}

export function useQuotation(id: string | null | undefined) {
  return useQuery({
    queryKey: ["quotations", "detail", id],
    queryFn: () => getQuotation(id as string),
    enabled: !!id,
  });
}

export function useQuotationAttachments(quotationId: string | null | undefined) {
  return useQuery({
    queryKey: ["quotations", "attachments", quotationId],
    queryFn: () => getQuotationAttachments(quotationId as string),
    enabled: !!quotationId,
  });
}

function useInvalidateQuotations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["quotations"] });
}

export function useCreateQuotation() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: (payload: QuotationPayload) => createQuotation(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateQuotation() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QuotationPayload }) => updateQuotation(id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateQuotationStatus() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) =>
      updateQuotationStatus(id, status),
    onSuccess: () => invalidate(),
  });
}

export function useConvertQuotationToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => convertQuotationToInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUploadQuotationAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, file }: { quotationId: string; file: File }) =>
      uploadQuotationAttachment(quotationId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "attachments", variables.quotationId] });
    },
  });
}

export function useDeleteQuotationAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId }: { attachmentId: string; quotationId: string }) =>
      deleteQuotationAttachment(attachmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "attachments", variables.quotationId] });
    },
  });
}
