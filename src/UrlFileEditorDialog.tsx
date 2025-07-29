import React, { SyntheticEvent, useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import Box from '@mui/material/Box';
import { Button, TextField } from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import ClearIcon from '@mui/icons-material/Clear';
import RestoreIcon from '@mui/icons-material/Restore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { MIME_URL, basename, extname, validateAndGetSafeUrl } from '../lib/commons';
import { generatePassword, useConfig } from './commons';
import { putFile } from './app/transfer';
import { generateUrlFile } from '../lib/mime';


export default function UrlFileEditorDialog({ cwd, open, readonly, close, onUpload, ...otherProps }: {
  url?: string;
  comment?: string;
  filekey?: string;
  cwd?: string;
  open: boolean;
  readonly?: boolean;
  close: () => void;
  onUpload?: () => void;
}) {
  const { auth } = useConfig();
  const [name, setName] = useState(otherProps.filekey ? basename(otherProps.filekey) : generatePassword(6));
  const [url, setUrl] = useState(otherProps.url || "");
  const [comment, setComment] = useState(otherProps.comment || "");
  const [filekey, setFilekey] = useState(otherProps.filekey || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onClose = useCallback(() => {
    setError(null)
    close()
  }, [close])

  const onSubmit = useCallback(async (e: SyntheticEvent) => {
    e.preventDefault();
    const key = filekey || (cwd ? cwd + "/" : "") + name;
    let fileurl = "";
    const candicateUrls = [url, "https://" + url];
    let error: unknown;
    for (const candicateUrl of candicateUrls) {
      fileurl = validateAndGetSafeUrl(candicateUrl.trim())
      if (fileurl) {
        break;
      }
      error = new Error("invalid url");
    }
    if (!fileurl) {
      setError(error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let body: BodyInit | undefined;
      if (extname(key)) {
        body = generateUrlFile(fileurl, key);
      }
      await putFile({
        key,
        auth,
        comment,
        body,
        contentType: MIME_URL,
        url: fileurl,
        create: !filekey,
      });
      setFilekey(key);
      setUrl(fileurl);
    } catch (e) {
      setError(e);
    }
    setSaving(false);
    if (onUpload) {
      onUpload();
    }
  }, [filekey, cwd, name, url, onUpload, auth, comment]);


  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle component={Typography} className='single-line'>
      {filekey ? `${readonly ? "View" : "Edit"} URL "${filekey}"` : `New URL in "${cwd || ""}/"`}
    </DialogTitle>
    <DialogContent autoFocus>
      <form>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={saving || !!filekey} fullWidth placeholder={"Name"}
            value={name} onChange={e => setName(e.target.value)} InputProps={{
              endAdornment:
                <>
                  <IconButton
                    onClick={() => void navigator.clipboard.writeText(name)}
                    disabled={!name}
                    title={`Copy`}
                    edge="end"
                  >
                    <ContentCopyIcon />
                  </IconButton>
                  <IconButton
                    disabled={saving || !!filekey}
                    onClick={() => setName(generatePassword(6))}
                    title="Random name"
                    edge="end"
                  >
                    <CasinoIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => setName("")}
                    disabled={saving || !!filekey || !name}
                    title='Reset'
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </>
            }} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={saving || readonly} autoFocus={true} label="URL" fullWidth placeholder='http(s)://'
            value={url} onChange={e => setUrl(e.target.value)} InputProps={{
              endAdornment: <>
                <IconButton
                  onClick={() => void navigator.clipboard.writeText(url)}
                  disabled={!url}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
                {otherProps.filekey ? <IconButton
                  onClick={() => setUrl(otherProps.url || "")}
                  disabled={saving || url === otherProps.url}
                  title='Reset'
                  edge="end"
                >
                  <RestoreIcon />
                </IconButton> : <IconButton
                  onClick={() => setUrl("")}
                  disabled={saving || url === ""}
                  title='Clear'
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>}
              </>
            }} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField
            label="Comment"
            multiline
            disabled={saving || readonly}
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Box>
        {!!error && <Typography>{error.toString()}</Typography>}
        <Box sx={{ mt: 1 }}>
          <Button disabled={saving || !url || !name ||
            (!!otherProps.filekey && otherProps.url === url && otherProps.comment === comment)}
            type="submit" onClick={(e) => void onSubmit(e)} color='primary'>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button href={validateAndGetSafeUrl(url)} disabled={!url}>Go</Button>
        </Box>
      </form>
    </DialogContent>
  </Dialog >;
}
