import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { PagedResponse } from "./employeesApi";

export type ActivityType =
  | "LEAD_CREATED"
  | "LEAD_STATUS_CHANGED"
  | "LEAD_REASSIGNED"
  | "VISIT_LOGGED"
  | "VISIT_COMPLETED"
  | "VISIT_MISSED"
  | "LEAD_LAPSED"
  | "PO_RECEIVED"
  | "PO_ACCEPTED"
  | "PO_BILLED"
  | "PO_CANCELLED";

export const ACTIVITY_TYPES: ActivityType[] = [
  "LEAD_CREATED",
  "LEAD_STATUS_CHANGED",
  "LEAD_REASSIGNED",
  "VISIT_LOGGED",
  "VISIT_COMPLETED",
  "VISIT_MISSED",
  "LEAD_LAPSED",
  "PO_RECEIVED",
  "PO_ACCEPTED",
  "PO_BILLED",
  "PO_CANCELLED",
];

export interface ActivityEntry {
  id: string;
  leadId: string;
  ownerId: string;
  companyName: string;
  type: ActivityType;
  /** null = system-generated (a scheduled job), not a person. */
  actorId: string | null;
  description: string;
  createdAt: string;
}

export interface GetActivityParams {
  leadId?: string;
  ownerId?: string;
  type?: ActivityType;
  page?: number;
  size?: number;
}

export async function getActivity(
  params: GetActivityParams = {},
): Promise<PagedResponse<ActivityEntry>> {
  const response = await axiosInstance.get<PagedResponse<ActivityEntry>>(
    "/activity",
    { params },
  );
  return response.data;
}

/**
 * Fetches the caller's visible activity feed, paginated. Non-admins are
 * silently scoped to their own owned-leads' activity server-side regardless
 * of any ownerId passed here (same rule as useLeads). Rendered in whatever
 * order the backend returns (already chronological) - not re-sorted here.
 */
export function useActivity(
  params: GetActivityParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["activity", params],
    queryFn: () => getActivity(params),
    enabled: options.enabled ?? true,
  });
}
