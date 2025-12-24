import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Link, Paper, Typography, } from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import Lightbox, {
  Callbacks, RenderSlideProps, ShareFunctionProps, SlideImage, useLightboxProps, useLightboxState
} from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Share from "yet-another-react-lightbox/plugins/share";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import {
  TOKEN_VARIABLE, SCOPE_VARIABLE, EXPIRES_VARIABLE, MIME_DIR, MIME_PDF, MIME_MARKDOWN, HTML_VARIABLE, MIME_URL,
  Permission, basename, cleanPath, compareBoolean, compareString, fileUrl, humanReadableSize,
  trimPrefixSuffix, str2int, dirname, extname, appendQueryStringToUrl, isDirectory, isImage,
  isUrlFile,
  validateAndGetSafeUrl,
  isAudio,
  MIME_DOCX,
} from "../lib/commons";
import {
  EDIT_FILE_SIZE_LIMIT,
  EditingItem,
  FileItem, FileViewerProps, Sort, ViewMode, ViewProps, downloadFile, getTransferFiles, isTextual, useConfig,
} from "./commons";
import FileGrid from "./FileGrid";
import FileAlbum from "./FileAlbum";
import FileDetailsList from "./FileDetailsList";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import ShareDialog from "./ShareDialog";
import { Centered } from "./components";
import { copyPaste, deleteFile, prepareUploadFiles } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import MimeIcon from "./MimeIcon";
import EditorDialog from "./EditorDialog";
import PdfDialog from "./PdfDialog";
import ImageEditorDialog from "./ImageEditorDialog";
import UrlFileEditorDialog from "./UrlFileEditorDialog";
import DocxDialog from "./DocxDialog";

function DropZone({ disabled, children, onDrop }:
  { disabled: boolean, children: React.ReactNode; onDrop: (files: Record<string, File>) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      id="drop-zone"
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        backgroundColor: (theme) => theme.palette.background.default,
        filter: dragging ? "brightness(0.9)" : "none",
        transition: "filter 0.2s",
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled) {
          return;
        }
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        if (disabled) {
          return;
        }
        getTransferFiles(event.dataTransfer.items).then(files => {
          onDrop(files);
        }).catch((e) => {
          console.log(`failed to get files to upload: ${e}`);
        });
        setDragging(false);
      }}
    >
      {children}
    </Box>
  );
}

type SlidesExtendedCallbacks = Callbacks & { edit: (file: FileItem) => void }

function SlideRender({ slide, rect }: RenderSlideProps) {
  const lightbox = useLightboxProps();
  const { currentIndex } = useLightboxState();
  const src = (slide as { src: string }).src || ""

  const click = lightbox.on.click
  const { edit } = lightbox.on as SlidesExtendedCallbacks

  const onClick = useCallback(() => {
    if (click) {
      click({ index: currentIndex })
    }
  }, [click, currentIndex])

  if (slide.type == "image") {
    return undefined
  }
  const thumbSize = 128
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const file: FileItem = (slide as any)._file

  let viewSrc = src
  if (src && file.httpMetadata.contentType == MIME_MARKDOWN) {
    viewSrc = appendQueryStringToUrl(viewSrc, HTML_VARIABLE + "=1")
  } else if (file.httpMetadata.contentType === MIME_URL && file.customMetadata?.url) {
    viewSrc = validateAndGetSafeUrl(file.customMetadata.url)
  }

  return <Box onClick={onClick} sx={{
    width: rect.width, height: rect.height, maxWidth: "50%", maxHeight: "50%", textAlign: "center",
    color: "white", overflow: "auto",
  }}>
    <Box sx={{ mb: 1 }}>
      <Button sx={{ m: 1 }} download variant="contained" startIcon={<DownloadIcon />} href={src} onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        downloadFile(src);
      }}>
        Download
      </Button>
      {(file.size <= EDIT_FILE_SIZE_LIMIT && isTextual(file) || file.httpMetadata.contentType === MIME_PDF
        || file.httpMetadata.contentType === MIME_DOCX) && <Button
          variant="contained" color="secondary" startIcon={<FileOpenIcon />} onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            edit(file);
          }}>
          Open
        </Button>
      }
    </Box>
    <Typography sx={{ mb: 1 }} variant="h5" component="h5">
      <Link href={viewSrc} onClick={e => {
        e.stopPropagation();
      }}>{slide.description}</Link>
    </Typography>
    <Box>
      {isAudio(file) ? <>
        <MimeIcon contentType={file.httpMetadata.contentType} sx={{ width: 54, height: 54 }} />
        <audio controls src={viewSrc} key={currentIndex} />
      </> : <>
        {!file.customMetadata?.thumbnail
          ? <MimeIcon contentType={file.httpMetadata.contentType} sx={{ width: thumbSize, height: thumbSize }} />
          : <img src={slide.thumbnail} width={thumbSize} height={thumbSize} />}
      </>
      }
    </Box>
  </Box >
}

