import React, { useMemo, useState } from "react";
import DownloadIcon from '@mui/icons-material/Download';
import Lightbox, { ContainerRect, Slide, SlideImage } from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import {
  Box,
  Button,
  Grid,
  Link,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { fileUrl, humanReadableSize, MIME_DIR, basename, PRIVATE_URL_TTL, Permission } from "../lib/commons";

export interface FileItem {
  /**
   * system (special) folder
   */
  system?: boolean;
  /**
   * Alternative display name for system folder
   */
  name?: string;
  /**
   * Icon for system folder
   */
  icon?: React.FunctionComponent;

  key: string;
  size: number;
  uploaded: string;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
}

export function isDirectory(file: FileItem) {
  return file.httpMetadata?.contentType === MIME_DIR;
}

export function isThumbnailPossible(file: FileItem) {
  const ct = file.httpMetadata?.contentType;
  return ct && (ct.startsWith("image/") || ct === "video/mp4" || ct === "application/pdf")
}

export function isImage(file: FileItem): boolean {
  return file.httpMetadata.contentType?.startsWith("image/")
}

function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = ""
  a.click();
}

function SlideRender({ slide, rect }: { slide: Slide; offset: number; rect: ContainerRect }) {
  if (slide.type == "image") {
    return undefined
  }

  const src = (slide as { src: string }).src || ""

  return <Box sx={{
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
      <img src={slide.thumbnail} width={128} height={128} />
    </Box>
  </Box >
}

function FileGrid({
  permission,
  auth,
  files,
  onCwdChange,
  multiSelected,
  onMultiSelect,
  emptyMessage,
}: {
  permission: Permission;
  auth: string | null;
  files: FileItem[];
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[];
  onMultiSelect: (key: string) => void;
  emptyMessage?: React.ReactNode;
}) {
  const [slideIndex, setSlideIndex] = useState(-1);

  const now = +new Date

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
          expires: now + PRIVATE_URL_TTL
        }),
        type: isImage(file) ? "image" : undefined,
        thumbnail: fileUrl({
          key: file.key,
          auth,
          expires: now + PRIVATE_URL_TTL,
          thumbnailColor: "white",
          thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
        }),
        title: name,
        description: `${name} (${size})`,
      })
    }
    return { slides, slideIndexes };
  }, [files])

  if (files.length === 0) {
    return emptyMessage
  }

  return <>
    <Grid container sx={{ paddingBottom: "48px" }}>
      {files.map((file) => {
        const IconComponent = file.icon
        return <Grid item key={file.key} xs={12} sm={6} md={4} lg={3} xl={2}>
          <ListItemButton
            selected={multiSelected.includes(file.key)}
            onClick={() => {
              if (multiSelected.length > 0) {
                if (file.system) {
                  return;
                }
                onMultiSelect(file.key);
              } else if (isDirectory(file)) {
                onCwdChange(file.key + "/");
              } else if (slideIndexes[file.key] !== undefined) {
                setSlideIndex(slideIndexes[file.key]);
              } else {
                downloadFile(fileUrl({
                  key: file.key,
                  auth: auth && permission == Permission.RequireAuth ? auth : "",
                  expires: now + PRIVATE_URL_TTL
                }));
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (file.system) {
                return
              }
              onMultiSelect(file.key);
            }}
            sx={{ userSelect: "none" }}
          >
            <ListItemIcon>
              {(file.customMetadata?.thumbnail ? (
                <img src={fileUrl({
                  key: file.key,
                  auth: auth,
                  expires: now + PRIVATE_URL_TTL,
                  thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
                })}
                  alt={file.key} style={{ width: 36, height: 36, objectFit: "cover" }} />
              ) : (
                IconComponent ? <IconComponent /> : <MimeIcon contentType={file.httpMetadata.contentType} />))}
            </ListItemIcon>
            <ListItemText
              primary={file.name || basename(file.key)}
              primaryTypographyProps={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              secondary={
                <>
                  <span style={{
                    display: "inline-block",
                    minWidth: "160px",
                    marginRight: 1,
                  }}>
                    {file.system ? file.key : new Date(file.uploaded).toLocaleString()}
                  </span>
                  {!isDirectory(file) && humanReadableSize(file.size)}
                </>
              }
            />
          </ListItemButton>
        </Grid>
      })}
    </Grid>
    <Lightbox
      animation={{ fade: 0, swipe: 0, navigation: 0 }}
      index={slideIndex}
      carousel={{ finite: true }}
      open={slideIndex >= 0}
      close={() => setSlideIndex(-1)}
      slides={slides}
      render={{ slide: SlideRender }}
      plugins={[Captions, Counter, Fullscreen, Slideshow, Thumbnails, Video, Zoom, Download]}
    />
  </>
}

export default FileGrid;
