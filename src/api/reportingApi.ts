import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "./axiosInstance";
import type { LeadStatus } from "./leadsApi";

export interface OwnerBreakdown {
  ownerId: string;
  ownerName: string;
  leadCount: number;
  closedWonCount: number;
}

export interface PipelineSummary {
  byStatus: Record<LeadStatus, number>;
  totalLeads: number;
  byOwner: OwnerBreakdown[];
}

export interface ConversionRate {
  totalLeads: number;
  closedWonCount: number;
  lostCount: number;
  conversionRatePercent: number;
}

export interface VisitsCompletedVsMissed {
  completed: number;
  missed: number;
  planned: number;
  completionRatePercent: number;
}

export interface GetVisitsCompletedVsMissedParams {
  dateFrom?: string;
  dateTo?: string;
}

export interface LeadSourceBreakdown {
  label: string;
  count: number;
}

export interface LeadsBySource {
  bySource: LeadSourceBreakdown[];
}

/** entitled is false (revenue always 0) when the org hasn't licensed INVENTORY_MANAGEMENT -
 * the Dashboard hides the Revenue card entirely in that case rather than showing a
 * misleading "0". */
export interface Revenue {
  entitled: boolean;
  revenue: number;
}

export interface GetRevenueParams {
  dateFrom?: string;
  dateTo?: string;
}

export async function getPipelineSummary(): Promise<PipelineSummary> {
  const response = await axiosInstance.get<PipelineSummary>(
    "/reports/pipeline-summary",
  );
  return response.data;
}

export async function getConversionRate(): Promise<ConversionRate> {
  const response = await axiosInstance.get<ConversionRate>(
    "/reports/conversion-rate",
  );
  return response.data;
}

export async function getVisitsCompletedVsMissed(
  params: GetVisitsCompletedVsMissedParams = {},
): Promise<VisitsCompletedVsMissed> {
  const response = await axiosInstance.get<VisitsCompletedVsMissed>(
    "/reports/visits-completed-vs-missed",
    { params },
  );
  return response.data;
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: ["reports", "pipeline-summary"],
    queryFn: () => getPipelineSummary(),
  });
}

export function useConversionRate() {
  return useQuery({
    queryKey: ["reports", "conversion-rate"],
    queryFn: () => getConversionRate(),
  });
}

export function useVisitsCompletedVsMissed(
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ["reports", "visits-completed-vs-missed", dateFrom, dateTo],
    queryFn: () => getVisitsCompletedVsMissed({ dateFrom, dateTo }),
  });
}

export async function getLeadsBySource(): Promise<LeadsBySource> {
  const response = await axiosInstance.get<LeadsBySource>("/reports/leads-by-source");
  return response.data;
}

export async function getRevenue(params: GetRevenueParams = {}): Promise<Revenue> {
  const response = await axiosInstance.get<Revenue>("/reports/revenue", { params });
  return response.data;
}

export interface QuotationInvoiceSummary {
  totalQuotations: number;
  approvedQuotations: number;
  convertedToInvoice: number;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  monthlyBilling: number;
  outstanding: number;
}

export interface GetQuotationInvoiceSummaryParams {
  dateFrom?: string;
  dateTo?: string;
}

export async function getQuotationInvoiceSummary(
  params: GetQuotationInvoiceSummaryParams = {},
): Promise<QuotationInvoiceSummary> {
  const response = await axiosInstance.get<QuotationInvoiceSummary>(
    "/reports/quotation-invoice-summary",
    { params },
  );
  return response.data;
}

