import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";

export interface BillingProfile {
  businessName: string;
  billingAddress: string | null;
  billingGstin: string | null;
  /** Supplier's home state (STATE master-data id) - drives CGST+SGST vs IGST. */
  billingStateId: string | null;
  billingPhone: string | null;
  hasLogo: boolean;
  invoiceHeaderText: string | null;
  invoiceFooterText: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  upiId: string | null;
}

export interface UpdateBillingProfilePayload {
  billingAddress?: string;
  billingGstin?: string;
  billingStateId?: string;
  billingPhone?: string;
  invoiceHeaderText?: string;
  invoiceFooterText?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
}

export const BILLING_PROFILE_QUERY_KEY = ["billingProfile"];

export async function getBillingProfile(): Promise<BillingProfile> {
  const response = await axiosInstance.get<BillingProfile>("/organizations/me/billing-profile");
  return response.data;
}

export async function updateBillingProfile(
  payload: UpdateBillingProfilePayload,
): Promise<BillingProfile> {
  const response = await axiosInstance.put<BillingProfile>(
    "/organizations/me/billing-profile",
    payload,
  );
  return response.data;
}

/** Fetched as a blob (not a plain <img src>) because the endpoint requires the same bearer
 * auth as every other API call, which a plain <img> tag can't attach - same technique
 * invoicesApi.ts's downloadInvoicePdf already uses for PDF downloads. */
export async function getLogoBlobUrl(): Promise<string | null> {
  try {
    const response = await axiosInstance.get("/organizations/me/logo", { responseType: "blob" });
    return URL.createObjectURL(response.data as Blob);
  } catch {
    return null;
  }
}

export async function uploadLogo(file: File): Promise<BillingProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.put<BillingProfile>("/organizations/me/logo", formData);
  return response.data;
}

export async function deleteLogo(): Promise<BillingProfile> {
  const response = await axiosInstance.delete<BillingProfile>("/organizations/me/logo");
  return response.data;
}

export function useBillingProfile(enabled: boolean) {
  return useQuery({
    queryKey: BILLING_PROFILE_QUERY_KEY,
    queryFn: getBillingProfile,
    enabled,
  });
}

export function useUpdateBillingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBillingProfilePayload) => updateBillingProfile(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(BILLING_PROFILE_QUERY_KEY, saved);
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadLogo(file),
    onSuccess: (saved) => {
      queryClient.setQueryData(BILLING_PROFILE_QUERY_KEY, saved);
    },
  });
}

export function useDeleteLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteLogo(),
    onSuccess: (saved) => {
      queryClient.setQueryData(BILLING_PROFILE_QUERY_KEY, saved);
    },
  });
}
