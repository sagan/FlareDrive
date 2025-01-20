import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ShareIcon from '@mui/icons-material/Share';
import { useLocalStorage } from "@uidotdev/usehooks";
import {
  AUTH_VARIABLE, basicAuthorizationHeader, dirUrlPath, EXPIRES_VARIABLE, FULL_CONTROL_VARIABLE, MIME_DIR, nextDayEndTimestamp, path2Key, Permission, SCOPE_VARIABLE, TOKEN_VARIABLE
} from "../lib/commons";
import {
  FileItem, isThumbnailPossible, ViewMode, SHARES_FOLDER_KEY, VIEWMODE_VARIABLE, Config,
  EDITOR_PROMPT_VARIABLE, EDITOR_READ_ONLY_VARIABLE, ConfigContext, getFilePermission, isDirectory
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
    checksums: {},
  }
]

const globalStyles = (
  <GlobalStyles styles={{ "html, body, #root": { height: "100%" } }} />
);

const theme = createTheme({
  palette: { primary: { main: "#f38020" } },
});

export default function App() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [showGenerateThumbnailDialog, setShowGenerateThumbnailDialog] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = React.useState(false);
  const [error, setError] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(""); // sharing file key

  const [auth, setAuth] = useLocalStorage<string>(AUTH_VARIABLE, "");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(VIEWMODE_VARIABLE, 0);
  const [editorPrompt, setEditorPrompt] = useLocalStorage<number>(EDITOR_PROMPT_VARIABLE, 1)
  const [editorReadOnly, setEditorReadOnly] = useLocalStorage<number>(EDITOR_READ_ONLY_VARIABLE, 0)
  const [expires, setExpires] = useState(() => nextDayEndTimestamp());
  const [requireSignIn, setRequireSignIn] = useState(false)

  const authSearchParams = useMemo(() => {
    const authSearchParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if ([SCOPE_VARIABLE, TOKEN_VARIABLE, EXPIRES_VARIABLE, FULL_CONTROL_VARIABLE].includes(key)) {
        authSearchParams.set(key, value)
      }
    })
    return authSearchParams.size ? authSearchParams : null
  }, [searchParams])

  const config: Config = useMemo(() => {
    return {
      auth, authSearchParams, viewMode, editorPrompt, editorReadOnly, expires,
      setAuth, setViewMode, setEditorPrompt, setEditorReadOnly
    }
  }, [auth, authSearchParams, viewMode, editorPrompt, editorReadOnly, expires])

  useEffect(() => {
    const iv = setInterval(() => setExpires(nextDayEndTimestamp()), 3600000 * 8)
    return () => clearInterval(iv);
  }, [])

  const location = useLocation();
  const navigate = useNavigate();
  const cwd = path2Key(location.pathname)

  const setCwd = (cwd: string) => {
    const pathname = dirUrlPath(cwd)
    const scope = searchParams.get(SCOPE_VARIABLE)
    if (scope) {
      if (pathname.startsWith(dirUrlPath(scope))) {
        navigate({ pathname, search: "?" + searchParams.toString() })
        return
      }
    }
    navigate(pathname);
  }

  const permission = useMemo(() => getFilePermission(cwd), [cwd])

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
    console.log("fetch", cwd)
    if (cwd == SHARES_FOLDER_KEY) {
      listShares(auth).then(setShares).catch(e => {
        setShares([])
        setError(e)
      }).finally(() => setLoading(false))
      return
    }
    fetchPath(cwd, auth || (authSearchParams ? "?" + authSearchParams.toString() : "")).then(({
      auth: sentbackAuth,
      items
    }) => {
      setRequireSignIn(false)
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
      setFiles([])
      setError(e)
      if (`${e}`.includes("status=401")) {
        if (auth) {
          setAuth("")
        }
        setRequireSignIn(true)
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

  return (
    <ConfigContext.Provider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <TransferQueueProvider>
          <Stack sx={{ height: "100%" }}>
            <Header
              onSignOut={() => {
                setAuth("");
                fetchFiles();
              }}
              onSignnIn={() => setShowSignInDialog(true)} search={search} fetchFiles={fetchFiles}
              onSearchChange={(newSearch: string) => setSearch(newSearch)} setViewMode={setViewMode}
              onGenerateThumbnails={() => setShowGenerateThumbnailDialog(true)}
              setShowProgressDialog={setShowProgressDialog}
              onShare={(multiSelected.length > 0 ? multiSelected.length === 1 : cwd) ? () => {
                setSharing(multiSelected[0] || cwd)
              } : undefined}
            />
            <PathBreadcrumb permission={permission} path={cwd} setCwd={setCwd} />
            {
              cwd === SHARES_FOLDER_KEY
                ? <ShareManager fetchFiles={fetchFiles} search={search} shares={shares} loading={loading} />
                : <Main cwd={cwd} setCwd={setCwd} loading={loading} search={search}
                  sharing={sharing} setSharing={setSharing}
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
          {(requireSignIn || showSignInDialog) && <SignInDialog
            open={true} onClose={() => setShowSignInDialog(false)} onSignIn={onSignIn} />}
        </TransferQueueProvider>
      </ThemeProvider>
    </ConfigContext.Provider>
  );
}
