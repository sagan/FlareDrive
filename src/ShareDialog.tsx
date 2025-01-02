import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  Button, Checkbox, FormControl, FormControlLabel,
  IconButton, InputLabel, NativeSelect, TextField
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CasinoIcon from '@mui/icons-material/Casino';
import PasswordIcon from '@mui/icons-material/Password';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import {
  SHARE_ENDPOINT, STRONG_PASSWORD_LENGTH, ShareObject, ShareRefererMode,
  basename, cut, dirname, fileUrl, trimPrefixSuffix
} from '../lib/commons';
import { dirUrlPath, generatePassword } from './commons';
import { createShare, deleteShare } from './app/share';
import { CopyButton, TooltipIconButton } from './components';

enum Status {
  Creating,
  Sharing,
  Editing,
}

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
  const [tab, setTab] = useState(0);
  const filekey = otherProps.shareKey ? otherProps.shareObject!.key : otherProps.filekey!
  const name = basename(trimPrefixSuffix(filekey, "/"))
  const [shareKey, setSharekey] = useState(otherProps.shareKey || name)
  const [shareObject, setShareObject] = useState<ShareObject>(
    otherProps.shareKey ? otherProps.shareObject! : { key: filekey })
  const [referer, setReferer] = useState(otherProps.shareKey ? list2Referer(otherProps.shareObject!.refererList) : "")
  const [status, setStatus] = useState(otherProps.shareKey ? Status.Editing : Status.Creating)
  const [error, setError] = useState("")
  const [ttl, setTtl] = useState(!shareObject.expiration ? 0 : -1)
  const [linkTtl, setLinkTtl] = useState(0);
  const [linkTs, setLinkTs] = useState(0);
  const [linkFullControl, setLinkFullControl] = useState(false);

  const targetIsDir = shareObject.key.endsWith("/")
  const targetLink = targetIsDir ? dirUrlPath(shareObject.key) : fileUrl({ key: shareObject.key, auth })
  const targetParentLink = dirUrlPath(dirname(shareObject.key))
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
      ...(shareObject.refererMode ? {
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
  }, [shareKey, referer, shareObject, ttl]);

  const linkUrl = useMemo(() => fileUrl({
    origin: location.origin,
    key: shareObject.key,
    auth,
    expires: linkTtl ? linkTs + linkTtl : 0,
    fullControl: linkFullControl,
  }), [shareObject.key, linkTs, linkTtl, linkFullControl])

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle component={Typography} className='single-line'>
      <TooltipIconButton title={status !== Status.Creating ? "Share link" : "Create share"}
        color={status !== Status.Creating ? "primary" : "disabled"}
        href={status !== Status.Creating ? link : ""}
      >
        <ShareIcon />
      </TooltipIconButton>
      <IconButton title="Open share target parent dir" color='secondary' href={targetParentLink} onClick={(e) => {
        e.preventDefault();
        onClose();
        navigate(targetParentLink);
      }}><FolderOpenIcon /></IconButton>
      <Button title="Open share target" color='secondary' href={targetLink} onClick={(e) => {
        if (!targetIsDir) {
          return
        }
        e.preventDefault();
        onClose();
        navigate(targetLink);
      }}>{shareObject.key}</Button>
    </DialogTitle>
    {!targetIsDir && <Tabs value={tab} onChange={(_, newTab) => {
      setTab(newTab)
      if (newTab === 1) {
        setLinkTs(+new Date)
      }
    }} sx={{ width: "100%" }} >
      <Tab label="Publish" />
      <Tab label="Get Link" />
    </Tabs>}
    {tab === 0 && <DialogContent>
      <Box sx={{ mt: 1 }}>
        <TextField disabled={status !== Status.Creating} label="Share name" error={!!shareKeyError} fullWidth
          helperText={shareKeyError} value={shareKey} onChange={e => setSharekey(e.target.value)}
          placeholder='Share name' InputProps={{
            startAdornment: <IconButton edge="start">
              {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
            </IconButton>,
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
                  onClick={() => setSharekey(generatePassword(STRONG_PASSWORD_LENGTH))}
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
      </Box>
      <Box>
        <TextField disabled={status === Status.Sharing} fullWidth
          helperText={`share password of username:password format`} value={shareObject.auth || ""}
          onChange={e => setShareObject({ ...shareObject, auth: e.target.value })}
          placeholder='optional password' InputProps={{
            endAdornment:
              <>
                <IconButton
                  disabled={status === Status.Sharing}
                  onClick={() => {
                    let [user] = cut(shareObject.auth || "", ":")
                    if (!user) {
                      user = "user"
                    }
                    setShareObject({ ...shareObject, auth: `${user}:${generatePassword(STRONG_PASSWORD_LENGTH)}` })
                  }}
                  title={`Set to random password"`}
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
      </Box>
      <Box>
        <TextField disabled={status === Status.Sharing} fullWidth multiline
          placeholder='optional description' helperText={`share public description (html)`} value={shareObject.desc || ""}
          onChange={e => setShareObject({ ...shareObject, desc: e.target.value })} />
      </Box>
      <Box>
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
        <FormControlLabel label="Enable CORS" control={
          <Checkbox checked={!!shareObject.cors} onChange={e => {
            setShareObject({ ...shareObject, cors: +e.target.checked })
          }} />} />
        {targetIsDir &&
          <FormControlLabel label="Disable dir index" control={
            <Checkbox checked={shareObject.noindex || false} onChange={e => {
              setShareObject({ ...shareObject, noindex: e.target.checked })
            }} />} />
        }
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel variant="standard" htmlFor="referer-mode">Referer limit</InputLabel>
          <NativeSelect
            value={shareObject.refererMode || ShareRefererMode.NoLimit}
            disabled={status === Status.Sharing}
            onChange={e => setShareObject({ ...shareObject, refererMode: parseInt(e.target.value) })}
            inputProps={{ id: 'referer-mode' }}
          >
            <option value={ShareRefererMode.NoLimit}>No limit</option>
            <option value={ShareRefererMode.WhitelistMode}>Whitelist</option>
            <option value={ShareRefererMode.BlackListMode}>Blacklist</option>
          </NativeSelect>
        </FormControl>
      </Box>
      {!!shareObject.refererMode && <div>
        <TextField disabled={status === Status.Sharing} multiline fullWidth label="Referer list"
          helperText={<>
            One <a href="https://github.com/clearlylocal/browser-extension-url-match">url pattern</a> per line.
            Enter a empty line with a trailing "\n" to include "no referer" or direct access.
          </>} value={referer} onChange={e => setReferer(e.target.value)}
        />
      </div>}
      {!!error && <Typography>{error}</Typography>}
      {status === Status.Editing && <Typography>
        Shared link: <a href={link}>{new URL(link).pathname}</a>
        {!!shareObject.expiration &&
          <span>&nbsp;(Link expires on {new Date(shareObject.expiration * 1000).toISOString()})</span>}
      </Typography>}
    </DialogContent>}
    {tab === 1 && <DialogContent>
      <Box>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel variant="standard" htmlFor="link-ttl">Link Expiration</InputLabel>
          <NativeSelect
            value={linkTtl}
            onChange={e => {
              setLinkTs(+new Date)
              setLinkTtl(parseInt(e.target.value))
            }}
            inputProps={{ id: 'link-ttl' }}
          >
            <option value={0}><em>Never expire</em></option>
            <option value={300}>5 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>1 day</option>
            <option value={86400 * 7}>7 days</option>
            <option value={86400 * 365}>1 year</option>
          </NativeSelect>
        </FormControl>
        <FormControlLabel label="Full Control (allow write)" control={
          <Checkbox checked={linkFullControl} onChange={e => setLinkFullControl(e.target.checked)} />}
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <TextField disabled label={`Access link (${linkFullControl ? "full control" : "read only"})`}
          fullWidth value={linkUrl}
          InputProps={{
            endAdornment:
              <IconButton
                disabled={false}
                onClick={() => navigator.clipboard.writeText(linkUrl)}
                title={`Copy`}
                edge="end"
              >
                <ContentCopyIcon />
              </IconButton>
          }} />
      </Box>
      {!!linkTtl && <Typography>
        <span>Link expires on {new Date(linkTs + linkTtl * 1000).toISOString()}</span>
      </Typography>}
    </DialogContent>}
    {tab === 0 && <DialogActions>
      <IconButton disabled={invalid || status === Status.Sharing} onClick={doShare} color='primary'
        title={{
          [Status.Creating]: "Create",
          [Status.Sharing]: "Updating...",
          [Status.Editing]: "Update",
        }[status]}
      ><SaveIcon /></IconButton>
      {
        status != Status.Creating && <>
          <CopyButton isLink text={link} disabled={status !== Status.Editing} color='secondary'>
            <LinkIcon />
          </CopyButton>
          <IconButton disabled={status !== Status.Editing} color='warning'
            onClick={doDeleteShare} title="Delete share"><DeleteIcon /></IconButton>
        </>
      }
      <IconButton onClick={onClose} color='secondary'><CloseIcon /></IconButton>
    </DialogActions>}
  </Dialog >;
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
  // special case
  if (list.length === 1 && list[0] === "") {
    return "\n"
  }
  return list.join("\n")
}