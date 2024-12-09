import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Permission } from "../lib/commons";
import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import { TransferQueueProvider } from "./app/transferQueue";
import { type FileItem } from "./FileGrid";
import { fetchPath } from "./app/transfer";

const globalStyles = (
  <GlobalStyles styles={{ "html, body, #root": { height: "100%" } }} />
);

const theme = createTheme({
  palette: { primary: { main: "#f38020" } },
});

function App() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [authed, setAuthed] = useState(false)
  const [permission, setPermission] = useState<Permission>(Permission.RequireAuth);

  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const cwd = decodeURI(pathname.slice(1)); // removing preceding "/"
  const setCwd = useCallback((cwd: string) => {
    navigate("/" + encodeURI(cwd));
  }, [navigate])

  const fetchFiles = useCallback(() => {
    setLoading(true);
    fetchPath(cwd)
      .then(({ permission, authed, items }) => {
        setPermission(permission)
        setAuthed(authed)
        setFiles(items);
        setMultiSelected([]);
      })
      .catch(e => {
        setFiles([])
        setError(e)
      })
      .finally(() => setLoading(false));
  }, [cwd, setError]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
        <Stack sx={{ height: "100%" }}>
          <Header
            authed={authed} search={search} fetchFiles={fetchFiles}
            onSearchChange={(newSearch: string) => setSearch(newSearch)}
            setShowProgressDialog={setShowProgressDialog}
          />
          <Main cwd={cwd} setCwd={setCwd} loading={loading} search={search}
            permission={permission} authed={authed} files={files}
            multiSelected={multiSelected} setMultiSelected={setMultiSelected} fetchFiles={fetchFiles} />
        </Stack>
        <Snackbar
          autoHideDuration={5000}
          open={Boolean(error)}
          message={error?.message}
          onClose={() => setError(null)}
        />
        <ProgressDialog
          open={showProgressDialog}
          onClose={() => setShowProgressDialog(false)}
        />
      </TransferQueueProvider>
    </ThemeProvider>
  );
}

export default App;
