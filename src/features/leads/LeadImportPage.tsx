import { type ChangeEvent, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorIcon from "@mui/icons-material/Error";
import { useEmployees } from "../../api/employeesApi";
import type { LeadStatus } from "../../api/leadsApi";
import { LEAD_STATUSES } from "../../api/leadsApi";
import type { LeadImportPreviewResponse, LeadImportResultResponse } from "../../api/leadImportApi";
import { IMPORTABLE_FIELDS, previewLeadImport, useCommitLeadImport } from "../../api/leadImportApi";
import { parseApiError } from "../../api/errorHelpers";
import { StatCard } from "../../components/StatCard";
import { LEAD_STATUS_LABELS } from "./leadStatusConfig";

const UNMAPPED = -1;
const STEPS = ["Upload file", "Map columns & defaults", "Result"];

// LOST is rejected by the backend for imports - that workflow needs a captured
// Lost Reason this import doesn't collect, so it's never offered here.
const IMPORTABLE_STATUSES: LeadStatus[] = LEAD_STATUSES.filter((s) => s !== "LOST");

interface MapAndDefaultsStepProps {
  preview: LeadImportPreviewResponse;
  columnMapping: Record<string, number>;
  onMappingChange: (fieldKey: string, columnIndex: number) => void;
  defaultOwnerId: string | null;
  onDefaultOwnerChange: (id: string | null) => void;
  defaultStatus: LeadStatus;
  onDefaultStatusChange: (status: LeadStatus) => void;
  touched: boolean;
  missingRequiredFields: string[];
  commitError: string | null;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

function MapAndDefaultsStep({
  preview,
  columnMapping,
  onMappingChange,
  defaultOwnerId,
  onDefaultOwnerChange,
  defaultStatus,
  onDefaultStatusChange,
  touched,
  missingRequiredFields,
  commitError,
  isSubmitting,
  onBack,
  onSubmit,
}: MapAndDefaultsStepProps) {
  const { data: employeesPage } = useEmployees({ size: 200 });
  const activeEmployees = (employeesPage?.content ?? []).filter((emp) => emp.active);

  return (
    <Stack spacing={3}>
      {commitError && <Alert severity="error">{commitError}</Alert>}

      <Typography color="text.secondary">
        {preview.totalDataRowCount} row{preview.totalDataRowCount === 1 ? "" : "s"} will be
        imported.
      </Typography>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {preview.headers.map((header, idx) => (
                  <TableCell key={idx}>{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.previewRows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <TableCell key={cellIdx}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Map columns
        </Typography>
        <Grid container spacing={2}>
          {IMPORTABLE_FIELDS.map((field) => {
            const mappedIndex = columnMapping[field.key];
            const isMissing =
              touched && field.required && (mappedIndex === undefined || mappedIndex === UNMAPPED);
            return (
              <Grid key={field.key} size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={field.required ? `${field.label} *` : field.label}
                  value={String(mappedIndex ?? UNMAPPED)}
                  onChange={(e) => onMappingChange(field.key, Number(e.target.value))}
                  error={isMissing}
                  helperText={isMissing ? "Required" : " "}
                >
                  <MenuItem value={String(UNMAPPED)}>— Not mapped —</MenuItem>
                  {preview.headers.map((header, idx) => (
                    <MenuItem key={idx} value={String(idx)}>
                      {header}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Defaults applied to every imported row
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={activeEmployees}
              getOptionLabel={(option) => option.fullName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={activeEmployees.find((emp) => emp.id === defaultOwnerId) ?? null}
              onChange={(_, selected) => onDefaultOwnerChange(selected?.id ?? null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Default owner"
                  required
                  error={touched && !defaultOwnerId}
                  helperText={touched && !defaultOwnerId ? "Default owner is required" : " "}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              fullWidth
              label="Default status"
              value={defaultStatus}
              onChange={(e) => onDefaultStatusChange(e.target.value as LeadStatus)}
              helperText=" "
            >
              {IMPORTABLE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Box>

      {touched && missingRequiredFields.length > 0 && (
        <Alert severity="warning">
          Map all required fields before importing: {missingRequiredFields.join(", ")}.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isSubmitting ? "Importing..." : "Import"}
        </Button>
      </Stack>
    </Stack>
  );
}

interface ResultStepProps {
  result: LeadImportResultResponse;
  isMobile: boolean;
  onDone: () => void;
  onReset: () => void;
}

function ResultStep({ result, isMobile, onDone, onReset }: ResultStepProps) {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon={<ListAltIcon />} color="primary" value={result.totalRows} label="Total rows" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon={<CheckCircleIcon />}
            color="success"
            value={result.importedCount}
            label="Imported"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon={<ContentCopyIcon />}
            color="warning"
            value={result.skippedDuplicateCount}
            label="Skipped (duplicate)"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon={<ErrorIcon />} color="error" value={result.errorCount} label="Errors" />
        </Grid>
      </Grid>

      {result.skippedDuplicates.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Skipped duplicates
          </Typography>
          {isMobile ? (
            <Stack spacing={1.5}>
              {result.skippedDuplicates.map((dup) => (
                <Card key={dup.rowNumber} variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Row {dup.rowNumber}
                    </Typography>
                    <MuiLink component={RouterLink} to={`/app/leads/${dup.existingLeadId}`}>
                      {dup.companyName}
                    </MuiLink>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row #</TableCell>
                    <TableCell>Company Name</TableCell>
                    <TableCell>Existing Lead</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.skippedDuplicates.map((dup) => (
                    <TableRow key={dup.rowNumber} hover>
                      <TableCell>{dup.rowNumber}</TableCell>
                      <TableCell>{dup.companyName}</TableCell>
                      <TableCell>
                        <MuiLink component={RouterLink} to={`/app/leads/${dup.existingLeadId}`}>
                          View lead
                        </MuiLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {result.errors.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Errors
          </Typography>
          {isMobile ? (
            <Stack spacing={1.5}>
              {result.errors.map((err) => (
                <Card key={err.rowNumber} variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Row {err.rowNumber}
                    </Typography>
                    <Typography variant="body2">{err.message}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row #</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((err) => (
                    <TableRow key={err.rowNumber} hover>
                      <TableCell>{err.rowNumber}</TableCell>
                      <TableCell>{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button onClick={onReset}>Import another file</Button>
        <Button variant="contained" onClick={onDone}>
          Done
        </Button>
      </Stack>
    </Stack>
  );
}

/**
 * ADMIN-only 3-step wizard: upload an Excel/CSV of historical clients, confirm
 * the column-to-field mapping plus a default owner/status applied to every row,
 * then commit and show the imported/skipped/errored breakdown.
 */
export function LeadImportPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeadImportPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [defaultOwnerId, setDefaultOwnerId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<LeadStatus>("CLOSED_WON");
  const [mappingTouched, setMappingTouched] = useState(false);

  const [result, setResult] = useState<LeadImportResultResponse | null>(null);

  const commitMutation = useCommitLeadImport();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const response = await previewLeadImport(selected);
      setFile(selected);
      setPreview(response);
      setColumnMapping(response.suggestedMapping);
      setMappingTouched(false);
      setActiveStep(1);
    } catch (err) {
      setPreviewError(parseApiError(err).message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const missingRequiredFields = IMPORTABLE_FIELDS.filter((f) => {
    const mapped = columnMapping[f.key];
    return f.required && (mapped === undefined || mapped === UNMAPPED);
  }).map((f) => f.label);

  const handleMappingChange = (fieldKey: string, columnIndex: number) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (columnIndex === UNMAPPED) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = columnIndex;
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setMappingTouched(true);
    if (missingRequiredFields.length > 0 || !defaultOwnerId || !file) return;

    try {
      const response = await commitMutation.mutateAsync({
        file,
        request: { columnMapping, defaultOwnerId, defaultStatus },
      });
      setResult(response);
      setActiveStep(2);
    } catch {
      // surfaced below via commitMutation.error; stay on the mapping step
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setFile(null);
    setPreview(null);
    setPreviewError(null);
    setColumnMapping({});
    setDefaultOwnerId(null);
    setDefaultStatus("CLOSED_WON");
    setMappingTouched(false);
    setResult(null);
    commitMutation.reset();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Import Leads
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }} alternativeLabel={isMobile}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Upload an Excel (.xlsx) or CSV file of existing or historical clients to import them
            straight into the Leads list.
          </Typography>
          {previewError && (
            <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
              {previewError}
            </Alert>
          )}
          <Button
            component="label"
            variant="contained"
            startIcon={
              previewLoading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />
            }
            disabled={previewLoading}
          >
            {previewLoading ? "Reading file..." : "Choose file"}
            <input type="file" hidden accept=".xlsx,.csv" onChange={handleFileChange} />
          </Button>
          <Box sx={{ mt: 2 }}>
            <Button
              size="small"
              startIcon={<FileDownloadIcon />}
              component="a"
              href="/lead-import-template.xlsx"
              download
            >
              Download Excel template
            </Button>
          </Box>
        </Paper>
      )}

      {activeStep === 1 && preview && (
        <MapAndDefaultsStep
          preview={preview}
          columnMapping={columnMapping}
          onMappingChange={handleMappingChange}
          defaultOwnerId={defaultOwnerId}
          onDefaultOwnerChange={setDefaultOwnerId}
          defaultStatus={defaultStatus}
          onDefaultStatusChange={setDefaultStatus}
          touched={mappingTouched}
          missingRequiredFields={missingRequiredFields}
          commitError={commitMutation.isError ? parseApiError(commitMutation.error).message : null}
          isSubmitting={commitMutation.isPending}
          onBack={() => setActiveStep(0)}
          onSubmit={handleSubmit}
        />
      )}

      {activeStep === 2 && result && (
        <ResultStep
          result={result}
          isMobile={isMobile}
          onDone={() => navigate("/app/leads")}
          onReset={handleReset}
        />
      )}
    </Box>
  );
}
