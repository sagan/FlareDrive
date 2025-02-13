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
import NumbersIcon from '@mui/icons-material/Numbers';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InputAdornment from '@mui/material/InputAdornment';
import {
  SHARE_ENDPOINT, STRONG_PASSWORD_LENGTH, ShareObject, ShareRefererMode,
  basename, cut, dirname, fileUrl, trimPrefixSuffix, dirUrlPath, THIRTEEN_MONTHS_DAYS, Permission
} from '../lib/commons';
import { FileItem, generatePassword, getFilePermission, isDirectory, useConfig } from './commons';
import { createShare, deleteShare } from './app/share';
import { CopyButton } from './components';

enum Status {
  Creating,
  Sharing,
  Editing,
}

/**
 * Either file, or shareKey & shareObject must be provided.
 * If shareKey & shareObject is present, editing it. Otherwise creaing a new share with file.
 * @returns
 */
export default function ShareDialog({ open, onClose, setError, postDelete, onEdit, ...otherProps }: {
  open: boolean;
  onClose: () => void;
  setError: React.Dispatch<any>;
  postDelete?: (sharekey: string) => void;
  onEdit?: () => void;
} & ({ file: FileItem } | {
  shareKey: string;
  shareObject: ShareObject
})) {
  const { auth, expires } = useConfig()
  const [tab, setTab] = useState("shareKey" in otherProps ? 1 : 0);
  const fileKeyWithDirSlash = "shareKey" in otherProps ? otherProps.shareObject.key :
    (otherProps.file.key + (isDirectory(otherProps.file) ? "/" : ""))
  const fileKey = trimPrefixSuffix(fileKeyWithDirSlash, "/")
  const name = basename(fileKey)
  const [shareKey, setSharekey] = useState("shareKey" in otherProps ? otherProps.shareKey : name)
  const [shareObject, setShareObject] = useState<ShareObject>(
    "shareKey" in otherProps ? otherProps.shareObject! : { key: fileKeyWithDirSlash })
  const [referer, setReferer] = useState("shareKey" in otherProps ?
    list2Referer(otherProps.shareObject.refererList) : "")
  const [status, setStatus] = useState("shareKey" in otherProps ? Status.Editing : Status.Creating)
  const [ttl, setTtl] = useState(!shareObject.expiration ? 0 : -1)
  const [linkTtl, setLinkTtl] = useState(86400);
  const [linkTs, setLinkTs] = useState(+new Date);
  const [linkFullControl, setLinkFullControl] = useState(false);

  const permission = useMemo(() => getFilePermission(fileKey), [fileKey])
  const targetIsDir = shareObject.key.endsWith("/")
  const targetLink = targetIsDir ? dirUrlPath(shareObject.key) : fileUrl({
    key: shareObject.key,
    auth: permission === Permission.RequireAuth ? auth : undefined,
    expires
  })
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
      setStatus(Status.Editing)
      setShareObject(newShareObject)
    } catch (e) {
      setError(`${e}`)
      setStatus(previousStatus)
    }
  }, [shareKey, referer, shareObject, ttl]);

  const isOpen = permission === Permission.OpenDir || (!targetIsDir && permission === Permission.OpenFile)

  const linkOpenUrl = useMemo(() => fileUrl({
    origin: location.origin,
    key: fileKey,
    isDir: targetIsDir,
  }), [fileKey, targetIsDir])

  const linkUrl = useMemo(() => fileUrl({
    origin: location.origin,
    key: fileKey,
    auth,
    expires: linkTtl ? linkTs + linkTtl * 1000 : 0,
    fullControl: linkFullControl,
    scope: targetIsDir ? fileKeyWithDirSlash : undefined,
    isDir: targetIsDir,
  }), [fileKey, targetIsDir, linkTs, linkTtl, linkFullControl])


  function nativeShare() {
    navigator.share({ url: isOpen ? linkOpenUrl : linkUrl, title: name });
  }

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle component={Typography} sx={{ p: 1, pb: 0 }} className='single-line'>
      <IconButton><ShareIcon /></IconButton>
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
    <Tabs value={tab} onChange={(_, newTab) => {
      setTab(newTab)
      if (newTab === 0) {
        setLinkTs(+new Date)
      }
    }} sx={{ width: "100%" }} >
      <Tab label="Share" />
      <Tab label="Publish" />
    </Tabs>
    {tab === 0 && <DialogContent sx={{ p: 1 }} >
      <Box sx={{ mt: 1 }}>
        <TextField disabled label={`File key`}
          fullWidth value={fileKey}
          InputProps={{
            startAdornment: <IconButton edge="start">
              {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
            </IconButton>,
            endAdornment: <>
              {!!onEdit && !targetIsDir && <IconButton
                onClick={onEdit}
                title={`View / Edit`}
                edge="end"
              >
                <VisibilityIcon />
              </IconButton>}
              <IconButton
                onClick={() => navigator.clipboard.writeText(fileKey)}
                title={`Copy`}
                edge="end"
              >
                <ContentCopyIcon />
              </IconButton>
            </>
          }} />
      </Box>
      <Box sx={{ mt: 1 }}>
        <TextField disabled label={`File name`} fullWidth value={name} InputProps={{
          startAdornment: <IconButton edge="start">
            {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
          </IconButton>,
          endAdornment:
            <IconButton
              disabled={false}
              onClick={() => navigator.clipboard.writeText(name)}
              title={`Copy`}
              edge="end"
            >
              <ContentCopyIcon />
            </IconButton>
        }} />
      </Box>
      {
        "file" in otherProps && !isDirectory(otherProps.file) && <>
          {!!otherProps.file.httpMetadata.contentType && <Box sx={{ mt: 1 }}>
            <TextField disabled label={`MIME`} fullWidth value={otherProps.file.httpMetadata.contentType} InputProps={{
              endAdornment:
                <IconButton
                  disabled={false}
                  onClick={() => navigator.clipboard.writeText(otherProps.file.httpMetadata.contentType)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
            }} />
          </Box>}
          {!!otherProps.file.checksums.md5 && <Box sx={{ mt: 1 }}>
            <TextField disabled label={`MD5`} fullWidth value={otherProps.file.checksums.md5} InputProps={{
              endAdornment:
                <IconButton
                  disabled={false}
                  onClick={() => navigator.clipboard.writeText(otherProps.file.checksums.md5!)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
            }} />
          </Box>
          }
          {!!otherProps.file.checksums.sha1 && <Box sx={{ mt: 1 }}>
            <TextField disabled label={`SHA1`} fullWidth value={otherProps.file.checksums.sha1} InputProps={{
              endAdornment:
                <IconButton
                  disabled={false}
                  onClick={() => navigator.clipboard.writeText(otherProps.file.checksums.sha1!)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
            }} />
          </Box>
          }
          {!!otherProps.file.checksums.sha256 && <Box sx={{ mt: 1 }}>
            <TextField disabled label={`SHA256`} fullWidth value={otherProps.file.checksums.sha256} InputProps={{
              endAdornment:
                <IconButton
                  disabled={false}
                  onClick={() => navigator.clipboard.writeText(otherProps.file.checksums.sha256!)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
            }} />
          </Box>
          }
        </>
      }
      {isOpen && <>
        <Box sx={{ mt: 1 }}>
          <TextField disabled label={`Public link (read-only)`} fullWidth value={linkOpenUrl} InputProps={{
            startAdornment: <IconButton edge="start">
              {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
            </IconButton>,
            endAdornment: <>
              <IconButton
                disabled={false}
                onClick={() => navigator.clipboard.writeText(linkOpenUrl)}
                title={`Copy`}
                edge="end"
              >
                <ContentCopyIcon />
              </IconButton>
              <IconButton title='Share' onClick={nativeShare}><ShareIcon /></IconButton>
            </>
          }} />
        </Box>
        <Typography>
          This {targetIsDir ? "dir" : "file"} is publicly accessible according to your env config.
        </Typography>
      </>}
      {!isOpen && <>
        <Box sx={{ mt: 1 }}>
          <FormControl sx={{ m: 1, minWidth: 120 }}>
            <InputLabel variant="standard" htmlFor="link-ttl">Link Expiration</InputLabel>
            <NativeSelect value={linkTtl} inputProps={{ id: 'link-ttl' }} onChange={e => {
              setLinkTs(+new Date)
              setLinkTtl(parseInt(e.target.value))
            }}>
              <option value={0}>Never expire</option>
              {window.__DEV__ && <option value={60}>60 seconds</option>}
              <option value={300}>5 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>1 day</option>
              <option value={86400 * 7}>7 days</option>
              <option value={86400 * THIRTEEN_MONTHS_DAYS}>1 year</option>
            </NativeSelect>
          </FormControl>
          <FormControlLabel label="Full Control (allow write)" control={
            <Checkbox checked={linkFullControl} onChange={e => setLinkFullControl(e.target.checked)} />}
          />
        </Box>
        <Box>
          <TextField disabled label={`Access link (${linkFullControl ? "full control" : "read only"})`}
            fullWidth value={linkUrl}
            InputProps={{
              startAdornment: <IconButton edge="start">
                {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
              </IconButton>,
              endAdornment: <>
                <IconButton
                  disabled={false}
                  onClick={() => navigator.clipboard.writeText(linkUrl)}
                  title={`Copy`}
                  edge="end"
                >
                  <ContentCopyIcon />
                </IconButton>
                <IconButton title='Share' onClick={nativeShare}><ShareIcon /></IconButton>
              </>
            }} />
        </Box>
        {!!linkTtl ? <Typography>
          Link expires on {new Date(linkTs + linkTtl * 1000).toISOString()}, or until the admin password changed
        </Typography> : <Typography sx={{ color: "red" }}>
          Link will never expire (unless the admin password is changed)
        </Typography>}
        {linkFullControl && <Typography sx={{ color: "red" }}>
          {
            targetIsDir
              ? `Link has write access, can manage files in folder`
              : `Link has write access, send a "PUT" request to update the file contents.`
          }
        </Typography>}
      </>}
    </DialogContent>}
    {tab === 1 && <DialogContent sx={{ p: 1 }} >
      <Box sx={{ mt: 1 }}>
        <TextField disabled={status !== Status.Creating} label="Public url" error={!!shareKeyError} fullWidth
          helperText={shareKeyError} value={shareKey} onChange={e => setSharekey(e.target.value)}
          placeholder='share name' InputProps={{
            startAdornment: <>
              <IconButton title={status !== Status.Creating ? "Share link" : "Create share"}
                color={status !== Status.Creating ? "primary" : "default"} edge="start">
                {targetIsDir ? <FolderIcon /> : <AttachFileIcon />}
              </IconButton>
              <InputAdornment position="start">{SHARE_ENDPOINT}</InputAdornment>
            </>,
            endAdornment:
              <>
                <IconButton
                  disabled={status !== Status.Creating}
                  onClick={() => setSharekey(generatePassword(6, true))}
                  title="Random digit-only short link"
                  edge="end"
                >
                  <NumbersIcon />
                </IconButton>
                <IconButton
                  disabled={status !== Status.Creating}
                  onClick={() => setSharekey(generatePassword(STRONG_PASSWORD_LENGTH))}
                  title="Random secure link"
                  edge="end"
                >
                  <CasinoIcon />
                </IconButton>
                <IconButton
                  onClick={() => setSharekey(name)}
                  disabled={status !== Status.Creating || shareKey === name}
                  title='Reset'
                  edge="end"
                >
                  <RestoreIcon />
                </IconButton>
                <IconButton
                  disabled={status === Status.Creating}
                  onClick={() => navigator.clipboard.writeText(link)}
                  title={`Copy link`}
                  edge="end"
                >
                  <ContentCopyIcon />
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
            {status !== Status.Creating && <option value={-1}>Do not change</option>}
            <option value={0}>Never expire</option>
            {/* Cloudflare KV expiration times must be at least 60 seconds in the future */}
            {window.__DEV__ && <option value={60}>60 seconds</option>}
            <option value={300}>5 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>1 day</option>
            <option value={86400 * 7}>7 days</option>
            <option value={86400 * THIRTEEN_MONTHS_DAYS}>1 year</option>
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
      {status === Status.Editing && <Typography>
        Shared link: <a href={link}>{new URL(link).pathname}</a>
        {!!shareObject.expiration &&
          <span>&nbsp;(Link expires on {new Date(shareObject.expiration * 1000).toISOString()})</span>}
      </Typography>}
    </DialogContent>}
    {tab === 1 && <DialogActions>
      {
        status != Status.Creating &&
        <CopyButton isIcon isLink text={link} disabled={status !== Status.Editing} color='secondary'>
          <LinkIcon />
        </CopyButton>
      }
      <IconButton disabled={invalid || status === Status.Sharing} onClick={doShare} color='primary'
        title={{
          [Status.Creating]: "Create",
          [Status.Sharing]: "Updating...",
          [Status.Editing]: "Update",
        }[status]}
      ><SaveIcon /></IconButton>
      {
        status != Status.Creating &&
        <IconButton disabled={status !== Status.Editing} color='warning'
          onClick={doDeleteShare} title="Delete share"><DeleteIcon />
        </IconButton>
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