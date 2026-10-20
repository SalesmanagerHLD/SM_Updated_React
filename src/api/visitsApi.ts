import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";

export type VisitType = "FIELD" | "TELEPHONIC";
export type VisitStatus = "PLANNED" | "COMPLETED" | "MISSED";

export const VISIT_TYPES: VisitType[] = ["FIELD", "TELEPHONIC"];

export interface Visit {
  id: string;
  organizationId: string;
  leadId: string;
  visitDate: string;
  scheduledTime: string | null;
  visitType: VisitType;
  purposeId: string | null;
  purposeOther: string | null;
  interestLevelId: string | null;
  interestLevelOther: string | null;
  contactPerson: string | null;
  designationId: string | null;
  designationOther: string | null;
  contactNo: string | null;
  email: string | null;
  stateId: string | null;
  stateOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  address: string | null;
  requirements: string | null;
  productIds: string[];
  interestReasonIds: string[];
  productsOther: string | null;
  budgetRange: string | null;
  decisionMakerIdentified: boolean | null;
  objections: string | null;
  remarks: string | null;
  nextVisitDate: string | null;
  status: VisitStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetVisitsParams {
  leadId?: string;
  status?: VisitStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}

/** Fields shared by create and update requests. */
export interface VisitPayloadFields {
  leadId?: string;
  visitDate?: string;
  scheduledTime?: string;
  visitType?: VisitType;
  purposeId?: string;
  purposeOther?: string;
  interestLevelId?: string;
  interestLevelOther?: string;
  contactPerson?: string;
  designationId?: string;
  designationOther?: string;
  contactNo?: string;
  email?: string;
  stateId?: string;
  stateOther?: string;
  cityId?: string;
  cityOther?: string;
  address?: string;
  requirements?: string;
  productIds?: string[];
  interestReasonIds?: string[];
  productsOther?: string;
  budgetRange?: string;
  decisionMakerIdentified?: boolean;
  objections?: string;
  remarks?: string;
  nextVisitDate?: string;
  /**
   * Omit when scheduling a future visit (defaults to PLANNED server-side);
   * send "COMPLETED" explicitly when logging something that already happened.
   * Never send "MISSED" - the backend rejects it with a 400.
   */
  status?: "PLANNED" | "COMPLETED";
}

/** POST /visits body: leadId, visitDate, visitType are required. */
export interface CreateVisitPayload extends VisitPayloadFields {
  leadId: string;
  visitDate: string;
  visitType: VisitType;
}

/** PUT /visits/{id} body: every field optional, applied if present. */
export type UpdateVisitPayload = VisitPayloadFields;

export interface VisitStatusUpdatePayload {
  status: "PLANNED" | "COMPLETED";
}

/** Lightweight projection from GET /visits/same-day - just enough for an advisory warning. */
export interface VisitSameDayMatch {
  id: string;
  visitDate: string;
  status: VisitStatus;
  visitType: VisitType;
  purposeId: string | null;
  purposeOther: string | null;
}

export interface CheckVisitSameDayParams {
  leadId: string;
  visitDate: string;
}

export async function getVisits(
  params: GetVisitsParams = {},
): Promise<PagedResponse<Visit>> {
  const response = await axiosInstance.get<PagedResponse<Visit>>("/visits", {
    params,
  });
  return response.data;
}

export async function getVisit(id: string): Promise<Visit> {
  const response = await axiosInstance.get<Visit>(`/visits/${id}`);
  return response.data;
}

export async function createVisit(payload: CreateVisitPayload): Promise<Visit> {
  const response = await axiosInstance.post<Visit>("/visits", payload);
  return response.data;
}

/** Advisory only - never blocks; the caller decides whether to still create the Visit. */
export async function checkVisitSameDay(
  params: CheckVisitSameDayParams,
): Promise<VisitSameDayMatch[]> {
  const response = await axiosInstance.get<VisitSameDayMatch[]>(
    "/visits/same-day",
    { params },
  );
  return response.data;
}

export async function updateVisit(
  id: string,
  payload: UpdateVisitPayload,
): Promise<Visit> {
  const response = await axiosInstance.put<Visit>(`/visits/${id}`, payload);
  return response.data;
}

export async function updateVisitStatus(
  id: string,
  payload: VisitStatusUpdatePayload,
): Promise<Visit> {
  const response = await axiosInstance.patch<Visit>(
    `/visits/${id}/status`,
    payload,
  );
  return response.data;
}

export async function getTodaysFollowUps(): Promise<Visit[]> {
  const response = await axiosInstance.get<Visit[]>("/visits/today");
  return response.data;
}

export function useVisits(
  params: GetVisitsParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["visits", params],
    queryFn: () => getVisits(params),
    enabled: options.enabled ?? true,
  });
}

export function useVisit(id: string | null | undefined) {
  return useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: () => getVisit(id as string),
    enabled: !!id,
  });
}

/**
 * "What's due today" agenda widget - kept fresh with a short staleTime rather
 * than the app-wide 5s default's usual caching feel, since this view is meant
 * to reflect visits as they're logged/completed elsewhere in the app.
 */
export function useTodaysFollowUps() {
  return useQuery({
    queryKey: ["visits", "today"],
    queryFn: () => getTodaysFollowUps(),
    staleTime: 0,
  });
}

/**
 * Fired imperatively (e.g. on date-blur), same pattern as leadsApi's
 * useCheckLeadDuplicates - a plain mutation, not a query, since it's a one-off
 * advisory check rather than cached list data.
 */
export function useCheckVisitSameDay() {
  return useMutation({
    mutationFn: (params: CheckVisitSameDayParams) => checkVisitSameDay(params),
  });
}

/**
 * Mutations invalidate both visits and the parent lead's detail query, since
 * the backend may sync some pre-fill fields (contact info, interest level,
 * etc.) back onto the Lead when a visit is created/updated.
 */
export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVisitPayload) => createVisit(payload),
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({
        queryKey: ["leads", "detail", visit.leadId],
      });
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateVisitPayload;
    }) => updateVisit(id, payload),
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({
        queryKey: ["leads", "detail", visit.leadId],
      });
    },
  });
}

export function useUpdateVisitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: VisitStatusUpdatePayload;
    }) => updateVisitStatus(id, payload),
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({
        queryKey: ["leads", "detail", visit.leadId],
      });
    },
  });
}
