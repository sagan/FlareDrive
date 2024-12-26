import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Link, Typography, } from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
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
  HEADER_AUTHORIZATION, MIME_DIR, PRIVATE_URL_TTL, Permission, WEBDAV_ENDPOINT, basename, cleanPath,
  compareBoolean, compareString, fileUrl, humanReadableSize, key2Path, trimPrefixSuffix
} from "../lib/commons";
import { FileItem, ViewMode, ViewProps, dirUrlPath, downloadFile, isDirectory, isImage } from "./commons";
import FileGrid from "./FileGrid";
import FileAlbum from "./FileAlbum";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import ShareDialog from "./ShareDialog";
import { Centered } from "./components";
import { copyPaste } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import MimeIcon from "./MimeIcon";


function DropZone({ children, onDrop }: { children: React.ReactNode; onDrop: (files: FileList) => void }) {
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


function SlideRender({ slide, rect }: RenderSlideProps) {
  const lightbox = useLightboxProps();
  const { currentIndex } = useLightboxState();
  const src = (slide as { src: string }).src || ""

  const click = lightbox.on.click

  const onClick = useCallback(() => {
    if (click) {
      click({ index: currentIndex })
    }
  }, [click, currentIndex])

  if (slide.type == "image") {
    return undefined
  }
  const thumbSize = 128
  const _type = (slide as any)._type

  return <Box onClick={onClick} sx={{
    width: rect.width, height: rect.height, maxWidth: "50%", maxHeight: "50%", textAlign: "center",
    color: "white", overflow: "auto",
  }}>
    <Box sx={{ mb: 1 }}>
      <Button download variant="contained" startIcon={<DownloadIcon />} href={src} onClick={(e) => {
        e.preventDefault()
        downloadFile(src)
      }}>
        Download
      </Button>
    </Box>
    <Typography sx={{ mb: 1 }} variant="h5" component="h5">
      <Link href={src}>{slide.description}</Link>
    </Typography>
    <Box>
      {_type
        ? <MimeIcon contentType={_type} sx={{ width: thumbSize, height: thumbSize }} />
        : <img src={slide.thumbnail} width={thumbSize} height={thumbSize} />}
    </Box>
  </Box >
}

export default function Main({
  viewMode,
  cwd,
  setCwd,
  loading,
  search,
  permission,
  authed,
  auth,
  files,
  multiSelected,
  setMultiSelected,
  fetchFiles,
}: {
  viewMode: ViewMode,
  cwd: string;
  setCwd: (cwd: string) => void;
  loading: boolean;
  search: string;
  permission: Permission;
  authed: boolean;
  auth: string | null;
  files: FileItem[];
  multiSelected: string[];
  setMultiSelected: React.Dispatch<React.SetStateAction<string[]>>;
  fetchFiles: () => void;
}) {
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(""); // sharing file key

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
        }),
        type: isImage(file) ? "image" : undefined,
        thumbnail: fileUrl({
          key: file.key,
          auth,
          thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
          thumbnailContentType: file.httpMetadata.contentType,
          thumbnailColor: "white",
        }),
        title: name,
        description: `${name} (${size})`,
      });
      if (!file.customMetadata?.thumbnail) {
        // workaround: set a private property to mark this slide do not have thumbnail.
        // So slide render should display MIME icon instead.
        // @todo: A better way is to directly set MIME icon image data: url as thumbnail source.
        (slides[slides.length - 1] as any)._type = file.httpMetadata.contentType;
      }
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
        expires: (+new Date) + PRIVATE_URL_TTL
      }));
    }
  }, [multiSelected, slideIndexes, auth, permission]);

  const onContextMenu = useCallback((file: FileItem) => {
    if (file.system) {
      return
    }
    handleMultiSelect(file.key);
  }, [])

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
      <UploadDrawer auth={auth} open={showUploadDrawer} setOpen={setShowUploadDrawer} cwd={cwd} onUpload={fetchFiles} />
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
            expires: (+new Date) + PRIVATE_URL_TTL,
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
          await copyPaste((cwd ? cwd + "/" : "") + oldName, (cwd ? cwd + "/" : "") + newName, auth, true);
          fetchFiles();
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
            await copyPaste(src, dst, auth, true);
          }
          fetchFiles();
          return;
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
            await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}`, {
              method: "DELETE",
              headers: {
                ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
              },
            });
          }
          fetchFiles();
        }}
      />
      {!!sharing && <ShareDialog auth={auth} filekey={sharing} open={!!sharing} onClose={() => setSharing("")} />}
      <Lightbox
        on={{ click: toggleLightboxControls }}
        className={hideLightboxControls ? "yarl__hide-controls" : undefined}
        animation={{ fade: 0, swipe: 0, navigation: 0 }}
        index={slideIndex}
        carousel={{ finite: true }}
        open={slideIndex >= 0}
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
