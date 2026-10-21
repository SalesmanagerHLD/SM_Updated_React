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
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { useAuth } from "../../auth/AuthContext";
import type { Product } from "../../api/productsApi";
import { getProducts, useProducts } from "../../api/productsApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { PageFill } from "../../components/PageFill";
import { TablePager } from "../../components/TablePager";
import { useRowsPerPage } from "../../hooks/useRowsPerPage";
import { TableToolbar } from "../../components/TableToolbar";
import { ProductFormDialog } from "./ProductFormDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";

/**
 * Admin-managed Product catalog + stock. GET is open to any entitled user (an employee
 * generating an invoice needs the catalog too, Phase 2), so create/edit/stock-adjust actions
 * are hidden entirely for a non-Admin rather than shown-then-403'd.
 */
export function ProductListPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useRowsPerPage();
  const [search, setSearch] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const { data, isLoading, isError, error } = useProducts({
    includeInactive: true,
    page,
    size: pageSize,
  });

  const visibleProducts = useMemo(() => {
    const content = data?.content ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return content;
    return content.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term),
    );
  }, [data, search]);

  const isLowStock = (p: Product) =>
    p.lowStockThreshold != null && p.stockQuantity <= p.lowStockThreshold;

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormDialogOpen(true);
  };

  const handleExport = async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const all = await getProducts({ includeInactive: true, size: 1000 });
      exportToCsv<Product>(`products-${dayjs().format("YYYY-MM-DD")}.csv`, all.content, [
        { label: "SKU", value: (p) => p.sku ?? "" },
        { label: "Name", value: (p) => p.name },
        { label: "Unit Price", value: (p) => p.unitPrice },
        { label: "Tax Rate %", value: (p) => p.taxRatePercent },
        { label: "Stock Quantity", value: (p) => p.stockQuantity },
        { label: "Low Stock Threshold", value: (p) => p.lowStockThreshold ?? "" },
        { label: "Status", value: (p) => (p.active ? "Active" : "Inactive") },
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
        <Typography variant="h5">Products</Typography>
        {isAdmin && (
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreateDialog}>
            Add Product
          </Button>
        )}
      </Stack>

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, or scan/type SKU..."
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
                No products yet.
              </Typography>
            </Paper>
          )}

          {data.content.length > 0 && visibleProducts.length === 0 && (
            <Paper variant="outlined" sx={{ py: 4 }}>
              <Typography color="text.secondary" align="center">
                No products match your search.
              </Typography>
            </Paper>
          )}

          {isMobile && visibleProducts.length > 0 && (
            <Stack spacing={1.5}>
              {visibleProducts.map((product) => (
                <Card key={product.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="subtitle1">{product.name}</Typography>
                      <Chip
                        label={product.active ? "Active" : "Inactive"}
                        color={product.active ? "success" : "default"}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {product.sku ? `SKU: ${product.sku} - ` : ""}
                      Price: {product.unitPrice}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
                      <Typography variant="body2">Stock: {product.stockQuantity}</Typography>
                      {isLowStock(product) && (
                        <Chip label="Low stock" color="warning" size="small" />
                      )}
                    </Stack>
                    {isAdmin && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Button size="small" onClick={() => openEditDialog(product)}>
                          Edit
                        </Button>
                        <Button size="small" onClick={() => setAdjustingProduct(product)}>
                          Adjust Stock
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {!isMobile && visibleProducts.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">Stock</TableCell>
                    <TableCell>Status</TableCell>
                    {isAdmin && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleProducts.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.sku ?? "-"}</TableCell>
                      <TableCell align="right">{product.unitPrice}</TableCell>
                      <TableCell align="right">{product.taxRatePercent}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                          {isLowStock(product) && (
                            <Tooltip title={`At or below threshold of ${product.lowStockThreshold}`}>
                              <Chip label="Low" color="warning" size="small" />
                            </Tooltip>
                          )}
                          <span>{product.stockQuantity}</span>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={product.active ? "Active" : "Inactive"}
                          color={product.active ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditDialog(product)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Adjust Stock">
                            <IconButton size="small" onClick={() => setAdjustingProduct(product)}>
                              <Inventory2Icon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
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

      {isAdmin && (
        <>
          <ProductFormDialog
            open={formDialogOpen}
            onClose={() => setFormDialogOpen(false)}
            product={editingProduct}
          />
          <StockAdjustmentDialog
            open={!!adjustingProduct}
            onClose={() => setAdjustingProduct(null)}
            product={adjustingProduct}
          />
        </>
      )}
    </PageFill>
  );
}
