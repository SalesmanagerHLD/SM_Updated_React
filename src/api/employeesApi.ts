import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";

export type EmployeeRole = "ADMIN" | "EMPLOYEE";

export interface Employee {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: EmployeeRole;
  active: boolean;
  designationId: string | null;
  cityId: string | null;
  stateId: string | null;
  managerId: string | null;
  assignedProductIds: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface GetEmployeesParams {
  page?: number;
  size?: number;
}

export interface CreateEmployeePayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: EmployeeRole;
  designationId?: string;
  cityId?: string;
  stateId?: string;
  managerId?: string;
  assignedProductIds?: string[];
}

export interface UpdateEmployeePayload {
  fullName?: string;
  phone?: string;
  designationId?: string;
  cityId?: string;
  stateId?: string;
  managerId?: string;
  assignedProductIds?: string[];
  role?: EmployeeRole;
}

export async function getEmployees(
  params: GetEmployeesParams = {},
): Promise<PagedResponse<Employee>> {
  const response = await axiosInstance.get<PagedResponse<Employee>>(
    "/employees",
    { params },
  );
  return response.data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const response = await axiosInstance.get<Employee>(`/employees/${id}`);
  return response.data;
}

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<Employee> {
  const response = await axiosInstance.post<Employee>(
    "/employees",
    payload,
  );
  return response.data;
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<Employee> {
  const response = await axiosInstance.put<Employee>(
    `/employees/${id}`,
    payload,
  );
  return response.data;
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  const response = await axiosInstance.patch<Employee>(
    `/employees/${id}/deactivate`,
  );
  return response.data;
}

/**
 * Fetches the caller's own-organization employees, paginated.
 */
export function useEmployees(params: GetEmployeesParams = {}) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => getEmployees(params),
  });
}

export function useEmployee(id: string | null | undefined) {
  return useQuery({
    queryKey: ["employees", "detail", id],
    queryFn: () => getEmployee(id as string),
    enabled: !!id,
  });
}

function useInvalidateEmployees() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["employees"] });
}

export function useCreateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateEmployeePayload;
    }) => updateEmployee(id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useDeactivateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: (id: string) => deactivateEmployee(id),
    onSuccess: () => invalidate(),
  });
}

export interface EmployeeImportRowError {
  rowNumber: number;
  email?: string;
  message: string;
}

export interface EmployeeImportResultResponse {
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors: EmployeeImportRowError[];
}

/**
 * Bulk-creates employees from an .xlsx/.csv file (see public/employee-import-template.*).
 */
export async function importEmployees(
  file: File,
): Promise<EmployeeImportResultResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.post<EmployeeImportResultResponse>(
    "/employees/import",
    formData,
  );
  return response.data;
}

export function useImportEmployees() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: (file: File) => importEmployees(file),
    onSuccess: () => invalidate(),
  });
}
