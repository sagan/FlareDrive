import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import NProgress from "nprogress"
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams, To } from "react-router-dom";
import ShareIcon from '@mui/icons-material/Share';
import { useLocalStorage } from "@uidotdev/usehooks";
import {
  AUTH_VARIABLE, TOKEN_VARIABLE, EXPIRES_VARIABLE, FULL_CONTROL_VARIABLE, MIME_DIR, SCOPE_VARIABLE,
  nextDayEndTimestamp, path2Key, str2int, basicAuthorizationHeader, dirUrlPath,
} from "../lib/commons";
import {
  SHARES_FOLDER_KEY, VIEWMODE_VARIABLE, EDITOR_PROMPT_VARIABLE, EDITOR_READ_ONLY_VARIABLE, SORT_VARIABLE,
  FileItem, isThumbnailPossible, ViewMode, Config, ConfigContext, getFilePermission,
  cwd2Search,
} from "./commons";
import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import AdminDialog from "./AdminDialog";
import { TransferQueueProvider } from "./app/transferQueue";
import { fetchPath } from "./app/transfer";
import ShareManager from "./ShareManager";
import SearchForm from "./SearchForm";
import { listShares } from "./app/share";
import { PathBreadcrumb } from "./components";
import GenerateThumbnailsDialog from "./GenerateThumbnailsDialog";
import SignInDialog from "./SignInDialog";
import { searchFiles } from "./app/search";

const systemFolders: FileItem[] = [
  {
    key: SHARES_FOLDER_KEY,
    name: "Shared files",
    system: true,
    icon: ShareIcon,
    size: 0,
    uploaded: new Date(0),
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
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [showAdminDialog, setShowAdminDialog] = React.useState(false);
  const [showGenerateThumbnailDialog, setShowGenerateThumbnailDialog] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = React.useState(false);
  const [error, setError] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(""); // sharing file key
  const [ts, setTs] = useState(Date.now())

  const [auth, setAuth] = useLocalStorage<string>(AUTH_VARIABLE, "");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(VIEWMODE_VARIABLE, 0);
  const [sort, setSort] = useLocalStorage<number>(SORT_VARIABLE, 0);
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
      effectiveAuth: auth || (authSearchParams ? "?" + authSearchParams.toString() : ""),
      fullControl: !!str2int(authSearchParams?.get(FULL_CONTROL_VARIABLE)),
      auth, authSearchParams, viewMode, sort, editorPrompt, editorReadOnly, expires,
      setAuth, setViewMode, setSort, setEditorPrompt, setEditorReadOnly
    } as Config
  }, [auth, authSearchParams, viewMode, sort, editorPrompt, editorReadOnly, expires])

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
    let search = ""
    if (scope && pathname.startsWith(dirUrlPath(scope))) {
      search = "?" + searchParams.toString()
    }
    if (pathname === location.pathname && search === location.search) {
      setTs(Date.now())
    } else {
      navigate({ pathname, search });
    }
  }

  const [permission, prefix] = useMemo(() => getFilePermission(cwd), [cwd])
  const [isSearch, searchKeyword, searchOptions] = useMemo(() => cwd2Search(cwd), [cwd])
  const [search, setSearch] = useState(searchKeyword);
  const currentDir = isSearch ? (searchOptions.baseDir || "") : cwd

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

  useEffect(() => {
    if (loading) {
      NProgress.start()
    } else {
      NProgress.done();
    }
  }, [loading])

  const fetchFiles = () => {
    setLoading(true);
    setMultiSelected([]);
    setFiles([]);
    console.log("fetch", cwd, isSearch)
    if (cwd == SHARES_FOLDER_KEY) {
      listShares(auth).then(setShares).catch(e => {
        setShares([])
        setError(e)
      }).finally(() => setLoading(false))
      return
    }
    if (isSearch) {
      if (!searchKeyword) {
        setLoading(false)
        return;
      }
      searchFiles(auth, searchKeyword, searchOptions).then(result => {
        const files: FileItem[] = result.map(searchFile => {
          return {
            key: searchFile.key,
            size: searchFile.size,
            uploaded: searchFile.uploaded,
            httpMetadata: {
              contentType: searchFile.mime
            },
            customMetadata: {
              thumbnail: searchFile.thumbnail
            },
            checksums: {}
          }
        })
        setFiles(files)
      }).catch(e => setError(e)).finally(() => setLoading(false))
      return;
    }
    fetchPath(cwd, config.effectiveAuth).then(({
      auth: sentbackAuth,
      authed,
      items
    }) => {
      setRequireSignIn(false)
      if (authed) {
        setShowSignInDialog(false)
        if (sentbackAuth && sentbackAuth !== auth) {
          setAuth(sentbackAuth)
        }
      } else if (auth) {
        setAuth("")
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

  useEffect(() => fetchFiles(), [cwd, auth, ts]);

  return (
    <ConfigContext.Provider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <TransferQueueProvider>
          <Stack sx={{ height: "100%" }}>
            <Header permission={permission}
              onSignOut={() => {
                setAuth("");
                fetchFiles();
              }}
              cwd={cwd}
              isSearch={isSearch}
              searchOptions={searchOptions}
              setCwd={setCwd}
              onSignnIn={() => setShowSignInDialog(true)} search={search} fetchFiles={fetchFiles}
              setSearch={setSearch} setViewMode={setViewMode}
              sort={sort} setSort={setSort}
              onGenerateThumbnails={() => setShowGenerateThumbnailDialog(true)}
              setShowProgressDialog={setShowProgressDialog}
              setShowAdminDialog={setShowAdminDialog}
              onShare={(multiSelected.length > 0 ? multiSelected.length === 1 : cwd && cwd != SHARES_FOLDER_KEY)
                ? () => setSharing(multiSelected[0] || cwd) : undefined}
            />
            <PathBreadcrumb prefix={prefix} permission={permission}
              path={currentDir} searchKeyword={searchKeyword}
              isSearch={isSearch} searchOptions={searchOptions} setCwd={setCwd} setSearch={setSearch} />
            {
              cwd == SHARES_FOLDER_KEY
                ? <ShareManager setError={setError} fetchFiles={fetchFiles}
                  search={search} shares={shares} loading={loading} />
                : (isSearch && !searchKeyword)
                  ? <SearchForm searchBaseDir={searchOptions.baseDir || ""} />
                  : <Main cwd={cwd} setCwd={setCwd} loading={loading} filter={!isSearch ? search : ""}
                    sharing={sharing} setSharing={setSharing} setShowProgressDialog={setShowProgressDialog}
                    permission={permission} files={files} setError={setError} isSearch={isSearch}
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
          <AdminDialog
            currentDir={currentDir}
            open={showAdminDialog}
            onClose={() => setShowAdminDialog(false)}
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
