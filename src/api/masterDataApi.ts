import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";

/** The 12 reference-data types the backend supports, one generic endpoint set for all. */
export const MASTER_DATA_TYPES = [
  "INDUSTRY",
  "CITY",
  "PRODUCT",
  "BUSINESS_TYPE",
  "DESIGNATION",
  "VISIT_PURPOSE",
  "NEXT_ACTION",
  "LOST_REASON",
  "INTEREST_LEVEL",
  "LEAD_SOURCE",
  "STATE",
  "INTEREST_REASON",
] as const;

export type MasterDataType = (typeof MASTER_DATA_TYPES)[number];

export interface MasterDataItem {
  id: string;
  organizationId: string;
  type: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
  parentId: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterDataPayload {
  code: string;
  label: string;
  sortOrder?: number;
  /** For child types (e.g. INTEREST_REASON under an INTEREST_LEVEL): the parent row's id. */
  parentId?: string;
}

export interface UpdateMasterDataPayload {
  label: string;
  sortOrder: number;
  active: boolean;
}

export async function getMasterData(
  type: MasterDataType,
  includeInactive = false,
): Promise<MasterDataItem[]> {
  const response = await axiosInstance.get<MasterDataItem[]>(
    `/masters/${type}`,
    { params: { includeInactive } },
  );
  return response.data;
}

export async function createMasterData(
  type: MasterDataType,
  payload: CreateMasterDataPayload,
): Promise<MasterDataItem> {
  const response = await axiosInstance.post<MasterDataItem>(
    `/masters/${type}`,
    payload,
  );
  return response.data;
}

export async function updateMasterData(
  type: MasterDataType,
  id: string,
  payload: UpdateMasterDataPayload,
): Promise<MasterDataItem> {
  const response = await axiosInstance.put<MasterDataItem>(
    `/masters/${type}/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteMasterData(
  type: MasterDataType,
  id: string,
): Promise<void> {
  await axiosInstance.delete(`/masters/${type}/${id}`);
}

export function masterDataQueryKey(
  type: MasterDataType,
  includeInactive = false,
) {
  return ["masterData", type, includeInactive] as const;
}

/**
 * Fetches one master data type's entries. Used both by the Masters management
 * screen (with includeInactive=true, to also show deactivated rows) and by any
 * dropdown consumer elsewhere (with the default includeInactive=false).
 */
export function useMasterData(
  type: MasterDataType,
  includeInactive = false,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: masterDataQueryKey(type, includeInactive),
    queryFn: () => getMasterData(type, includeInactive),
    enabled: options.enabled ?? true,
  });
}

function useInvalidateMasterData(type: MasterDataType) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["masterData", type] });
}

export function useCreateMasterData(type: MasterDataType) {
  const invalidate = useInvalidateMasterData(type);
  return useMutation({
    mutationFn: (payload: CreateMasterDataPayload) =>
      createMasterData(type, payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMasterData(type: MasterDataType) {
  const invalidate = useInvalidateMasterData(type);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMasterDataPayload;
    }) => updateMasterData(type, id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useDeactivateMasterData(type: MasterDataType) {
  const invalidate = useInvalidateMasterData(type);
  return useMutation({
    mutationFn: (id: string) => deleteMasterData(type, id),
    onSuccess: () => invalidate(),
  });
}
