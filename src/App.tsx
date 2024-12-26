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
import { MIME_DIR, path2Key, Permission, str2int } from "../lib/commons";
import {
  dirUrlPath, FileItem, isThumbnailPossible, ViewMode,
  LOCAL_STORAGE_KEY_AUTH, SHARES_FOLDER_KEY, VIEWMODE_VARIABLE,
} from "./commons";
import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import { TransferQueueProvider } from "./app/transferQueue";
import { fetchPath } from "./app/transfer";
import ShareManager from "./ShareManager";
import { listShares } from "./app/share";
import { PathBreadcrumb } from "./components";
import GenerateThumbnailsDialog from "./GenerateThumbnailsDialog";

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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [generateThumbnailFiles, setGenerateThumbnailFiles] = React.useState<FileItem[] | null>(null)
  const [error, setError] = useState<Error | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [auth, setAuth] = useState<string | null>(() => localStorage.getItem(LOCAL_STORAGE_KEY_AUTH))
  const [permission, setPermission] = useState<Permission>(Permission.RequireAuth);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return str2int(localStorage.getItem(VIEWMODE_VARIABLE))
  })

  useEffect(() => {
    if (viewMode !== str2int(localStorage.getItem(VIEWMODE_VARIABLE))) {
      localStorage.setItem(VIEWMODE_VARIABLE, `${viewMode}`)
    }
  }, [viewMode])

  const location = useLocation();
  const navigate = useNavigate();
  const cwd = path2Key(location.pathname)
  const setCwd = useCallback((cwd: string) => {
    navigate(dirUrlPath(cwd));
  }, [navigate])

  useEffect(() => {
    document.title = cwd ? `${cwd}/ - ${window.__SITENAME__}` : window.__SITENAME__
  }, [cwd]);

  const onGenerateThumbnails = useCallback((files: FileItem[]) => {
    let items: FileItem[]
    if (generateThumbnailFiles) {
      items = files.filter(f => generateThumbnailFiles.find(_f => f.key === _f.key))
    } else {
      items = files.filter(isThumbnailPossible)
      if (multiSelected.length > 0) {
        items = items.filter(f => multiSelected.includes(f.key))
      }
    }
    setGenerateThumbnailFiles(items)
  }, [multiSelected]);

  const fetchFiles = useCallback(() => {
    setLoading(true);
    setMultiSelected([]);
    setFiles([]);
    setPermission(Permission.Unknown);
    console.log("fetch", cwd)
    const savedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)
    if (cwd == SHARES_FOLDER_KEY) {
      listShares(savedAuth).then(setShares).catch(e => {
        setShares([])
        setError(e)
      }).finally(() => setLoading(false))
      return
    }
    fetchPath(cwd, savedAuth).then(({ permission, auth, items }) => {
      setPermission(permission)
      if (auth) {
        setAuth(auth)
        if (auth !== localStorage.getItem(LOCAL_STORAGE_KEY_AUTH)) {
          localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, auth)
        }
      }
      if (items) {
        if (!cwd) {
          items = [...systemFolders, ...items]
        }
        setFiles(items);
        if (generateThumbnailFiles) {
          onGenerateThumbnails(items)
        }
      } else {
        setError(new Error("dir not found"))
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
            onSearchChange={(newSearch: string) => setSearch(newSearch)} setViewMode={setViewMode}
            onGenerateThumbnails={() => onGenerateThumbnails(files)}
            setShowProgressDialog={setShowProgressDialog}
          />
          <PathBreadcrumb permission={permission} path={cwd} onCwdChange={setCwd} />
          {
            cwd === SHARES_FOLDER_KEY
              ? <ShareManager fetchFiles={fetchFiles} auth={auth} search={search} shares={shares} loading={loading} />
              : <Main viewMode={viewMode} cwd={cwd} setCwd={setCwd} loading={loading} search={search}
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
        {!!generateThumbnailFiles && <GenerateThumbnailsDialog open={true} auth={auth}
          onClose={() => setGenerateThumbnailFiles(null)} onDone={fetchFiles} files={generateThumbnailFiles}>
        </GenerateThumbnailsDialog>}
      </TransferQueueProvider>
    </ThemeProvider>
  );
}
