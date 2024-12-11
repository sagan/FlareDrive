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
import { LOCAL_STORAGE_KEY_AUTH } from "./commons";
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
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(LOCAL_STORAGE_KEY_AUTH))
  const [permission, setPermission] = useState<Permission>(Permission.RequireAuth);
  const [auth, setAuth] = useState<string | null>(null)

  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const cwd = decodeURI(pathname.slice(1)); // removing preceding "/"
  const setCwd = useCallback((cwd: string) => {
    navigate("/" + encodeURI(cwd));
  }, [navigate])

  const fetchFiles = useCallback(() => {
    setLoading(true);
    const savedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)
    fetchPath(cwd, savedAuth).then(({ permission, authed, auth, items }) => {
      setPermission(permission)
      setAuthed(authed)
      setFiles(items);
      setMultiSelected([]);
      if (auth) {
        setAuth(auth)
        if (auth !== localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)) {
          localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, auth)
        }
      }
    }).catch(e => {
      setFiles([]);
      setMultiSelected([])
      setError(e)
      setPermission(Permission.RequireAuth)
      if (`${e}`.includes("satus=401")) {
        setAuth(null)
        if (savedAuth && savedAuth === localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)) {
          localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH)
        }
      }
    }).finally(() => setLoading(false));
  }, [cwd, setError]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider auth={auth}>
        <Stack sx={{ height: "100%" }}>
          <Header
            permission={permission} authed={authed} search={search} fetchFiles={fetchFiles}
            onSearchChange={(newSearch: string) => setSearch(newSearch)}
            setShowProgressDialog={setShowProgressDialog}
          />
          <Main cwd={cwd} setCwd={setCwd} loading={loading} search={search}
            permission={permission} authed={authed} auth={auth} files={files}
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
