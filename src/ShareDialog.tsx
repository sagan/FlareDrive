import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { Button, FormControl, IconButton, InputLabel, MenuItem, NativeSelect, Select, TextField } from '@mui/material';
import { SHARE_ENDPOINT, basename } from '../lib/commons';
import { createShare } from './app/share';
import RestoreIcon from '@mui/icons-material/Restore';
import CasinoIcon from '@mui/icons-material/Casino';
import { generatePassword } from './commons';

enum Status {
  Idle,
  Sharing,
  Shared,
}

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export default function ShareDialog({ auth, filekey, open, onClose }: {
  auth: string | null;
  filekey: string;
  open: boolean;
  onClose: () => void;
}) {
  const name = basename(filekey)
  const [sharekey, setSharekey] = useState(name)
  const canonicalShareKey = sharekey.trim()
  const shareKeyError = canonicalShareKey.match(/\//) ? `Share name can not contain "/"` : ""
  const [error, setError] = useState("")
  const [status, setStatus] = useState(Status.Idle)
  const link = location.origin + SHARE_ENDPOINT + canonicalShareKey
  const [copied, setCopied] = useState("")
  const [ttl, setTtl] = useState(0)
  const [expiration, setExpiration] = useState(0)

  const doShare = useCallback(async () => {
    setStatus(Status.Sharing)
    const expiration = ttl ? Math.round(+new Date / 1000) + ttl : 0
    try {
      await createShare(canonicalShareKey, {
        key: filekey,
        ...(expiration ? { expiration } : {}),
      }, auth)
      setError("")
      setExpiration(expiration)
      setStatus(Status.Shared)
    } catch (e) {
      setError(`${e}`)
      setStatus(Status.Idle)
    }
  }, [canonicalShareKey, ttl])

  return <Modal open={open}>
    <Box sx={style}>
      <Typography sx={{ mb: 2 }} variant="h6" component="h6">Share {filekey}</Typography>
      <div>
        <TextField disabled={status !== Status.Idle} label="Share name" error={!!shareKeyError}
          helperText={shareKeyError} value={sharekey} onChange={e => setSharekey(e.target.value)}
          placeholder='Share name' InputProps={{
            endAdornment:
              <>
                <IconButton
                  disabled={status !== Status.Idle}
                  onClick={() => setSharekey(generatePassword(6))}
                  title="Random"
                  edge="end"
                >
                  <CasinoIcon />
                </IconButton>
                <IconButton
                  onClick={() => setSharekey(name)}
                  disabled={status !== Status.Idle || sharekey === name}
                  title='Reset'
                  edge="end"
                >
                  <RestoreIcon />
                </IconButton>
              </>
          }} />
      </div>
      <div>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel variant="standard" htmlFor="share-ttl">Expiration</InputLabel>
          <NativeSelect
            value={ttl}
            disabled={status !== Status.Idle}
            onChange={e => setTtl(parseInt(e.target.value))}
            inputProps={{ id: 'share-ttl' }}
          >
            <option value={0}><em>Never expire</em></option>
            {/* Cloudflare KV expiration times must be at least 60 seconds in the future */}
            {window.__DEV__ && <option value={60}>60 seconds</option>}
            <option value={300}>5 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>1 day</option>
            <option value={86400 * 7}>7 days</option>
            <option value={86400 * 365}>1 year</option>
          </NativeSelect>
        </FormControl>
      </div>
      {!!error && <Typography sx={{ mt: 2 }}>{error}</Typography>}
      {status === Status.Shared && <Typography sx={{ mt: 2 }}>
        Shared file: <a href={link}>{SHARE_ENDPOINT + canonicalShareKey}</a>
        {!!expiration && <span>&nbsp;(Link expires on {new Date(expiration * 1000).toISOString()})</span>}
      </Typography>}
      <Typography sx={{ mt: 2 }}>
        <Button disabled={!canonicalShareKey || !!shareKeyError || status !== Status.Idle} onClick={doShare}
          color='primary'>{
            {
              [Status.Idle]: "Share",
              [Status.Sharing]: "Sharing",
              [Status.Shared]: "✓ Shared",
            }[status]
          }</Button>
        {status === Status.Shared && <Button onClick={() => {
          setCopied(link)
          navigator.clipboard.writeText(link)
        }} color='primary'>
          {link === copied ? "✓ Copied" : "Copy link"}
        </Button>}
        <Button onClick={onClose} color='secondary'>Close</Button>
      </Typography>
    </Box>
  </Modal>;
}
