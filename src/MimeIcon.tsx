import { MIME_DIR, cut } from "../lib/commons";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import CodeIcon from "@mui/icons-material/Code";
import FolderIcon from "@mui/icons-material/Folder";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PdfIcon from "@mui/icons-material/PictureAsPdf";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import { SvgIconProps } from "@mui/material";

const icons: Record<string, React.FC<SvgIconProps>> = {
  "image": ImageIcon,
  "video": VideoFileIcon,
  "audio": AudioFileIcon,
  "text": CodeIcon,
  "application/x-sh": CodeIcon,
  "application/json": CodeIcon,
  "application/xml": CodeIcon,
  "application/pdf": PdfIcon,
  "application/zip": FolderZipOutlinedIcon,
  "application/gzip": FolderZipOutlinedIcon,
  [MIME_DIR]: FolderIcon,
  "": InsertDriveFileOutlinedIcon, // fallback
}

export default function MimeIcon({ contentType, ...others }: SvgIconProps & { contentType?: string; }) {
  contentType = contentType || ""
  const [contentTypeCat] = cut(contentType, "/")
  const Icon = icons[contentType] || icons[contentTypeCat] || icons[""]
  return <Icon fontSize="large" {...others} />
}
