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
import ShareIcon from '@mui/icons-material/Share';

import { MIME_DIR, path2Key, Permission } from "../lib/commons";
import { dirUrlPath, LOCAL_STORAGE_KEY_AUTH, SHARES_FOLDER_KEY } from "./commons";
import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import { TransferQueueProvider } from "./app/transferQueue";
import { type FileItem } from "./FileGrid";
import { fetchPath } from "./app/transfer";
import ShareManager from "./ShareManager";
import { listShares } from "./app/share";
import { PathBreadcrumb } from "./components";

const systemFolders: FileItem[] = [
  {
    key: SHARES_FOLDER_KEY,
    name: "Shared files",
    system: true,
    icon: ShareIcon,
    size: 0,
    uploaded: "",
    httpMetadata: { contentType: MIME_DIR },
  }
]

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
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [auth, setAuth] = useState<string | null>(() => localStorage.getItem(LOCAL_STORAGE_KEY_AUTH))
  const [permission, setPermission] = useState<Permission>(Permission.RequireAuth);


  const location = useLocation();
  const navigate = useNavigate();
  const dirkey = path2Key(location.pathname)
  const cwd = dirkey + "/"
  const setCwd = useCallback((cwd: string) => {
    navigate(dirUrlPath(cwd));
  }, [navigate])

  const fetchFiles = useCallback(() => {
    setLoading(true);
    setMultiSelected([]);
    console.log("fetch", cwd)
    const savedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)
    if (dirkey == SHARES_FOLDER_KEY) {
      listShares(savedAuth).then(setShares).catch(e => {
        setShares([])
        setError(e)
      }).finally(() => setLoading(false))
      return
    }
    fetchPath(dirkey, savedAuth).then(({ permission, auth, items }) => {
      setPermission(permission)
      if (!dirkey) {
        items = [...systemFolders, ...items]
      }
      setFiles(items);
      if (auth) {
        setAuth(auth)
        if (auth !== localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)) {
          localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, auth)
        }
      }
    }).catch(e => {
      setFiles([]);
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
            permission={permission} authed={!!auth} search={search} fetchFiles={fetchFiles}
            onSearchChange={(newSearch: string) => setSearch(newSearch)}
            setShowProgressDialog={setShowProgressDialog}
          />
          <PathBreadcrumb permission={permission} path={cwd} onCwdChange={setCwd} />
          {
            dirkey === SHARES_FOLDER_KEY
              ? <ShareManager fetchFiles={fetchFiles} auth={auth} search={search} shares={shares} loading={loading} />
              : <Main cwd={cwd} setCwd={setCwd} loading={loading} search={search}
                permission={permission} authed={!!auth} auth={auth} files={files}
                multiSelected={multiSelected} setMultiSelected={setMultiSelected} fetchFiles={fetchFiles} />
          }
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
