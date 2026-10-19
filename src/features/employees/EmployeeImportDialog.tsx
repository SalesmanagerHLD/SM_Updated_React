import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import type { EmployeeImportResultResponse } from "../../api/employeesApi";
import { useImportEmployees } from "../../api/employeesApi";
import { parseApiError } from "../../api/errorHelpers";

interface EmployeeImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function EmployeeImportDialog({ open, onClose }: EmployeeImportDialogProps) {
  const importMutation = useImportEmployees();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<EmployeeImportResultResponse | null>(null);

  const reset = () => {
    setFile(null);
    setFileError(null);
    setResult(null);
    importMutation.reset();
  };

  const handleClose = () => {
    if (importMutation.isPending) return;
    reset();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    importMutation.reset();
    setResult(null);
    if (!picked) return;
    if (!/\.(xlsx|csv)$/i.test(picked.name)) {
      setFile(null);
      setFileError("Please choose an .xlsx or .csv file.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError("File is too large (max 5 MB).");
      return;
    }
    setFileError(null);
    setFile(picked);
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setResult(await importMutation.mutateAsync(file));
    } catch {
      // surfaced via importMutation.error below
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Import employees</DialogTitle>
      <DialogContent>
        {!result && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Upload an Excel (.xlsx) or CSV file to add many employees at once. Download a sample
              first and keep its column headers. Full Name, Email, Password and Role are required.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                component="a"
                href="/employee-import-template.xlsx"
                download
              >
                Sample Excel
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                component="a"
                href="/employee-import-template.csv"
                download
              >
                Sample CSV
              </Button>
            </Stack>

            <Box>
              <Button component="label" variant="contained" startIcon={<UploadFileIcon />}>
                Choose file
                <input type="file" hidden accept=".xlsx,.csv" onChange={handleFileChange} />
              </Button>
              {file && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected: {file.name}
                </Typography>
              )}
            </Box>

            {fileError && <Alert severity="error">{fileError}</Alert>}
            {importMutation.isError && (
              <Alert severity="error">{parseApiError(importMutation.error).message}</Alert>
            )}
          </Stack>
        )}

        {result && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={result.errorCount > 0 ? "warning" : "success"}>
              {result.importedCount} of {result.totalRows} rows imported
              {result.errorCount > 0 && `, ${result.errorCount} failed`}.
            </Alert>
            {result.errors.length > 0 && (
              <List dense disablePadding sx={{ maxHeight: 240, overflow: "auto" }}>
                {result.errors.map((rowError) => (
                  <ListItem key={`${rowError.rowNumber}-${rowError.message}`} disableGutters>
                    <ListItemText
                      primary={`Row ${rowError.rowNumber}${rowError.email ? ` (${rowError.email})` : ""}`}
                      secondary={rowError.message}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <>
            <Button onClick={reset}>Import another</Button>
            <Button variant="contained" onClick={handleClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={importMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || importMutation.isPending}
              startIcon={importMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {importMutation.isPending ? "Importing..." : "Upload"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
