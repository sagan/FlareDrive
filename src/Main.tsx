import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Link, Typography, } from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import Lightbox, { RenderSlideProps, SlideImage, useLightboxProps, useLightboxState } from "yet-another-react-lightbox";
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
  HEADER_AUTHORIZATION, MIME_DIR, Permission, WEBDAV_ENDPOINT, basename, cleanPath,
  compareBoolean, compareString, fileUrl, humanReadableSize, key2Path, trimPrefixSuffix, dirUrlPath
} from "../lib/commons";
import {
  EDIT_FILE_SIZE_LIMIT, FileItem, ViewMode, ViewProps, downloadFile,
  isDirectory, isImage, isTextual, useConfig
} from "./commons";
import FileGrid from "./FileGrid";
import FileAlbum from "./FileAlbum";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import ShareDialog from "./ShareDialog";
import { Centered } from "./components";
import { copyPaste } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import MimeIcon from "./MimeIcon";
import EditorDialog from "./EditorDialog";


function DropZone({ children, onDrop }: { children: React.ReactNode; onDrop: (files: FileList) => void }) {
  const { expires } = useConfig();
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        backgroundColor: (theme) => theme.palette.background.default,
        filter: dragging ? "brightness(0.9)" : "none",
        transition: "filter 0.2s",
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files);
        setDragging(false);
      }}
    >
      {children}
    </Box>
  );
}

type SlideCallback = ({ index, key }: { index: number, key: string }) => void;


function SlideRender({ slide, rect }: RenderSlideProps) {
  const lightbox = useLightboxProps();
  const { currentIndex } = useLightboxState();
  const src = (slide as { src: string }).src || ""

  const click = lightbox.on.click
  const edit = (lightbox.on as Record<string, SlideCallback>).edit

  const onClick = useCallback(() => {
    if (click) {
      click({ index: currentIndex })
    }
  }, [click, currentIndex])

  if (slide.type == "image") {
    return undefined
  }
  const thumbSize = 128
  const file: FileItem = (slide as any)._file

  return <Box onClick={onClick} sx={{
    width: rect.width, height: rect.height, maxWidth: "50%", maxHeight: "50%", textAlign: "center",
    color: "white", overflow: "auto",
  }}>
    <Box sx={{ mb: 1 }}>
      <Button sx={{ m: 1 }} download variant="contained" startIcon={<DownloadIcon />} href={src} onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        downloadFile(src)
      }}>
        Download
      </Button>
      {file.size <= EDIT_FILE_SIZE_LIMIT && isTextual(file) && <Button
        variant="contained" color="secondary" startIcon={<FileOpenIcon />} onClick={(e) => {
          e.stopPropagation();
          e.preventDefault()
          edit({ index: currentIndex, key: file.key })
        }}>
        Open
      </Button>
      }
    </Box>
    <Typography sx={{ mb: 1 }} variant="h5" component="h5">
      <Link href={src} onClick={e => {
        e.stopPropagation()
      }}>{slide.description}</Link>
    </Typography>
    <Box>
      {!file.customMetadata?.thumbnail
        ? <MimeIcon contentType={file.httpMetadata.contentType} sx={{ width: thumbSize, height: thumbSize }} />
        : <img src={slide.thumbnail} width={thumbSize} height={thumbSize} />}
    </Box>
  </Box >
}

