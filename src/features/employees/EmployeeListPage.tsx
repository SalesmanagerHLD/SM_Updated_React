import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { Employee } from "../../api/employeesApi";
import { getEmployees, useDeactivateEmployee, useEmployees } from "../../api/employeesApi";
import { useMasterData } from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { TableToolbar } from "../../components/TableToolbar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { EmployeeImportDialog } from "./EmployeeImportDialog";

const PAGE_SIZE = 20;

export function EmployeeListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error } = useEmployees({
    page,
    size: PAGE_SIZE,
  });
  const deactivateMutation = useDeactivateEmployee();

  // Unpaginated (separately cached) so a manager's name resolves correctly even when that
  // manager isn't on the currently-displayed page.
  const { data: allEmployeesPage } = useEmployees({ size: 500 });
  const managerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of allEmployeesPage?.content ?? []) map.set(emp.id, emp.fullName);
    return map;
  }, [allEmployeesPage]);

  const { data: designations } = useMasterData("DESIGNATION");
  const designationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of designations ?? []) map.set(item.id, item.label);
    return map;
  }, [designations]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Employee | null>(
    null,
  );
  const [rowError, setRowError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const visibleEmployees = useMemo(() => {
    const content = data?.content ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return content;
    return content.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term),
    );
  }, [data, search]);

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getEmployees({ size: 1000 });
      const managerNameByIdForExport = new Map(all.content.map((e) => [e.id, e.fullName]));
      exportToCsv<Employee>(`employees-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Full Name", value: (e) => e.fullName },
        { label: "Email", value: (e) => e.email },
        { label: "Role", value: (e) => e.role },
        {
          label: "Designation",
          value: (e) => (e.designationId ? (designationLabelById.get(e.designationId) ?? "") : ""),
        },
        {
          label: "Reports To",
          value: (e) => (e.managerId ? (managerNameByIdForExport.get(e.managerId) ?? "") : ""),
        },
        { label: "Active", value: (e) => (e.active ? "Active" : "Inactive") },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!pendingDeactivate) return;
    setRowError(null);
    try {
      await deactivateMutation.mutateAsync(pendingDeactivate.id);
      setPendingDeactivate(null);
    } catch (error) {
      setRowError(parseApiError(error).message);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h5">Employees</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<UploadFileIcon />}
            variant="outlined"
            onClick={() => setImportOpen(true)}
          >
            Import
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={openCreateDialog}
          >
            Add Employee
          </Button>
        </Stack>
      </Stack>

      {rowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRowError(null)}>
          {rowError}
        </Alert>
      )}

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email..."
        onExport={handleExport}
        exportDisabled={!data || data.content.length === 0}
        exportLoading={exportLoading}
      />

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {parseApiError(error).message}
        </Alert>
      )}

      {data && (
        <>
          {data.content.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No employees yet.
              </Typography>
            </Paper>
          )}

          {data.content.length > 0 && visibleEmployees.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No employees match your search.
              </Typography>
            </Paper>
          )}

          {isMobile && visibleEmployees.length > 0 && (
            <Stack spacing={1.5}>
              {visibleEmployees.map((employee) => (
                <Card key={employee.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {employee.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {employee.email}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditDialog(employee)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={employee.active ? "Deactivate" : "Already inactive"}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!employee.active}
                              onClick={() => setPendingDeactivate(employee)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      <Chip
                        label={employee.role}
                        size="small"
                        color={employee.role === "ADMIN" ? "primary" : "default"}
                        variant="outlined"
                      />
                      <Chip
                        label={employee.active ? "Active" : "Inactive"}
                        color={employee.active ? "success" : "default"}
                        size="small"
                      />
                    </Stack>
                    {employee.designationId && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {designationLabelById.get(employee.designationId) ?? "—"}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Reports to:{" "}
                      {employee.managerId ? (managerNameById.get(employee.managerId) ?? "—") : "—"}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {!isMobile && visibleEmployees.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Full name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Designation</TableCell>
                    <TableCell>Reports To</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleEmployees.map((employee) => (
                    <TableRow key={employee.id} hover>
                      <TableCell>{employee.fullName}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>
                        {employee.designationId
                          ? (designationLabelById.get(employee.designationId) ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {employee.managerId ? (managerNameById.get(employee.managerId) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.role}
                          size="small"
                          color={employee.role === "ADMIN" ? "primary" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.active ? "Active" : "Inactive"}
                          color={employee.active ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(employee)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={employee.active ? "Deactivate" : "Already inactive"}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!employee.active}
                              onClick={() => setPendingDeactivate(employee)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {data.totalPages > 1 && (
            <Stack direction="row" sx={{ justifyContent: "center", mt: 2 }}>
              <Pagination
                count={data.totalPages}
                page={page + 1}
                onChange={(_, next) => setPage(next - 1)}
              />
            </Stack>
          )}
        </>
      )}

      <EmployeeFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={editingEmployee}
      />

      <EmployeeImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {pendingDeactivate && (
        <ConfirmDialog
          open={!!pendingDeactivate}
          title="Deactivate employee?"
          message={`Are you sure you want to deactivate "${pendingDeactivate.fullName}"? They will no longer be able to log in.`}
          isPending={deactivateMutation.isPending}
          confirmLabel="Deactivate"
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={handleConfirmDeactivate}
        />
      )}
    </Box>
  );
}
