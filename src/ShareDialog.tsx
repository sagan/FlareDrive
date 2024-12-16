import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { Button, FormControl, IconButton, InputLabel, NativeSelect, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CasinoIcon from '@mui/icons-material/Casino';
import PasswordIcon from '@mui/icons-material/Password';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { SHARE_ENDPOINT, ShareObject, ShareRefererMode, WEBDAV_ENDPOINT, basename, dirname, key2Path, path2Key, trimPrefixSuffix } from '../lib/commons';
import { generatePassword } from './commons';
import { createShare, deleteShare } from './app/share';
import { CopyButton } from './components';

enum Status {
  Creating,
  Sharing,
  Editing,
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

/**
 * Either filekey, or shareKey & shareObject must be provided.
 * If shareKey & shareObject is present, editing it. Otherwise creaing a new share with key of filekey.
 * @param param
 * @returns
 */
export default function ShareDialog({ auth, open, onClose, postDelete, ...otherProps }: {
  auth: string | null;
  open: boolean;
  onClose: () => void;
  filekey?: string;
  shareKey?: string;
  shareObject?: ShareObject
  postDelete?: (sharekey: string) => void;
}) {
  const filekey = otherProps.shareKey ? otherProps.shareObject!.key : otherProps.filekey!
  const name = basename(trimPrefixSuffix(filekey, "/"))
  const [shareKey, setSharekey] = useState(otherProps.shareKey || name)
  const [shareObject, setShareObject] = useState<ShareObject>(
    otherProps.shareKey ? otherProps.shareObject! : { key: filekey })
  const [referer, setReferer] = useState(otherProps.shareKey ? list2Referer(otherProps.shareObject!.refererList) : "")
  const [refererMode, setRefererMode] = useState(ShareRefererMode.NoLimit)
  const [status, setStatus] = useState(otherProps.shareKey ? Status.Editing : Status.Creating)
  const [error, setError] = useState("")
  const [ttl, setTtl] = useState(!shareObject.expiration ? 0 : -1)

  const targetIsDir = shareObject.key.endsWith("/")
  const targetLink = (targetIsDir ? "/" : WEBDAV_ENDPOINT) + key2Path(shareObject.key)
  const targetParentLink = "/" + path2Key(dirname(shareObject.key))
  const link = location.origin + SHARE_ENDPOINT + shareKey + (targetIsDir ? "/" : "")
  const shareKeyError = !shareKey ? "Share name can not be empty" :
    (shareKey !== shareKey.trim() ? "Share name can not start or end with spaces" :
      (shareKey.match(/\//) ? `Share name can not contain "/"` : ""))
  const invalid = !!shareKeyError

  const navigate = useNavigate();

  const doDeleteShare = useCallback(async () => {
    if (!confirm(`Delete share "${shareKey}" (target file: "${shareObject.key}")?`)) {
      return
    }
    const key = shareKey
    setStatus(Status.Sharing)
    try {
      await deleteShare(key, auth)
      setStatus(Status.Creating)
      if (postDelete) {
        postDelete(key)
      }
    } catch (e) {
      setStatus(Status.Editing)
    }
  }, [shareKey, postDelete])

  const doShare = useCallback(async () => {
    const previousStatus = status
    setStatus(Status.Sharing)
    const newShareObject: ShareObject = {
      ...shareObject,
      ...(ttl >= 0 ? { expiration: ttl ? Math.round(+new Date / 1000) + ttl : 0 } : {}),
      ...(refererMode ? {
        refererMode,
        refererList: refer2list(referer),
      } : {})
    }
    try {
      await createShare(shareKey, newShareObject, auth)
      setError("")
      setStatus(Status.Editing)
      setShareObject(newShareObject)
    } catch (e) {
      setError(`${e}`)
      setStatus(previousStatus)
    }
  }, [shareKey, refererMode, referer, shareObject, ttl]);


  return <Modal open={open} onClose={onClose}>
    <Box sx={style}>
      <Typography sx={{ mb: 2 }} variant="h6" component="h6">
        Share
        <Button title="Open share target" color='secondary' href={targetLink} onClick={(e) => {
          if (!targetIsDir) {
            return
          }
          e.preventDefault();
          onClose();
          navigate(targetLink);
        }}>{shareObject.key}</Button>
        <Button title="Open share target parent dir" color='secondary' href={targetParentLink} onClick={(e) => {
          e.preventDefault();
          onClose();
          navigate(targetParentLink);
        }}>Open parent</Button>
      </Typography>
      <div>
        <TextField disabled={status !== Status.Creating} label="Share name" error={!!shareKeyError} fullWidth
          helperText={shareKeyError} value={shareKey} onChange={e => setSharekey(e.target.value)}
          placeholder='Share name' InputProps={{
            endAdornment:
              <>
                <IconButton
                  disabled={status !== Status.Creating}
                  onClick={() => setSharekey(generatePassword(6))}
                  title="Random short link"
                  edge="end"
                >
                  <CasinoIcon />
                </IconButton>
                <IconButton
                  disabled={status !== Status.Creating}
                  onClick={() => setSharekey(generatePassword(32))}
                  title="Random secure (long) link"
                  edge="end"
                >
                  <PasswordIcon />
                </IconButton>
                <IconButton
                  onClick={() => setSharekey(name)}
                  disabled={status !== Status.Creating || shareKey === name}
                  title='Reset'
                  edge="end"
                >
                  <RestoreIcon />
                </IconButton>
              </>
          }} />
      </div>
      <div>
        <TextField disabled={status === Status.Sharing} fullWidth
          helperText={`share password of username:password format`} value={shareObject.auth || ""}
          onChange={e => setShareObject({ ...shareObject, auth: e.target.value })}
          placeholder='optional password' InputProps={{
            endAdornment:
              <>
                <IconButton
                  disabled={status === Status.Sharing}
                  onClick={() => setShareObject({ ...shareObject, auth: "user:" + generatePassword(32) })}
                  title={`Set to "user:<random_password>"`}
                  edge="end"
                >
                  <PasswordIcon />
                </IconButton>
                <IconButton
                  onClick={() => setShareObject({ ...shareObject, auth: "" })}
                  disabled={status === Status.Sharing || !shareObject.auth}
                  title='Clear'
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>
                <IconButton
                  disabled={!shareObject.auth}
                  onClick={() => navigator.clipboard.writeText(shareObject.auth!)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
              </>
          }} />
      </div>
      <div>
        <TextField disabled={status === Status.Sharing} fullWidth multiline
          placeholder='optional description' helperText={`share public description (html)`} value={shareObject.desc || ""}
          onChange={e => setShareObject({ ...shareObject, desc: e.target.value })} />
      </div>
      <div>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel variant="standard" htmlFor="share-ttl">Expiration</InputLabel>
          <NativeSelect
            value={ttl}
            disabled={status === Status.Sharing}
            onChange={e => setTtl(parseInt(e.target.value))}
            inputProps={{ id: 'share-ttl' }}
          >
            {status !== Status.Creating && <option value={-1}><em>Do not change</em></option>}
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
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel variant="standard" htmlFor="referer-mode">Referer limit</InputLabel>
          <NativeSelect
            value={refererMode}
            disabled={status === Status.Sharing}
            onChange={e => setRefererMode(parseInt(e.target.value))}
            inputProps={{ id: 'referer-mode' }}
          >
            <option value={ShareRefererMode.NoLimit}>No limit</option>
            <option value={ShareRefererMode.WhitelistMode}>Whitelist</option>
            <option value={ShareRefererMode.BlackListMode}>Blacklist</option>
          </NativeSelect>
        </FormControl>
      </div>
      {refererMode !== ShareRefererMode.NoLimit && <div>
        <TextField disabled={status === Status.Sharing} multiline fullWidth label="Referer list"
          helperText={<>
            One <a href="https://github.com/clearlylocal/browser-extension-url-match">url pattern</a> per line.
            Enter a empty line with a trailing "\n" to include "no referer".
          </>} value={referer} onChange={e => setReferer(e.target.value)}
        />
      </div>}
      {!!error && <Typography sx={{ mt: 2 }}>{error}</Typography>}
      {status === Status.Editing && <Typography sx={{ mt: 2 }}>
        Shared link: <a href={link}>{new URL(link).pathname}</a>
        {!!shareObject.expiration &&
          <span>&nbsp;(Link expires on {new Date(shareObject.expiration * 1000).toISOString()})</span>}
      </Typography>}
      <Typography sx={{ mt: 2 }}>
        <Button disabled={invalid || status === Status.Sharing} onClick={doShare} color='primary'>{
          {
            [Status.Creating]: "Create",
            [Status.Sharing]: "Updating...",
            [Status.Editing]: "Update",
          }[status]
        }</Button>
        {
          status != Status.Creating && <>
            <CopyButton isLink text={link} disabled={status !== Status.Editing} color='primary'>Copy link</CopyButton>
            <Button disabled={status !== Status.Editing} color='warning'
              onClick={doDeleteShare} title="Delete share">Delete</Button>
          </>
        }
        <Button onClick={onClose} color='secondary'>Close</Button>
      </Typography>
    </Box>
  </Modal >;
}

function refer2list(referer?: string): string[] {
  if (!referer) {
    return []
  }
  return [... new Set(referer.split(/\r?\n/))].sort()
}

function list2Referer(list?: string[]): string {
  if (!list) {
    return ""
  }
  return list.join("\n")
}