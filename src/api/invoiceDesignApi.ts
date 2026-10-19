import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";

export type DesignPreset = "CLASSIC" | "BAND" | "COMPACT";
export type DesignPageSize = "A4" | "A5" | "LETTER";
export type DesignMargin = "NARROW" | "NORMAL" | "WIDE";
export type DesignFontFamily = "SANS" | "SERIF" | "MONO";
export type DesignTextSize = "SMALL" | "MEDIUM" | "LARGE";
export type DesignLogoSize = "SMALL" | "MEDIUM" | "LARGE";
export type DesignLogoAlign = "LEFT" | "CENTER" | "RIGHT";

/** Mirrors the backend's InvoiceDesignSettings record - a closed set of enums, booleans, one hex
 * colour and short text. There is deliberately no free-form HTML/CSS. GST-required content is not
 * represented here, so no design can switch it off. */
export interface InvoiceDesignSettings {
  preset: DesignPreset;
  pageSize: DesignPageSize;
  margin: DesignMargin;
  accentColor: string;
  fontFamily: DesignFontFamily;
  textSize: DesignTextSize;
  showLogo: boolean;
  logoSize: DesignLogoSize;
  logoAlign: DesignLogoAlign;
  showSellerPhone: boolean;
  showPaidBalance: boolean;
  showAmountInWords: boolean;
  showBankDetails: boolean;
  termsAndConditions: string;
  billToLabel: string;
  shipToLabel: string;
}

export interface InvoiceDesign {
  settings: InvoiceDesignSettings;
  version: number;
  isDefault: boolean;
}

export const INVOICE_DESIGN_QUERY_KEY = ["invoiceDesign"];

export async function getInvoiceDesign(): Promise<InvoiceDesign> {
  const response = await axiosInstance.get<InvoiceDesign>("/organizations/me/invoice-design");
  return response.data;
}

export async function saveInvoiceDesign(settings: InvoiceDesignSettings): Promise<InvoiceDesign> {
  const response = await axiosInstance.put<InvoiceDesign>("/organizations/me/invoice-design", settings);
  return response.data;
}

export async function resetInvoiceDesign(): Promise<InvoiceDesign> {
  const response = await axiosInstance.delete<InvoiceDesign>("/organizations/me/invoice-design");
  return response.data;
}

/** Renders UNSAVED settings to a real PDF on the server (same engine as the issued invoice) and
 * returns an object URL for it. The caller owns the URL and must revoke it. */
export async function previewInvoiceDesign(
  settings: InvoiceDesignSettings,
  signal?: AbortSignal,
): Promise<string> {
  const response = await axiosInstance.post(
    "/organizations/me/invoice-design/preview",
    { settings },
    { responseType: "blob", signal },
  );
  return URL.createObjectURL(response.data as Blob);
}

export function useInvoiceDesign(enabled: boolean) {
  return useQuery({
    queryKey: INVOICE_DESIGN_QUERY_KEY,
    queryFn: getInvoiceDesign,
    enabled,
  });
}

export function useSaveInvoiceDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: InvoiceDesignSettings) => saveInvoiceDesign(settings),
    onSuccess: (saved) => queryClient.setQueryData(INVOICE_DESIGN_QUERY_KEY, saved),
  });
}

export function useResetInvoiceDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetInvoiceDesign(),
    onSuccess: (saved) => queryClient.setQueryData(INVOICE_DESIGN_QUERY_KEY, saved),
  });
}