export function useQuotationInvoiceSummary(params: GetQuotationInvoiceSummaryParams = {}) {
  return useQuery({
    queryKey: ["reports", "quotation-invoice-summary", params],
    queryFn: () => getQuotationInvoiceSummary(params),
  });
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface CompanySummaryRow {
  company: string;
  total: number;
  hot: number;
  won: number;
  lost: number;
}

export interface CitySummaryRow {
  city: string;
  total: number;
  hot: number;
  won: number;
}

export interface ProductPerformanceRow {
  product: string;
  total: number;
  won: number;
  conversionRatePercent: number;
}

export interface InterestLevelPerformanceRow {
  interestLevel: string;
  total: number;
  won: number;
  conversionRatePercent: number;
}

export interface EmployeePerformanceRow {
  employeeName: string;
  total: number;
  hot: number;
  followUpPending: number;
  won: number;
  conversionRatePercent: number;
}

export interface ExpectedClosures {
  thisWeek: number;
  thisMonth: number;
  nextMonth: number;
}

export interface FollowUpSummary {
  todayCount: number;
  tomorrowCount: number;
  next7DaysCount: number;
  overdueCount: number;
  unassignedCount: number;
}

export interface LeadDashboard {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  notSetInterestCount: number;
  todayFollowUpCount: number;
  overdueFollowUpCount: number;
  closedWonCount: number;
  closedLostCount: number;
  conversionRatePercent: number;
  expectedClosures: ExpectedClosures;
  byBusinessType: LabelCount[];
  byProduct: LabelCount[];
  companyWiseSummary: CompanySummaryRow[];
  cityWiseSummary: CitySummaryRow[];
  productPerformance: ProductPerformanceRow[];
  interestLevelPerformance: InterestLevelPerformanceRow[];
  employeePerformance: EmployeePerformanceRow[];
  followUpSummary: FollowUpSummary;
}

export interface GetLeadDashboardParams {
  status?: LeadStatus;
  ownerId?: string;
  interestLevelId?: string;
  stateId?: string;
  cityId?: string;
  productId?: string;
  businessTypeId?: string;
  interestReasonId?: string;
  nextFollowupDate?: string;
  expectedCloseDate?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getLeadDashboard(params: GetLeadDashboardParams = {}): Promise<LeadDashboard> {
  const response = await axiosInstance.get<LeadDashboard>("/reports/lead-dashboard", { params });
  return response.data;
}

export function useLeadDashboard(params: GetLeadDashboardParams = {}) {
  return useQuery({
    queryKey: ["reports", "lead-dashboard", params],
    queryFn: () => getLeadDashboard(params),
  });
}

export function useLeadsBySource(enabled = true) {
  return useQuery({
    queryKey: ["reports", "leads-by-source"],
    queryFn: () => getLeadsBySource(),
    enabled,
  });
}

export function useRevenue(enabled = true) {
  return useQuery({
    queryKey: ["reports", "revenue"],
    queryFn: () => getRevenue(),
    enabled,
  });
}

export type VisitType = "FIELD" | "TELEPHONIC";

export interface VisitsByType {
  byType: Record<VisitType, number>;
  total: number;
}

export interface GetVisitsByTypeParams {
  dateFrom?: string;
  dateTo?: string;
}

export async function getVisitsByType(params: GetVisitsByTypeParams = {}): Promise<VisitsByType> {
  const response = await axiosInstance.get<VisitsByType>("/reports/visits-by-type", { params });
  return response.data;
}

export function useVisitsByType(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["reports", "visits-by-type", dateFrom, dateTo],
    queryFn: () => getVisitsByType({ dateFrom, dateTo }),
  });
}

/** One row of the Interest Level x Status matrix - interestLevel is already resolved to a
 * display label ("Hot"/"Warm"/"Cold"/"Not Set") by the backend. */
export interface InterestLevelStatusRow {
  interestLevel: string;
  byStatus: Record<LeadStatus, number>;
  total: number;
}

export interface InterestLevelStatusMatrix {
  rows: InterestLevelStatusRow[];
}

export async function getInterestLevelStatusMatrix(): Promise<InterestLevelStatusMatrix> {
  const response = await axiosInstance.get<InterestLevelStatusMatrix>(
    "/reports/interest-level-status-matrix",
  );
  return response.data;
}

export function useInterestLevelStatusMatrix() {
  return useQuery({
    queryKey: ["reports", "interest-level-status-matrix"],
    queryFn: () => getInterestLevelStatusMatrix(),
  });
}

/** One row of GET /reports/team-progress - a read-only rollup of a single team member's
 * current workload. leadCountsByStatus is always fully zero-seeded across every LeadStatus
 * value, same convention as PipelineSummary#byStatus. lastActivityAt is null when this member
 * has no activity_log entries at all yet. */
export interface TeamMemberProgress {
  employeeId: string;
  employeeName: string;
  leadCountsByStatus: Record<LeadStatus, number>;
  totalLeads: number;
  visitsDueToday: number;
  visitsUpcoming: number;
  lastActivityAt: string | null;
}

export interface TeamProgressResponse {
  members: TeamMemberProgress[];
}

export async function getTeamProgress(): Promise<TeamProgressResponse> {
  const response = await axiosInstance.get<TeamProgressResponse>("/reports/team-progress");
  return response.data;
}

export function useTeamProgress() {
  return useQuery({
    queryKey: ["reports", "team-progress"],
    queryFn: () => getTeamProgress(),
  });
}

/** One row of the "why is it Hot/Warm/Cold" report: leads at an interest level carrying a reason
 * (a lead with several reasons counts once under each). */
export interface InterestReasonRow {
  interestLevel: string;
  reason: string;
  count: number;
}

export interface InterestReasonReport {
  rows: InterestReasonRow[];
  leadsWithReasons: number;
}

export interface GetInterestReasonParams {
  dateFrom?: string;
  dateTo?: string;
}

export async function getInterestReasons(params: GetInterestReasonParams = {}): Promise<InterestReasonReport> {
  const response = await axiosInstance.get<InterestReasonReport>("/reports/interest-reasons", { params });
  return response.data;
}

export function useInterestReasons(params: GetInterestReasonParams = {}) {
  return useQuery({
    queryKey: ["reports", "interest-reasons", params],
    queryFn: () => getInterestReasons(params),
  });
}
