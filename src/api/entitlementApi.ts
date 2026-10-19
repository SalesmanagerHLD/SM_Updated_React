import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";

/** Feature codes the platform can gate behind a licensed entitlement - extend
 * this list as more gated features are added. */
export const FEATURE_ENTITLEMENTS = [
  "EMPLOYEE_LEAVE_MANAGEMENT",
  "TEAM_VISIBILITY",
  "INVENTORY_MANAGEMENT",
  "INVOICING",
  "PUSH_NOTIFICATIONS",
  "CALENDAR_SYNC",
] as const;

export type FeatureEntitlement = (typeof FEATURE_ENTITLEMENTS)[number];

export async function getMyEntitlements(): Promise<FeatureEntitlement[]> {
  const response = await axiosInstance.get<FeatureEntitlement[]>(
    "/organizations/me/entitlements",
  );
  return response.data;
}

/** Fetched once per session (long staleTime - entitlements rarely change, and
 * when they do it's a platform operator action, not something this org's own
 * users can trigger, so aggressive refetching isn't needed). */
export function useMyEntitlements(enabled: boolean) {
  return useQuery({
    queryKey: ["entitlements", "me"],
    queryFn: getMyEntitlements,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
