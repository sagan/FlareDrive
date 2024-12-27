import { MIME_DIR, MIME_GZIP, MIME_JSON, MIME_PDF, MIME_SH, MIME_XML, MIME_ZIP, mimeType } from "../lib/commons";
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
  image: ImageIcon,
  video: VideoFileIcon,
  audio: AudioFileIcon,
  text: CodeIcon,
  [MIME_SH]: CodeIcon,
  [MIME_JSON]: CodeIcon,
  [MIME_XML]: CodeIcon,
  [MIME_PDF]: PdfIcon,
  [MIME_ZIP]: FolderZipOutlinedIcon,
  [MIME_GZIP]: FolderZipOutlinedIcon,
  [MIME_DIR]: FolderIcon,
  "": InsertDriveFileOutlinedIcon, // fallback
}

export default function MimeIcon({ contentType, ...others }: SvgIconProps & { contentType?: string; }) {
  let [mime, mimeCat] = mimeType(contentType)
  const Icon = icons[mime] || icons[mimeCat] || icons[""]
  return <Icon fontSize="large" {...others} />
}
