import { Fragment, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import type { MasterDataItem, MasterDataType } from "../../api/masterDataApi";
import {
  useDeactivateMasterData,
  useMasterData,
  useUpdateMasterData,
} from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";
import { exportToCsv } from "../../utils/exportToCsv";
import { TableToolbar } from "../../components/TableToolbar";
import { PageFill } from "../../components/PageFill";
import {
  DEFAULT_MASTER_DATA_TYPE,
  MASTER_TAB_TYPES,
  MASTER_TYPE_LABELS,
  isMasterDataType,
} from "./masterTypeConfig";
import { MasterDataFormDialog } from "./MasterDataFormDialog";
import { InterestReasonsPanel } from "./InterestReasonsPanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";

function MasterDataTable({ type }: { type: MasterDataType }) {
  const { data, isLoading, isError, error } = useMasterData(type, true);
  const deactivateMutation = useDeactivateMasterData(type);
  const updateMutation = useUpdateMasterData(type);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<MasterDataItem | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Interest levels expand to show (and add) the reasons that sit under them.
  const hasReasons = type === "INTEREST_LEVEL";
  const { data: reasons } = useMasterData("INTEREST_REASON", true, { enabled: hasReasons });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const columnCount = hasReasons ? 6 : 5;

  const openCreateDialog = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEditDialog = (item: MasterDataItem) => {
    setEditingItem(item);
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

  const handleActivate = async (item: MasterDataItem) => {
    setRowError(null);
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        payload: {
          label: item.label,
          sortOrder: item.sortOrder,
          active: true,
        },
      });
    } catch (error) {
      setRowError(parseApiError(error).message);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {parseApiError(error).message}
      </Alert>
    );
  }

  const items = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const term = search.trim().toLowerCase();
  const visibleItems = term
    ? items.filter(
        (item) =>
          item.code.toLowerCase().includes(term) || item.label.toLowerCase().includes(term),
      )
    : items;

  const handleExport = () => {
    exportToCsv<MasterDataItem>(
      `${type.toLowerCase()}-${dayjs().format("YYYY-MM-DD")}.csv`,
      visibleItems,
      [
        { label: "Code", value: (i) => i.code },
        { label: "Label", value: (i) => i.label },
        { label: "Sort Order", value: (i) => i.sortOrder },
        { label: "Status", value: (i) => (i.active ? "Active" : "Inactive") },
      ],
    );
  };

  return (
    <PageFill nested>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">{MASTER_TYPE_LABELS[type]}</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={openCreateDialog}
        >
          Add
        </Button>
      </Stack>

      {rowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRowError(null)}>
          {rowError}
        </Alert>
      )}

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search code, label..."
        onExport={handleExport}
        exportDisabled={items.length === 0}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {hasReasons && <TableCell sx={{ width: 40 }} />}
              <TableCell>Code</TableCell>
              <TableCell>Label</TableCell>
              <TableCell align="right">Sort order</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    No entries yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {items.length > 0 && visibleItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    No entries match your search.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleItems.map((item) => (
              <Fragment key={item.id}>
              <TableRow
                hover
                onClick={hasReasons ? () => setExpandedId((id) => (id === item.id ? null : item.id)) : undefined}
                sx={hasReasons ? { cursor: "pointer", "& > td": { borderBottom: expandedId === item.id ? 0 : undefined } } : undefined}
              >
                {hasReasons && (
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={expandedId === item.id ? "Hide reasons" : "Show reasons"}>
                      {expandedId === item.id ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                    </IconButton>
                  </TableCell>
                )}
                <TableCell>
                  <code>{item.code}</code>
                </TableCell>
                <TableCell>
                  {item.label}
                  {hasReasons && (
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1 }}
                      label={`${(reasons ?? []).filter((r) => r.parentId === item.id && r.active).length} reasons`}
                    />
                  )}
                </TableCell>
                <TableCell align="right">{item.sortOrder}</TableCell>
                <TableCell>
                  <Chip
                    label={item.active ? "Active" : "Inactive"}
                    color={item.active ? "success" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEditDialog(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {item.active ? (
                    <Tooltip title="Deactivate">
                      <IconButton
                        size="small"
                        onClick={() => setPendingDeactivate(item)}
                      >
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Activate">
                      <IconButton
                        size="small"
                        onClick={() => handleActivate(item)}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
              {hasReasons && (
                <TableRow>
                  <TableCell colSpan={columnCount} sx={{ py: 0, borderBottom: expandedId === item.id ? undefined : 0 }}>
                    <Collapse in={expandedId === item.id} unmountOnExit>
                      <InterestReasonsPanel level={item} />
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <MasterDataFormDialog
        type={type}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={editingItem}
      />

      {pendingDeactivate && (
        <ConfirmDialog
          open={!!pendingDeactivate}
          title="Deactivate entry?"
          message={`Are you sure you want to deactivate "${pendingDeactivate.label}"? It will no longer be offered as a choice, but existing records referencing it are unaffected.`}
          isPending={deactivateMutation.isPending}
          confirmLabel="Deactivate"
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={handleConfirmDeactivate}
        />
      )}
    </PageFill>
  );
}

/**
 * Generic Master Data management screen, parameterized by a `:type` route param.
 * One page drives all 10 reference-data types via tabs.
 */
export function MasterDataPage() {
  const { type: typeParam } = useParams<{ type: string }>();
  const navigate = useNavigate();

  if (!isMasterDataType(typeParam)) {
    return <Navigate to={`/app/masters/${DEFAULT_MASTER_DATA_TYPE}`} replace />;
  }

  const type = typeParam;

  return (
    <PageFill>
      <Typography variant="h5" gutterBottom>
        Master Data
      </Typography>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={type}
          onChange={(_, next) => navigate(`/app/masters/${next}`)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {MASTER_TAB_TYPES.map((t) => (
            <Tab key={t} value={t} label={MASTER_TYPE_LABELS[t]} />
          ))}
        </Tabs>
      </Paper>

      <MasterDataTable key={type} type={type} />
    </PageFill>
  );
}