export default function Main({
  readmeError,
  readmeStatus,
  readmeFile,
  readmeContents,
  isSearch,
  cwd,
  setCwd,
  loading,
  filter,
  permission,
  files,
  sharing,
  editing,
  slideIndex,
  onDownloadAsZip,
  setEditing,
  setSlideIndex,
  setTip,
  setSharing,
  setShowProgressDialog,
  multiSelected,
  setMultiSelected,
  fetchFiles,
  setError,
}: {
  readmeError: unknown;
  readmeStatus: "" | "loading" | "ok" | "error";
  readmeFile: string;
  readmeContents: string;
  isSearch: boolean;
  cwd: string;
  loading: boolean;
  filter: string;
  permission: Permission;
  files: FileItem[];
  sharing: string;
  multiSelected: string[];
  editing: EditingItem | null;
  slideIndex: number;
  onDownloadAsZip: () => void;
  setEditing: React.Dispatch<React.SetStateAction<EditingItem | null>>;
  setSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  setTip: React.Dispatch<React.SetStateAction<string>>;
  setCwd: (cwd: string) => void;
  setSharing: React.Dispatch<React.SetStateAction<string>>;
  setShowProgressDialog: React.Dispatch<React.SetStateAction<boolean>>,
  setMultiSelected: React.Dispatch<React.SetStateAction<string[]>>;
  fetchFiles: () => void;
  setError: React.Dispatch<React.SetStateAction<unknown>>;
}) {
  const { auth, effectiveAuth, authSearchParams, sort, viewMode, expires, fullControl } = useConfig()
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  // const [editing, setEditing] = useState<string | null>(null); // text editing file key
  // const [displayedPdf, setDisplayedPdf] = useState<string | null>(null);
  // const [editingImage, setEditingImage] = useState<string | null>(null);
  // const [editingUrl, setEditingUrl] = useState<FileItem | null>(null);
  const [transferQueue] = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

  useEffect(() => {
    if (!transferQueue.length) {
      return;
    }
    const lastFile = transferQueue[transferQueue.length - 1];
    if (["pending", "in-progress"].includes(lastFile.status)) {
      setLastUploadKey(lastFile.remoteKey);
    } else if (lastUploadKey) {
      fetchFiles();
      setLastUploadKey(null);
    }
  }, [cwd, fetchFiles, lastUploadKey, transferQueue]);

  const uploadingTasksCnt = transferQueue.length;
  const uploadingTasksUnfinishedCnt = transferQueue.filter(a => ["pending", "in-progress", "failed"].includes(a.status)).length;

  const filteredFiles = useMemo(
    () =>
      (filter ? files.filter((file) => (file.name || file.key).toLowerCase().includes(filter.toLowerCase())) : files)
        .sort((a, b) => compareBoolean(!a.system, !b.system) ||
          compareBoolean(!isDirectory(a), !isDirectory(b)) || (
            sort === Sort.ByDate ? +a.uploaded - +b.uploaded
              : sort === Sort.BySize ? a.size - b.size
                : compareString(a.key, b.key)
          )),
    [files, filter, sort]
  );

  const handleMultiSelect = useCallback((key: string, source?: "" | "context" | "click") => {
    setMultiSelected((multiSelected) => {
      if (multiSelected.length == 0 || multiSelected.length == 1 && source === "context") {
        return [key];
      } else if (multiSelected.includes(key)) {
        const newSelected = multiSelected.filter((k) => k !== key);
        return newSelected.length ? newSelected : [];
      }
      return [...multiSelected, key];
    });
  }, [setMultiSelected]);

  const handleShiftSelect = useCallback((key: string) => {
    setMultiSelected(multiSelected => {
      if (multiSelected.length === 0) {
        return [key];
      }
      const lastSelected = multiSelected[multiSelected.length - 1];
      const lastSelectedIndex = filteredFiles.findIndex(file => file.key === lastSelected);
      const currentSelectedIndex = filteredFiles.findIndex(file => file.key === key);

      if (lastSelectedIndex === -1 || currentSelectedIndex === -1) {
        return [...multiSelected, key];
      }

      const start = Math.min(lastSelectedIndex, currentSelectedIndex);
      const end = Math.max(lastSelectedIndex, currentSelectedIndex);

      const newSelectedKeys: string[] = [];
      for (let i = start; i <= end; i++) {
        const file = filteredFiles[i];
        if (file && !file.system && !multiSelected.includes(file.key)) {
          newSelectedKeys.push(file.key);
        }
      }

      // Use a Set to remove duplicates while preserving order as much as possible
      const combinedKeys = [...new Set([...multiSelected, ...newSelectedKeys, key])];

      // Filter out any keys that are no longer within the start and end indices
      const result = combinedKeys.filter(key => {
        return (start <= filteredFiles.findIndex(file => file.key === key)
          && filteredFiles.findIndex(file => file.key === key) <= end)
          || multiSelected.includes(key);
      });
      return result;
    })
  }, [setMultiSelected, filteredFiles]);

  // Hide lightbox controls on tap.
  // https://github.com/igordanchenko/yet-another-react-lightbox/issues/78
  const [hideLightboxControls, setHideLightboxControls] = React.useState(false);

  const { slides, slideIndexes } = useMemo(() => {
    const slides: SlideImage[] = [];
    const slideIndexes: Record<string, number> = {};
    for (const file of files) {
      if (isDirectory(file)) {
        continue;
      }
      const name = basename(file.key);
      const size = humanReadableSize(file.size);
      slideIndexes[file.key] = slides.length;
      slides.push({
        src: fileUrl({
          key: file.key,
          auth,
          expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
          scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
          token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
          fullControl: auth ? undefined : fullControl,
        }),
        type: isImage(file) ? "image" : undefined,
        thumbnail: fileUrl({
          key: file.key,
          auth,
          thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
          thumbnailContentType: file.httpMetadata.contentType,
          thumbnailColor: "white",
          expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
          scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
          token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
          fullControl: auth ? undefined : fullControl,
        }),
        title: name,
        description: `${name} (${size})`,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (slides[slides.length - 1] as any)._file = file;
    }
    return { slides, slideIndexes };
  }, [auth, authSearchParams, expires, files, fullControl]);

  const toggleLightboxControls = useCallback(() => setHideLightboxControls((state) => !state), []);

  const onClick = useCallback((file: FileItem, event?: React.MouseEvent) => {
    if (event?.shiftKey && multiSelected.length > 0 && !file.system) {
      // Shift key pressed
      handleShiftSelect(file.key);
    } else if (multiSelected.length > 0) {
      if (file.system) {
        return;
      }
      handleMultiSelect(file.key);
    } else if (isDirectory(file)) {
      setCwd(file.key + "/");
    } else if (slideIndexes[file.key] !== undefined) {
      setSlideIndex(slideIndexes[file.key]);
    } else {
      downloadFile(fileUrl({
        key: file.key,
        auth,
        expires,
      }));
    }
  }, [multiSelected.length, slideIndexes, handleShiftSelect, handleMultiSelect, setCwd, setSlideIndex, auth, expires]);

  const onContextMenu = useCallback((file: FileItem) => {
    if (file.system) {
      return;
    }
    handleMultiSelect(file.key, "context");
  }, [handleMultiSelect]);

  //  Record<string, SlideCallback>
  const lightboxCallbacks: SlidesExtendedCallbacks = {
    click: toggleLightboxControls,
    // custom callbacks:
    edit: (file) => {
      if (file.httpMetadata.contentType === MIME_PDF) {
        setEditing({ file, key: file.key, kind: "pdf" });
      } else if (file.httpMetadata.contentType === MIME_DOCX) {
        setEditing({ file, key: file.key, kind: "docx" });
      } else if (isUrlFile(file) && (file.customMetadata?.url || file.size === 0)) {
        setEditing({ file, key: file.key, kind: "url" });
      } else if (isTextual(file)) {
        setEditing({ file, key: file.key, kind: "text" });
      } else if (isImage(file)) {
        setEditing({ file, key: file.key, kind: "image" });
      } else {
        setError(`View of ${file.httpMetadata.contentType} type file is not supported`)
        return
      }
      setSlideIndex(-1);
      setSharing("");
    }
  };

  const viewProps: ViewProps = {
    isSearch,
    files: filteredFiles,
    onClick,
    onContextMenu,
    multiSelected,
    emptyMessage: <Centered>No files or folders</Centered>,
  };
  const viewElement = <Box sx={{ overflow: "auto", flex: 1 }}>
    {viewMode === ViewMode.Details ? <FileDetailsList {...viewProps} />
      : viewMode === ViewMode.Album ? <FileAlbum {...viewProps} />
        : <FileGrid {...viewProps} />}
    {!!readmeFile && <Paper elevation={3} sx={{ m: 1, p: 1 }}>
      <Typography component={"h3"} sx={{ display: "flex", justifyContent: "space-between" }}>
        <span>{readmeFile}</span>
        <CircularProgress sx={{ visibility: readmeStatus === "loading" ? "visible" : "hidden" }}
          size={16} />
      </Typography>
      {
        readmeStatus === "error"
          ? <Typography>Failed to load: {`${readmeError}`}</Typography>
          : <Box dangerouslySetInnerHTML={{ __html: readmeContents }} />
      }
    </Paper>}
  </Box>;
  const sharingFile = useMemo(() => {
    return sharing ? (sharing === cwd ? getDirObj(cwd) : files.find(f => f.key === sharing)) : undefined
  }, [sharing, cwd, files]);

  const permitWrite = !isSearch && (!!auth || (effectiveAuth ? fullControl : permission == Permission.OpenRwDir));

  const renderEditingDialog = useCallback(() => {
    if (!editing) {
      return null;
    }
    const fileViewerProps: FileViewerProps = {
      filekey: editing.key,
      open: true,
      setError,
      close: () => {
        setEditing(null);
      },
    };
    switch (editing.kind) {
      case "docx":
        return <DocxDialog  {...fileViewerProps} />;
      case "pdf":
        return <PdfDialog  {...fileViewerProps} />;
      case "image":
        return <ImageEditorDialog {...fileViewerProps} />;
      case "url":
        return <UrlFileEditorDialog  {...fileViewerProps}
          url={editing.file?.customMetadata?.url || ""}
          comment={editing.file?.customMetadata?.comment || ""}
          open={true} readonly={!permitWrite}
          close={() => setEditing(null)} onUpload={fetchFiles} />;
      default:
        return <EditorDialog  {...fileViewerProps} />;
    }
  }, [editing, setError, setEditing, permitWrite, fetchFiles]);

  const onRename = async () => {
    const oldName = basename(multiSelected[0]);
    const newName = window.prompt("Rename to:", oldName);
    if (!newName || oldName === newName) {
      return;
    }
    try {
      await copyPaste((cwd ? cwd + "/" : "") + oldName, (cwd ? cwd + "/" : "") + newName, effectiveAuth, true);
      fetchFiles();
    } catch (e) {
      setError(e);
    }
  };

  const onDuplicate = async () => {
    const newkey = prompt(`Create a copy of "${multiSelected[0]}" at path`,
      getDuplicateName(multiSelected[0], files));
    if (!newkey) {
      return;
    }
    try {
      await copyPaste(multiSelected[0], newkey, effectiveAuth, false);
      fetchFiles();
    } catch (e) {
      setError(e);
    }
  };

  const onMove = async () => {
    const dir = cwd || "/";
    let newdir = window.prompt(`Move files to dir (enter "/" to move to root dir):`, dir);
    if (!newdir) {
      return;
    }
    newdir = cleanPath(newdir);
    if (newdir == dir) {
      return;
    }
    if (!newdir.endsWith("/")) {
      newdir += "/"
    }
    for (const file of multiSelected) {
      const name = basename(file);
      const src = (cwd ? cwd + "/" : "") + name;
      const dst = trimPrefixSuffix(newdir + name, "/");
      try {
        await copyPaste(src, dst, effectiveAuth, true);
      } catch (e) {
        setError(e);
      }
    }
    fetchFiles();
  };

  const onDelete = async () => {
    if (multiSelected.length == 0) {
      return;
    }
    const filenames = multiSelected.map((key) => key.replace(/\/$/, "").split("/").pop()).join("\n");
    const confirmMessage = `Delete the following ${multiSelected.length} file(s) permanently?\n${filenames}`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    for (const key of multiSelected) {
      try {
        await deleteFile(key, effectiveAuth)
      } catch (e) {
        setError(e);
      }
    }
    fetchFiles();
  };

  const [preparingUploads, setPreparingUploads] = useState(false);

  const doUpload = useCallback((files: Record<string, File>) => {
    if (!effectiveAuth) {
      return;
    }
    const cnt = Object.keys(files).length;
    if (cnt == 0) {
      return;
    }
    setTip(`Uploading ${cnt} files`);
    prepareUploadFiles(cwd, files, effectiveAuth).then(uploads => {
      uploadEnqueue(...uploads);
      setShowProgressDialog(true);
    }, setError);
  }, [cwd, effectiveAuth, setError, setShowProgressDialog, setTip, uploadEnqueue]);

  useEffect(() => {
    const handle = (event: ClipboardEvent) => {
      if (preparingUploads || !permitWrite) {
        return;
      }
      setPreparingUploads(true);
      // Get the items from the clipboard, event.clipboardData can be null
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }
      setTip(`Preparing clipboard items for uploading`);
      getTransferFiles(items).then(files => {
        if (Object.keys(files).length === 0) {
          setTip(`Clipboard contains no files`);
          return;
        }
        doUpload(files);
      }, err => {
        setError(`Failed to get files from clipboard: ${err}`);
      }).finally(() => {
        setPreparingUploads(false);
      });
    }
    window.addEventListener("paste", handle);
    return () => {
      window.removeEventListener("paste", handle);
    }
  }, [doUpload, permitWrite, preparingUploads, setError, setTip]);

  return (
    <>
      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone disabled={!permitWrite} onDrop={doUpload}>
          {viewElement}
        </DropZone>
      )}
      {permitWrite && multiSelected.length == 0 && <UploadFab uploadingTasksCnt={uploadingTasksCnt}
        uploadingTasksUnfinishedCnt={uploadingTasksUnfinishedCnt} onClick={() => setShowUploadDrawer(true)} />}
      <UploadDrawer open={showUploadDrawer} setError={setError} setShowProgressDialog={setShowProgressDialog}
        uploadingTasksCnt={uploadingTasksCnt} uploadingTasksUnfinishedCnt={uploadingTasksUnfinishedCnt}
        onStartUpload={() => setShowProgressDialog(true)}
        setOpen={setShowUploadDrawer} cwd={cwd} onUpload={(created) => {
          fetchFiles();
          if (created) {
            setEditing({ key: created, kind: "text" });
          }
        }} />
      <MultiSelectToolbar writable={permitWrite} multiSelected={multiSelected} isSearch={isSearch}
        onOpenDir={(key: string) => setCwd(key)}
        onDownloadAsZip={onDownloadAsZip}
        getLink={(key: string) => {
          const file = files.find(f => f.key === key);
          const isDir = !!file && isDirectory(file)
          return [fileUrl({
            key,
            auth,
            isDir,
            raw: true,
            origin: location.origin,
            expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
            scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
            token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
            fullControl: auth ? undefined : fullControl,
          }), isDir];
        }}
        onSelectAll={() => {
          const selects: string[] = []
          files.forEach(file => {
            if (file.system) {
              return
            }
            selects.push(file.key)
          })
          setMultiSelected(selects)
        }}
        onInvertSelection={() => {
          setMultiSelected(multiSelected => {
            if (multiSelected.length === 0) {
              return files.filter(file => !file.system).map(file => file.key);
            }
            return files.filter(file => !file.system && !multiSelected.includes(file.key)).map(file => file.key);
          });
        }}
        onShare={setSharing}
        onClose={() => setMultiSelected([])}
        onRename={() => void onRename()}
        onDuplicate={() => void onDuplicate()}
        onMove={() => void onMove()}
        onDelete={() => void onDelete()}
      />
      {!!sharingFile && <ShareDialog setSlideIndex={setSlideIndex} setError={setError} file={sharingFile} open={true}
        onClose={() => setSharing("")} onEdit={() => lightboxCallbacks.edit(sharingFile)} />}
      {renderEditingDialog()}
      <Lightbox
        on={lightboxCallbacks}
        className={hideLightboxControls ? "yarl__hide-controls" : undefined}
        animation={{ fade: 0, swipe: 250, navigation: 0 }}
        index={slideIndex}
        carousel={{ finite: true }}
        open={slideIndex >= 0}
        close={() => setSlideIndex(-1)}
        slides={slides}
        render={{ slide: SlideRender }}
        plugins={[Captions, Counter, Fullscreen, Thumbnails, Video, Share, Download, Slideshow, Zoom]}
        share={{
          share: ({ slide }: ShareFunctionProps) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const file: FileItem = (slide as any)._file
            setSharing(file.key)
            // setSlideIndex(-1)
          }
        }}
      />
    </>
  );
}

function getDuplicateName(filekey: string, files: FileItem[]): string {
  const dir = dirname(filekey);
  const filename = basename(filekey);
  const ext = extname(filename);
  let base = filename.slice(0, filename.length - ext.length);
  let i = 1;
  const match = base.match(/^(.*) \((\d+)\)$/);
  if (match) {
    base = match[1];
    i = str2int(match[2]) + 1;
  }
  while (true) {
    const newkey = `${dir ? dir + "/" : ""}${base} (${i})${ext}`
    if (!files.find(a => a.key === newkey)) {
      return newkey;
    }
    i++;
  }
}

function getDirObj(key: string): FileItem {
  return {
    key,
    size: 0,
    uploaded: new Date(0),
    checksums: {},
    httpMetadata: { contentType: MIME_DIR },
  };
}
