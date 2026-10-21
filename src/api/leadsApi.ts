import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATION"
  | "INTERESTED"
  | "LOST"
  | "CLOSED_WON"
  | "LAPSED";

export const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "NEGOTIATION",
  "INTERESTED",
  "LOST",
  "CLOSED_WON",
  "LAPSED",
];

export interface Lead {
  id: string;
  organizationId: string;
  companyName: string;
  industryId: string | null;
  industryOther: string | null;
  businessTypeId: string | null;
  businessTypeOther: string | null;
  leadSourceId: string | null;
  leadSourceOther: string | null;
  turnover: number | null;
  contactPerson: string;
  designationId: string | null;
  designationOther: string | null;
  contactNo: string;
  email: string | null;
  stateId: string | null;
  stateOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  address: string | null;
  requirements: string | null;
  productIds: string[];
  productsOther: string | null;
  interestLevelId: string | null;
  /** Why the lead has this interest level (INTEREST_REASON master ids under interestLevelId). */
  interestReasonIds: string[];
  interestLevelOther: string | null;
  currentProductSolution: string | null;
  budgetRange: string | null;
  decisionMakerIdentified: boolean | null;
  objections: string | null;
  remarks: string | null;
  nextFollowupDate: string | null;
  expectedCloseDate: string | null;
  lostReasonId: string | null;
  lostReasonOther: string | null;
  status: LeadStatus;
  ownerId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetLeadsParams {
  status?: LeadStatus;
  ownerId?: string;
  interestLevelId?: string;
  /** Case-insensitive substring match against company/contact/phone/email, server-side -
   * unlike LeadListPage's own toolbar search (client-side, over just the loaded page), this
   * is a real query param so the "find an existing lead to log a visit against" picker can
   * reliably find a match regardless of how many leads exist. */
  search?: string;
  /** Reports section's filterable Leads table - stateId/cityId/productId/dateFrom/dateTo.
   * dateFrom/dateTo filter on the lead's createdAt (see LeadSpecifications#createdBetween on
   * the backend). */
  stateId?: string;
  cityId?: string;
  productId?: string;
  interestReasonId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/** Fields shared by create and update requests. */
export interface LeadPayloadFields {
  companyName?: string;
  contactPerson?: string;
  contactNo?: string;
  stateId?: string;
  stateOther?: string;
  cityId?: string;
  cityOther?: string;
  leadSourceId?: string;
  leadSourceOther?: string;
  industryId?: string;
  industryOther?: string;
  businessTypeId?: string;
  businessTypeOther?: string;
  turnover?: number;
  designationId?: string;
  designationOther?: string;
  email?: string;
  address?: string;
  requirements?: string;
  productIds?: string[];
  productsOther?: string;
  interestLevelId?: string;
  /** null/omitted = unchanged on update; [] clears. */
  interestReasonIds?: string[];
  interestLevelOther?: string;
  currentProductSolution?: string;
  budgetRange?: string;
  decisionMakerIdentified?: boolean;
  objections?: string;
  remarks?: string;
  nextFollowupDate?: string;
  expectedCloseDate?: string;
  /**
   * Whether creating this lead should auto-create an initial COMPLETED visit
   * dated today (the common case: a lead entered right after meeting/calling
   * someone). Defaults to true server-side when omitted. Set false for leads
   * entered secondhand (e.g. from a web form) with no direct contact yet.
   */
  logAsVisitToday?: boolean;
  /**
   * Only meaningful when logAsVisitToday is true - which kind of touchpoint
   * the auto-created stub visit represents. Defaults to "FIELD" server-side
   * when omitted.
   */
  visitType?: "FIELD" | "TELEPHONIC";
}

/**
 * POST /leads body: companyName, contactPerson, contactNo are always required.
 * City, Lead Source and Industry are also required, but each is now satisfied by
 * either its master-data id OR its free-text "Other" sibling (creatable fields),
 * so those three aren't hard-required at the TypeScript level here - the create
 * dialog's zod schema enforces "one of id/other must be set" before submit.
 */
export interface CreateLeadPayload extends LeadPayloadFields {
  companyName: string;
  contactPerson: string;
  contactNo: string;
}

/** PUT /leads/{id} body: every field optional, applied if present. */
export type UpdateLeadPayload = LeadPayloadFields;

export interface LeadStatusUpdatePayload {
  status: LeadStatus;
  lostReasonId?: string;
  lostReasonOther?: string;
}

export interface LeadDuplicateMatch {
  id: string;
  companyName: string;
  contactPerson: string;
  contactNo: string;
  ownerId: string;
}

export interface CheckLeadDuplicatesParams {
  contactNo?: string;
  companyName?: string;
}

export async function getLeads(
  params: GetLeadsParams = {},
): Promise<PagedResponse<Lead>> {
  const response = await axiosInstance.get<PagedResponse<Lead>>("/leads", {
    params,
  });
  return response.data;
}

export async function getLead(id: string): Promise<Lead> {
  const response = await axiosInstance.get<Lead>(`/leads/${id}`);
  return response.data;
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const response = await axiosInstance.post<Lead>("/leads", payload);
  return response.data;
}

export async function updateLead(
  id: string,
  payload: UpdateLeadPayload,
): Promise<Lead> {
  const response = await axiosInstance.put<Lead>(`/leads/${id}`, payload);
  return response.data;
}

export async function updateLeadStatus(
  id: string,
  payload: LeadStatusUpdatePayload,
): Promise<Lead> {
  const response = await axiosInstance.patch<Lead>(
    `/leads/${id}/status`,
    payload,
  );
  return response.data;
}

export async function reassignLead(id: string, newOwnerId: string): Promise<Lead> {
  const response = await axiosInstance.patch<Lead>(`/leads/${id}/reassign`, {
    newOwnerId,
  });
  return response.data;
}

export async function checkLeadDuplicates(
  params: CheckLeadDuplicatesParams,
): Promise<LeadDuplicateMatch[]> {
  const response = await axiosInstance.get<LeadDuplicateMatch[]>(
    "/leads/duplicates",
    { params },
  );
  return response.data;
}

/**
 * Fetches the caller's visible leads, paginated. Non-admins are silently scoped
 * to their own leads server-side regardless of any ownerId passed here.
 * `enabled` defaults to true - pass false for a query that shouldn't fire yet (e.g. the
 * existing-lead search picker, which waits for at least a 2-character search term).
 */
export function useLeads(params: GetLeadsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: () => getLeads(params),
    enabled: options?.enabled ?? true,
  });
}

export function useLead(id: string | null | undefined) {
  return useQuery({
    queryKey: ["leads", "detail", id],
    queryFn: () => getLead(id as string),
    enabled: !!id,
  });
}

function useInvalidateLeads() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["leads"] });
}

export function useCreateLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => createLead(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLeadPayload }) =>
      updateLead(id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateLeadStatus() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: LeadStatusUpdatePayload;
    }) => updateLeadStatus(id, payload),
    onSuccess: () => invalidate(),
  });
}

/** ADMIN only: reassigns a lead to a different owner. */
export function useReassignLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: ({ id, newOwnerId }: { id: string; newOwnerId: string }) =>
      reassignLead(id, newOwnerId),
    onSuccess: () => invalidate(),
  });
}

/**
 * Imperative, on-demand duplicate check (called on blur of contactNo/companyName
 * during lead creation) rather than a declarative cached query, since it needs to
 * fire on a DOM event rather than whenever its inputs change.
 */
export function useCheckLeadDuplicates() {
  return useMutation({
    mutationFn: (params: CheckLeadDuplicatesParams) =>
      checkLeadDuplicates(params),
  });
}
