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
import { MIME_URL, basename } from '../lib/commons';
import { generatePassword, useConfig } from './commons';
import { putFile } from './app/transfer';


export default function UrlFileEditorDialog({ cwd, open, readonly, close, onUpload, ...otherProps }: {
  url?: string;
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
  const [filekey, setFilekey] = useState(otherProps.filekey || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);

  const onClose = useCallback(() => {
    setError(null)
    close()
  }, [close])

  const onSubmit = useCallback(async (e: SyntheticEvent) => {
    e.preventDefault();
    const key = filekey || (cwd ? cwd + "/" : "") + name;
    let fileurl = "";
    let candicateUrls = [url, "https://" + url];
    let error: any;
    for (const candicateUrl of candicateUrls) {
      try {
        fileurl = new URL(candicateUrl.trim()).href;
        break;
      } catch (e) {
        error = e;
      }
    }
    if (!fileurl) {
      setError(error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await putFile({ key, create: !filekey, auth, contentType: MIME_URL, url: fileurl });
      setFilekey(key);
      setUrl(fileurl);
    } catch (e) {
      setError(e);
    }
    setSaving(false);
    onUpload && onUpload();
  }, [url, name]);


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
                    onClick={() => navigator.clipboard.writeText(name)}
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
                  onClick={() => navigator.clipboard.writeText(url)}
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
        {!!error && <Typography>{error.toString()}</Typography>}
        <Box sx={{ mt: 1 }}>
          <Button disabled={saving || !url || !name || (!!otherProps.filekey && otherProps.url === url)}
            type="submit" onClick={onSubmit} color='primary'>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button href={url} disabled={!url}>Go</Button>
        </Box>
      </form>
    </DialogContent>
  </Dialog >;
}
