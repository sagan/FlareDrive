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
import { MIME_URL } from '../lib/commons';
import { generatePassword, useConfig } from './commons';
import { putFile } from './app/transfer';


export default function UrlFileEditorDialog({ cwd, open, close, onUpload, ...otherProps }: {
  url?: string;
  key?: string;
  cwd?: string;
  open: boolean;
  close: () => void;
  onUpload?: () => void;
}) {
  const { auth } = useConfig();
  const [name, setName] = useState(generatePassword(6));
  const [url, setUrl] = useState(otherProps.url || "");
  const [key, setKey] = useState(otherProps.key || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);

  const onClose = useCallback(() => {
    setError(null)
    close()
  }, [close])

  const onSubmit = useCallback(async (e: SyntheticEvent) => {
    e.preventDefault();
    const filekey = key || (cwd ? cwd + "/" : "") + name;
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
      await putFile({ key: filekey, create: !key, auth, contentType: MIME_URL, url: fileurl });
      setKey(filekey);
      setUrl(fileurl);
    } catch (e) {
      setError(e);
    }
    setSaving(false);
    onUpload && onUpload();
  }, [url, name]);


  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle component={Typography} className='single-line'>
      {key ? `Edit URL "${key}"` : `New URL in "${cwd}/"`}
    </DialogTitle>
    <DialogContent autoFocus>
      <form>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={saving || !!key} fullWidth placeholder={"Name"}
            value={name} onChange={e => setName(e.target.value)} InputProps={{
              endAdornment:
                <>
                  <IconButton
                    disabled={saving}
                    onClick={() => setName(generatePassword(6))}
                    title="Random name"
                    edge="end"
                  >
                    <CasinoIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => setName("")}
                    disabled={saving || !name}
                    title='Reset'
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </>
            }} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={saving} autoFocus={true} label="URL" fullWidth placeholder='http(s)://'
            value={url} onChange={e => setUrl(e.target.value)} InputProps={{
              endAdornment: <IconButton
                onClick={() => setUrl("")}
                disabled={saving}
                title='Clear'
                edge="end"
              >
                <ClearIcon />
              </IconButton>
            }} />
        </Box>
        {!!error && <Typography>{error.toString()}</Typography>}
        <Box sx={{ mt: 1 }}>
          <Button disabled={saving || !url || !name} type="submit" onClick={onSubmit} color='primary'>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button href={url} disabled={!url}>Go</Button>
        </Box>
      </form>
    </DialogContent>
  </Dialog >;
}
