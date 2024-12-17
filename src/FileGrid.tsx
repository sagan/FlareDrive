import React, { useState } from "react";
import Lightbox, { SlideImage } from "yet-another-react-lightbox";
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
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { fileurl, extname, humanReadableSize, KEY_PREFIX_THUMBNAIL, MIME_DIR, WEBDAV_ENDPOINT, basename } from "../lib/commons";

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

function isImage(file: FileItem): boolean {
  return file.httpMetadata.contentType?.startsWith("image/")
}

function thumburl(file: FileItem, auth: string | null): string {
  return `${WEBDAV_ENDPOINT}${KEY_PREFIX_THUMBNAIL}${file.customMetadata?.thumbnail || ""}`
    + `?ext=${encodeURIComponent(extname(file.key))}`
    + `${auth ? "&auth=" + encodeURIComponent(auth) : ""}`
}


function getSlides(files: FileItem[], auth: string | null, startkey: string): SlideImage[] {
  let index = files.findIndex(f => f.key === startkey);
  const slides: SlideImage[] = []
  for (let i = index; i < files.length; i++) {
    handle(files[i]);
  }
  for (let i = 0; i < index; i++) {
    handle(files[i]);
  }
  return slides;

  function handle(file: FileItem) {
    if (isImage(file)) {
      slides.push({
        src: fileurl(file.key, auth),
        thumbnail: thumburl(file, auth),
      })
    }
  }
}

function FileGrid({
  authed,
  auth,
  files,
  onCwdChange,
  multiSelected,
  onMultiSelect,
  emptyMessage,
}: {
  authed: boolean;
  auth: string | null;
  files: FileItem[];
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[];
  onMultiSelect: (key: string) => void;
  emptyMessage?: React.ReactNode;
}) {
  const [slides, setSlides] = useState<SlideImage[]>([]);

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
                  return
                }
                onMultiSelect(file.key);
              } else if (isDirectory(file)) {
                onCwdChange(file.key + "/");
              } else if (isImage(file)) {
                setSlides(getSlides(files, auth, file.key));
              } else {
                window.open(fileurl(file.key, auth), "_blank", "noopener,noreferrer");
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
              {(authed && file.customMetadata?.thumbnail ? (
                <img src={thumburl(file, auth)} alt={file.key} style={{ width: 36, height: 36, objectFit: "cover" }} />
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
                  <Box
                    sx={{
                      display: "inline-block",
                      minWidth: "160px",
                      marginRight: 1,
                    }}
                  >
                    {file.system ? file.key : new Date(file.uploaded).toLocaleString()}
                  </Box>
                  {!isDirectory(file) && humanReadableSize(file.size)}
                </>
              }
            />
          </ListItemButton>
        </Grid>
      })}
    </Grid>
    <Lightbox
      open={!!slides.length}
      close={() => setSlides([])}
      slides={slides}
      plugins={[Captions, Counter, Fullscreen, Slideshow, Thumbnails, Video, Zoom, Download]}
    />
  </>
}

export default FileGrid;
