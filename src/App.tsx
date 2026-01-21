import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import NProgress from "nprogress"
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ShareIcon from '@mui/icons-material/Share';
import { useLocalStorage } from "@uidotdev/usehooks";
import {
  AUTH_VARIABLE, TOKEN_VARIABLE, EXPIRES_VARIABLE, FULL_CONTROL_VARIABLE, MIME_DIR, SCOPE_VARIABLE, HEADER_RANGE,
  CONFIG_API, HEADER_AUTHORIZATION, SEARCH_MAGIC_WORD_LARGEST, SEARCH_MAGIC_WORD_RECENT,
  nextDayEndTimestamp, path2Key, str2int, basicAuthorizationHeader, dirUrlPath,
  GlobalConfigSchema,
  GlobalConfig,
  basename,
  fileUrl,
  ShareObject,
  rangeHeader,
} from "../lib/commons";
import {
  SHARES_FOLDER_KEY, VIEWMODE_VARIABLE, EDITOR_PROMPT_VARIABLE, EDITOR_READ_ONLY_VARIABLE, SORT_VARIABLE, README_FILES,
  FileItem, isThumbnailPossible, ViewMode, Config, ConfigContext, getFilePermission,
  cwd2Search,
  GlobalConfigContext,
  response2Html,
  EditingItem,
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
import DownloadDialog from "./DownloadDialog";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [showAdminDialog, setShowAdminDialog] = React.useState(false);
  const [showGenerateThumbnailDialog, setShowGenerateThumbnailDialog] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = React.useState(false);
  const [downloadAsZipFiles, setDownloadAsZipFiles] = React.useState<FileItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [tip, setTip] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [shares, setShares] = useState<string[]>([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(""); // sharing file key
  const [shareObject, setShareObject] = useState<ShareObject | null>(null);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [slideIndex, setSlideIndex] = useState(-1);
  const [ts, setTs] = useState(Date.now());

  const [auth, setAuth] = useLocalStorage<string>(AUTH_VARIABLE, "");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(VIEWMODE_VARIABLE, 0);
  const [sort, setSort] = useLocalStorage<number>(SORT_VARIABLE, 0);
  const [editorPrompt, setEditorPrompt] = useLocalStorage<number>(EDITOR_PROMPT_VARIABLE, 1)
  const [editorReadOnly, setEditorReadOnly] = useLocalStorage<number>(EDITOR_READ_ONLY_VARIABLE, 0)
  const [expires, setExpires] = useState(() => nextDayEndTimestamp());
  const [requireSignIn, setRequireSignIn] = useState(false);

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
  }, [auth, authSearchParams, viewMode, sort, editorPrompt, editorReadOnly, expires,
    setAuth, setViewMode, setSort, setEditorPrompt, setEditorReadOnly])

  useEffect(() => {
    const iv = setInterval(() => setExpires(nextDayEndTimestamp()), 3600000 * 8)
    return () => clearInterval(iv);
  }, [])

  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(GlobalConfigSchema.parse({}));

  useEffect(() => {
    if (!auth) {
      setGlobalConfig(GlobalConfigSchema.parse({}));
    }
    void fetch(CONFIG_API, {
      headers: {
        ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
      },
    }).then(res => res.json<GlobalConfig>()).then(setGlobalConfig);
  }, [auth]);

  const location = useLocation();
  const navigate = useNavigate();
  const cwd = path2Key(location.pathname);

  const setCwd = (cwd: string) => {
    const pathname = dirUrlPath(cwd);
    const scope = searchParams.get(SCOPE_VARIABLE);
    let search = "";
    if (scope && pathname.startsWith(dirUrlPath(scope))) {
      search = "?" + searchParams.toString();
    }
    if (pathname === location.pathname && search === location.search) {
      setTs(Date.now());
    } else {
      navigate({ pathname, search });
    }
  }

  const [permission, prefix] = useMemo(() => getFilePermission(cwd, globalConfig), [cwd, globalConfig]);
  const [isSearch, searchKeyword, searchOptions] = useMemo(() => cwd2Search(cwd), [cwd]);
  const [search, setSearch] = useState(searchKeyword);
  const currentDir = isSearch ? (searchOptions.baseDir || "") : cwd;

  useEffect(() => {
    document.title = cwd ? `${cwd}/ - ${window.__SITENAME__}` : window.__SITENAME__;
  }, [cwd]);

  const thumbnailableFiles = useMemo(() => {
    let items = files.filter(isThumbnailPossible);
    if (multiSelected.length > 0) {
      items = items.filter(f => multiSelected.includes(f.key));
    }
    return items;
  }, [files, multiSelected])

  useEffect(() => {
    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }
  }, [loading])

  const fetchFiles = useCallback(() => {
    setLoading(true);
    setMultiSelected([]);
    setFiles([]);
    console.log("fetch", cwd, isSearch)
    if (cwd == SHARES_FOLDER_KEY) {
      listShares(auth).then(setShares).catch(e => {
        setShares([]);
        setError(e);
      }).finally(() => setLoading(false))
      return;
    }
    if (isSearch) {
      if (!searchKeyword) {
        setLoading(false);
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
            customMetadata: searchFile.customMetadata,
            checksums: {}
          }
        })
        setFiles(files);
      }).catch(e => setError(e)).finally(() => setLoading(false));
      return;
    }
    fetchPath(cwd, config.effectiveAuth).then(({
      auth: sentbackAuth,
      authed,
      items
    }) => {
      setRequireSignIn(false);
      if (authed) {
        setShowSignInDialog(false);
        if (sentbackAuth && sentbackAuth !== auth) {
          setAuth(sentbackAuth);
        }
      } else if (auth) {
        setAuth("");
      }
      if (items) {
        if (!cwd) {
          items = [...systemFolders, ...items];
        }
        setFiles(items);
      } else {
        setError(new Error("dir not found"));
      }
    }).catch(e => {
      setFiles([]);
      setError(e);
      if (`${e}`.includes("status=401")) {
        if (auth) {
          setAuth("");
        }
        setRequireSignIn(true);
      }
    }).finally(() => setLoading(false));
  }, [auth, config.effectiveAuth, cwd, isSearch, searchKeyword, searchOptions, setAuth])

  const onSignIn = (user: string, pass: string) => {
    if (!user && !pass) {
      setError(new Error("username & password can not be both empty"));
      return;
    }
    setAuth(() => basicAuthorizationHeader(user, pass));
  }

  useEffect(() => fetchFiles(), [cwd, auth, ts, fetchFiles]);

  const readmeFile = useMemo(() => {
    if (isSearch) {
      return "";
    }
    for (const file of files) {
      if ((README_FILES as readonly string[]).includes(basename(file.key))) {
        return file.key;
      }
    }
    return "";
  }, [files, isSearch]);
  const [readmeStatus, setReadmeStatus] = useState<"" | "loading" | "ok" | "error">("");
  const [readmeError, setReadmeError] = useState<unknown>(null);
  const [readmeContents, setReadmeContents] = useState(""); // readme contents (html);

  const onDownloadAsZip = useCallback(() => {
    const selectedFiles = multiSelected.length > 0
      ? files.filter(file => multiSelected.includes(file.key)) : files.filter(f => !f.system);
    if (selectedFiles.length == 0) {
      return;
    }
    setDownloadAsZipFiles(selectedFiles);
  }, [files, multiSelected]);

  const fetchReadme = useCallback(async (signal?: AbortSignal) => {
    const key = readmeFile;
    if (!key) {
      return;
    }
    setReadmeStatus("loading");
    try {
      const res = await fetch(fileUrl({ auth, key, expires: config.expires }), {
        headers: {
          [HEADER_RANGE]: rangeHeader(0, 524287), // first 512KiB (524288)
        },
        signal,
      });
      if (key === readmeFile) {
        const html = await response2Html(res);
        setReadmeContents(html);
        setReadmeStatus("ok");
        setReadmeError(null);
      }
    } catch (e) {
      if (key === readmeFile) {
        setReadmeContents("");
        setReadmeStatus("error");
        setReadmeError(e);
      }
    }
  }, [auth, config.expires, readmeFile]);

  useEffect(() => {
    if (!readmeFile) {
      setReadmeContents("");
      setReadmeError(null);
      setReadmeStatus("");
      return;
    }
    const ac = new AbortController();
    void fetchReadme(ac.signal);
    return () => {
      ac.abort();
    }
  }, [fetchReadme, readmeFile]);

  useEffect(() => {
    setSlideIndex(-1);
    setShowAdminDialog(false);
    setShowProgressDialog(false);
    setShowGenerateThumbnailDialog(false);
    setEditing(null);
    setSharing("");
    setShareObject(null);
    setDownloadAsZipFiles([]);
    if (!requireSignIn) {
      setShowSignInDialog(false);
    }
  }, [location, requireSignIn]);

  return (
    <GlobalConfigContext.Provider value={globalConfig}>
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
                onDownloadAsZip={multiSelected.length === 0 && cwd != SHARES_FOLDER_KEY ? onDownloadAsZip : undefined}
                onSignnIn={() => setShowSignInDialog(true)} search={search} fetchFiles={fetchFiles}
                setSearch={setSearch} setViewMode={setViewMode}
                sort={sort} setSort={setSort}
                onGenerateThumbnails={() => setShowGenerateThumbnailDialog(true)}
                setShowProgressDialog={setShowProgressDialog}
                setShowAdminDialog={setShowAdminDialog}
                onShare={multiSelected.length === 0 && !!cwd && cwd != SHARES_FOLDER_KEY ?
                  () => setSharing(cwd) : undefined}
              />
              <PathBreadcrumb prefix={prefix} permission={permission}
                path={currentDir} searchKeyword={searchKeyword}
                isSearch={isSearch} searchOptions={searchOptions} setCwd={setCwd} setSearch={setSearch} />
              {
                cwd == SHARES_FOLDER_KEY
                  ? <ShareManager setError={setError} fetchFiles={fetchFiles} shareObject={shareObject}
                    setShareObject={setShareObject} search={search} shares={shares} loading={loading} />
                  : (isSearch && !searchKeyword)
                    ? <SearchForm searchBaseDir={searchOptions.baseDir || ""} setCwd={setCwd} setSearch={setSearch} />
                    : <Main readmeError={readmeError} readmeStatus={readmeStatus}
                      readmeContents={readmeContents} readmeFile={readmeFile} onDownloadAsZip={onDownloadAsZip}
                      editing={editing} setEditing={setEditing} slideIndex={slideIndex} setSlideIndex={setSlideIndex}
                      cwd={cwd} setCwd={setCwd} loading={loading} filter={!isSearch ? search : ""}
                      fixedOrder={searchKeyword == SEARCH_MAGIC_WORD_LARGEST
                        ? "largest" : searchKeyword == SEARCH_MAGIC_WORD_RECENT ? "recent" : ""}
                      sharing={sharing} setSharing={setSharing} setShowProgressDialog={setShowProgressDialog}
                      permission={permission} files={files} setError={setError} isSearch={isSearch} setTip={setTip}
                      multiSelected={multiSelected} setMultiSelected={setMultiSelected} fetchFiles={fetchFiles} />
              }
            </Stack>
            <Snackbar
              autoHideDuration={5000}
              open={!!error}
              message={error ? `${error}` : null}
              onClose={() => setError(null)}
            />
            <Snackbar
              autoHideDuration={5000}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              open={!!tip}
              message={tip || null}
              onClose={() => setTip("")}
            />
            <ProgressDialog
              open={showProgressDialog}
              onClose={() => setShowProgressDialog(false)}
            />
            <AdminDialog
              currentDir={currentDir}
              open={showAdminDialog}
              onClose={() => setShowAdminDialog(false)}
              setCwd={setCwd}
              setSearch={setSearch}
              setGlobalConfig={setGlobalConfig}
            />
            {showGenerateThumbnailDialog && <GenerateThumbnailsDialog open={true}
              onClose={() => setShowGenerateThumbnailDialog(false)} onDone={fetchFiles} files={thumbnailableFiles}>
            </GenerateThumbnailsDialog>}
            {downloadAsZipFiles.length > 0 && <DownloadDialog open={true} files={downloadAsZipFiles}
              onClose={() => setDownloadAsZipFiles([])} />}
            {(requireSignIn || showSignInDialog) && <SignInDialog open={true}
              onClose={requireSignIn ? undefined : () => setShowSignInDialog(false)} onSignIn={onSignIn} />}
          </TransferQueueProvider>
        </ThemeProvider>
      </ConfigContext.Provider>
    </GlobalConfigContext.Provider>
  );
}