export default function Main({
  cwd,
  setCwd,
  loading,
  search,
  permission,
  files,
  multiSelected,
  setMultiSelected,
  fetchFiles,
  setError,
}: {
  cwd: string;
  setCwd: (cwd: string) => void;
  loading: boolean;
  search: string;
  permission: Permission;
  files: FileItem[];
  multiSelected: string[];
  setMultiSelected: React.Dispatch<React.SetStateAction<string[]>>;
  fetchFiles: () => void;
  setError: React.Dispatch<React.SetStateAction<any>>;
}) {
  const { auth, viewMode, expires } = useConfig()
  const authed = !!auth
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(""); // sharing file key
  const [editing, setEditing] = useState<string | null>(null); // text editing file key

  const transferQueue = useTransferQueue();
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

  const filteredFiles = useMemo(
    () =>
      (search ? files.filter((file) => (file.name || file.key).toLowerCase().includes(search.toLowerCase())) : files)
        .sort((a, b) => compareBoolean(!a.system, !b.system) ||
          compareBoolean(!isDirectory(a), !isDirectory(b)) || compareString(a.key, b.key)),
    [files, search]
  );

  const handleMultiSelect = useCallback((key: string) => {
    setMultiSelected((multiSelected) => {
      if (multiSelected.length == 0) {
        return [key];
      } else if (multiSelected.includes(key)) {
        const newSelected = multiSelected.filter((k) => k !== key);
        return newSelected.length ? newSelected : [];
      }
      return [...multiSelected, key];
    });
  }, []);

  const [slideIndex, setSlideIndex] = useState(-1);

  // Hide lightbox controls on tap.
  // https://github.com/igordanchenko/yet-another-react-lightbox/issues/78
  const [hideLightboxControls, setHideLightboxControls] = React.useState(false);

  const { slides, slideIndexes } = useMemo(() => {
    const slides: SlideImage[] = []
    const slideIndexes: Record<string, number> = {}
    for (const file of files) {
      if (isDirectory(file)) {
        continue
      }
      const name = basename(file.key)
      const size = humanReadableSize(file.size)
      slideIndexes[file.key] = slides.length
      slides.push({
        src: fileUrl({
          key: file.key,
          auth: auth && permission == Permission.RequireAuth ? auth : "",
          expires,
        }),
        type: isImage(file) ? "image" : undefined,
        thumbnail: fileUrl({
          key: file.key,
          auth,
          expires,
          thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
          thumbnailContentType: file.httpMetadata.contentType,
          thumbnailColor: "white",
        }),
        title: name,
        description: `${name} (${size})`,
      });
      (slides[slides.length - 1] as any)._file = file
    }
    return { slides, slideIndexes };
  }, [files])

  const toggleLightboxControls = useCallback(() => setHideLightboxControls((state) => !state), [])

  const onClick = useCallback((file: FileItem) => {
    if (multiSelected.length > 0) {
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
        auth: auth && permission == Permission.RequireAuth ? auth : "",
        expires,
      }));
    }
  }, [multiSelected, slideIndexes, auth, permission]);

  const onContextMenu = useCallback((file: FileItem) => {
    if (file.system) {
      return
    }
    handleMultiSelect(file.key);
  }, [])

  const lightboxCallbacks: Record<string, SlideCallback> = {
    click: toggleLightboxControls,
    edit: ({ key }) => {
      setSlideIndex(-1)
      setEditing(key)
    }, // custom callback
  }

  const viewProps: ViewProps = {
    auth,
    files: filteredFiles,
    onClick,
    onContextMenu,
    multiSelected,
    emptyMessage: <Centered>No files or folders</Centered>,
  }
  const viewElement = viewMode === ViewMode.Default ? <FileGrid {...viewProps} />
    : <FileAlbum {...viewProps} />

  return (
    <>
      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone
          onDrop={async (files) => {
            uploadEnqueue(...Array.from(files).map((file) => ({ file, basedir: cwd })));
          }}
        >
          {viewElement}
        </DropZone>
      )}
      {authed && multiSelected.length == 0 && <UploadFab onClick={() => setShowUploadDrawer(true)} />}
      <UploadDrawer open={showUploadDrawer} permission={permission} setError={setError}
        setOpen={setShowUploadDrawer} cwd={cwd} onUpload={(created) => {
          fetchFiles();
          if (created) {
            setEditing(created)
          }
        }} />
      <MultiSelectToolbar
        readonly={!authed}
        multiSelected={multiSelected}
        getLink={(key: string) => {
          const file = files.find(f => f.key === key);
          if (file && isDirectory(file)) {
            return [`${location.origin}${dirUrlPath(key)}`, true];
          }
          return [fileUrl({
            key,
            auth: auth && permission == Permission.RequireAuth ? auth : "",
            expires,
            origin: location.origin,
          }), false];
        }}
        onShare={(key: string) => {
          const file = files.find(f => f.key === key)
          setSharing(key + (file?.httpMetadata.contentType === MIME_DIR ? "/" : ""))
        }}
        onClose={() => setMultiSelected([])}
        onRename={async () => {
          const oldName = basename(multiSelected[0]);
          const newName = window.prompt("Rename to:", oldName);
          if (!newName || oldName === newName) {
            return;
          }
          try {
            await copyPaste((cwd ? cwd + "/" : "") + oldName, (cwd ? cwd + "/" : "") + newName, auth, true);
            fetchFiles();
          } catch (e) {
            setError(e)
          }
        }}
        onMove={async () => {
          let dir = cwd || "/";
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
              await copyPaste(src, dst, auth, true);
            } catch (e) {
              setError(e)
            }
          }
          fetchFiles();
        }}
        onDelete={async () => {
          if (multiSelected.length == 0) {
            return;
          }
          const filenames = multiSelected.map((key) => key.replace(/\/$/, "").split("/").pop()).join("\n");
          const confirmMessage = "Delete the following file(s) permanently?";
          if (!window.confirm(`${confirmMessage}\n${filenames}`)) {
            return;
          }
          for (const key of multiSelected) {
            try {
              await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}`, {
                method: "DELETE",
                headers: {
                  ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
                },
              });
            } catch (e) {
              setError(e)
            }
          }
          fetchFiles();
        }}
      />
      {!!sharing && <ShareDialog filekey={sharing} open={true} onClose={() => setSharing("")} />}
      {editing !== null && <EditorDialog filekey={editing} open={true}
        setError={setError} close={() => setEditing(null)} />}
      <Lightbox
        on={lightboxCallbacks}
        className={hideLightboxControls ? "yarl__hide-controls" : undefined}
        animation={{ fade: 0, swipe: 250, navigation: 0 }}
        index={slideIndex}
        carousel={{ finite: true }}
        open={slideIndex >= 0 && editing === null}
        close={() => setSlideIndex(-1)}
        slides={slides}
        render={{ slide: SlideRender }}
        plugins={[Captions, Counter, Fullscreen, Slideshow, Thumbnails, Video, Zoom, Download,
          ...(permission === Permission.OpenDir || permission === Permission.OpenFile ? [Share] : []),
        ]}
      />
    </>
  );
}
