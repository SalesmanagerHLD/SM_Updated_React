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
import type { Customer } from "../../api/customersApi";
import { getCustomers, useCustomers } from "../../api/customersApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import { CustomerFormDialog } from "./CustomerFormDialog";

/**
 * Create/update are open to any entitled employee (not ADMIN-only, unlike Product) - a rep
 * quick-adding a customer while quoting in the field must not be blocked on Admin involvement.
 */
export function CustomerListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data, isLoading, isError, error } = useCustomers({
    search: search || undefined,
    includeInactive: true,
    page,
    size: pageSize,
  });

  const rows = useMemo(() => data?.content ?? [], [data]);

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setFormDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormDialogOpen(true);
  };

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getCustomers({ includeInactive: true, size: 1000 });
      exportToCsv<Customer>(`customers-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "Name", value: (c) => c.name },
        { label: "Contact Person", value: (c) => c.contactPerson ?? "" },
        { label: "Phone", value: (c) => c.phone ?? "" },
        { label: "Email", value: (c) => c.email ?? "" },
        { label: "GSTIN", value: (c) => c.gstin ?? "" },
        { label: "Status", value: (c) => (c.active ? "Active" : "Inactive") },
      ]);
    } catch (err) {
      setExportError(parseApiError(err).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageFill>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Customers</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreateDialog}>
          Add Customer
        </Button>
      </Stack>

      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        searchPlaceholder="Search name, contact, phone, email, GSTIN..."
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
          {rows.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No customers yet.
              </Typography>
            </Paper>
          )}

          {isMobile && rows.length > 0 && (
            <Stack spacing={1.5}>
              {rows.map((customer) => (
                <Card key={customer.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="subtitle1">{customer.name}</Typography>
                      <Chip
                        label={customer.active ? "Active" : "Inactive"}
                        color={customer.active ? "success" : "default"}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {customer.contactPerson ?? "-"} {customer.phone ? `- ${customer.phone}` : ""}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button size="small" onClick={() => openEditDialog(customer)}>
                        Edit
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {!isMobile && rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Contact Person</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>GSTIN</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((customer) => (
                    <TableRow key={customer.id} hover>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.contactPerson ?? "-"}</TableCell>
                      <TableCell>{customer.phone ?? "-"}</TableCell>
                      <TableCell>{customer.email ?? "-"}</TableCell>
                      <TableCell>{customer.gstin ?? "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={customer.active ? "Active" : "Inactive"}
                          color={customer.active ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditDialog(customer)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePager

            page={page}

            totalPages={data.totalPages}

            totalElements={data.totalElements}

            pageSize={pageSize}

            onPageChange={setPage}

            onPageSizeChange={(n) => {

              setPageSize(n);

              setPage(0);

            }}

          />
        </>
      )}

      <CustomerFormDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        customer={editingCustomer}
      />
    </PageFill>
  );
}
