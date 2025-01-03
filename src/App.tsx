import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ShareIcon from '@mui/icons-material/Share';
import { useLocalStorage } from "@uidotdev/usehooks";
import { AUTH_VARIABLE, basicAuthorizationHeader, MIME_DIR, nextDayEndTimestamp, path2Key, Permission, str2int } from "../lib/commons";
import {
  dirUrlPath, FileItem, isThumbnailPossible, ViewMode, SHARES_FOLDER_KEY, VIEWMODE_VARIABLE, Config,
  EDITOR_PROMPT_VARIABLE, EDITOR_READ_ONLY_VARIABLE, ConfigContext
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
import SignInDialog from "./SignInDialog";

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
  const [showGenerateThumbnailDialog, setShowGenerateThumbnailDialog] = useState(false);
  const [error, setError] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [permission, setPermission] = useState<Permission>(Permission.Unknown);

  const [auth, setAuth] = useLocalStorage<string | null>(AUTH_VARIABLE, null);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(VIEWMODE_VARIABLE, 0);
  const [editorPrompt, setEditorPrompt] = useLocalStorage<number>(EDITOR_PROMPT_VARIABLE, 1)
  const [editorReadOnly, setEditorReadOnly] = useLocalStorage<number>(EDITOR_READ_ONLY_VARIABLE, 0)
  const [expires, setExpires] = useState(() => nextDayEndTimestamp());

  const config: Config = {
    auth, viewMode, editorPrompt, editorReadOnly, expires,
    setAuth, setViewMode, setEditorPrompt, setEditorReadOnly
  }

  useEffect(() => {
    const iv = setInterval(() => setExpires(nextDayEndTimestamp()), 3600000 * 8)
    return () => clearInterval(iv);
  }, [])

  const location = useLocation();
  const navigate = useNavigate();
  const cwd = path2Key(location.pathname)
  const setCwd = useCallback((cwd: string) => {
    navigate(dirUrlPath(cwd));
  }, [navigate])

  useEffect(() => {
    document.title = cwd ? `${cwd}/ - ${window.__SITENAME__}` : window.__SITENAME__
  }, [cwd]);

  const thumbnailableFiles = useMemo(() => {
    let items = files.filter(isThumbnailPossible)
    if (multiSelected.length > 0) {
      items = items.filter(f => multiSelected.includes(f.key))
    }
    return items
  }, [files, multiSelected])

  const fetchFiles = () => {
    setLoading(true);
    setMultiSelected([]);
    setFiles([]);
    setPermission(Permission.Unknown);
    console.log("fetch", cwd)
    if (cwd == SHARES_FOLDER_KEY) {
      listShares(auth).then(setShares).catch(e => {
        setShares([])
        setError(e)
      }).finally(() => setLoading(false))
      return
    }
    fetchPath(cwd, auth).then(({ permission, auth: sentbackAuth, items }) => {
      setPermission(permission)
      if (sentbackAuth && sentbackAuth !== auth) {
        setAuth(sentbackAuth)
      }
      if (items) {
        if (!cwd) {
          items = [...systemFolders, ...items]
        }
        setFiles(items);
      } else {
        setError(new Error("dir not found"))
      }
    }).catch(e => {
      setFiles([]);
      setError(e)
      setPermission(Permission.RequireAuth)
      if (`${e}`.includes("status=401")) {
        setAuth(null)
      }
    }).finally(() => setLoading(false));
  }

  const onSignIn = (user: string, pass: string) => {
    if (!user && !pass) {
      setError(new Error("username & password can not be both empty"))
      return
    }
    setAuth(() => basicAuthorizationHeader(user, pass))
  }

  useEffect(() => fetchFiles(), [cwd, auth]);

  const requireSignIn = !auth && (permission === Permission.OpenFile || permission === Permission.RequireAuth)

  return (
    <ConfigContext.Provider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <TransferQueueProvider>
          <Stack sx={{ height: "100%" }}>
            <Header
              onSignOut={() => {
                setAuth(null);
                fetchFiles();
              }}
              permission={permission} authed={!!auth} search={search} fetchFiles={fetchFiles}
              onSearchChange={(newSearch: string) => setSearch(newSearch)} setViewMode={setViewMode}
              onGenerateThumbnails={() => setShowGenerateThumbnailDialog(true)}
              setShowProgressDialog={setShowProgressDialog}
            />
            <PathBreadcrumb permission={permission} path={cwd} onCwdChange={setCwd} />
            {
              cwd === SHARES_FOLDER_KEY
                ? <ShareManager fetchFiles={fetchFiles} search={search} shares={shares} loading={loading} />
                : <Main cwd={cwd} setCwd={setCwd} loading={loading} search={search}
                  permission={permission} files={files} setError={setError}
                  multiSelected={multiSelected} setMultiSelected={setMultiSelected} fetchFiles={fetchFiles} />
            }
          </Stack>
          <Snackbar
            autoHideDuration={5000}
            open={!!error}
            message={error ? `${error.message || error}` : null}
            onClose={() => setError(null)}
          />
          <ProgressDialog
            open={showProgressDialog}
            onClose={() => setShowProgressDialog(false)}
          />
          {showGenerateThumbnailDialog && <GenerateThumbnailsDialog open={true}
            onClose={() => setShowGenerateThumbnailDialog(false)} onDone={fetchFiles} files={thumbnailableFiles}>
          </GenerateThumbnailsDialog>}
          {requireSignIn && <SignInDialog open={true} onSignIn={onSignIn} />}
        </TransferQueueProvider>
      </ThemeProvider>
    </ConfigContext.Provider>
  );
}
