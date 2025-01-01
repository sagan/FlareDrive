import React, { SyntheticEvent, useCallback, useMemo, useState } from 'react';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Box from '@mui/material/Box';
import { Button, TextField } from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import ClearIcon from '@mui/icons-material/Clear';
import { Permission, basename, dirname, extname, fileUrl, humanReadableSize } from '../lib/commons';
import { FileItem, dirUrlPath, generatePassword } from './commons';
import { uploadFromUrl } from './app/transfer';
import { useNavigate } from 'react-router-dom';


export default function CloudDownloadDialog({ cwd, auth, permission, open, close, onUpload }: {
  cwd: string;
  auth: string | null;
  permission: Permission;
  open: boolean;
  close: () => void;
  onUpload: () => void;
}) {
  const navigate = useNavigate()
  const [source, setSource] = useState("")
  const [name, setName] = useState("")
  const [uploaded, setUploaded] = useState<{
    file: FileItem | null, sourceUrl: string,
    dir: string, saveName: string
  }[]>([])
  const [asyncMode, setAsyncMode] = useState(false)
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [ac, setAc] = useState<AbortController | null>(null)

  const autoName = useMemo(() => {
    try {
      const url = new URL(source)
      if (url.pathname.endsWith("/")) {
        return "index.html"
      }
      return basename(url.pathname)
    } catch (e) { }
    return ""
  }, [source])

  const ext = extname(autoName) || ".bin"

  const onClose = useCallback(() => {
    setError(null)
    close()
  }, [close, ac])

  const onSubmit = useCallback(async (e: SyntheticEvent) => {
    e.preventDefault();
    let sourceUrl = ""
    try {
      sourceUrl = new URL(source.trim()).href
    } catch (e) {
      setError(e)
      return
    }
    let saveName = name || autoName
    let _asyncMode = asyncMode
    if (!sourceUrl || !saveName) {
      setError(new Error(`invalid source url or save name`))
      return
    }
    const dir = cwd
    const key = (cwd ? cwd + "/" : "") + saveName;
    const ac = new AbortController()
    setError(null);
    setUploading(true);
    setAc(ac);
    try {
      let file = await uploadFromUrl({ key, auth, sourceUrl, asyncMode: _asyncMode, signal: ac.signal })
      setUploaded(uploaded => [{ file, dir, sourceUrl, saveName }, ...uploaded])
      setSource("")
      setName("")
    } catch (e) {
      setError(e)
    }
    setUploading(false)
    if (!_asyncMode) {
      onUpload();
    }
  }, [source, name, autoName, asyncMode]);


  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle component={Typography} className='single-line'>
      Download to "{cwd + "/"}"
    </DialogTitle>
    <DialogContent autoFocus>
      <form>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={uploading} autoFocus={true} label="File URL" fullWidth placeholder='http(s)://'
            value={source} onChange={e => setSource(e.target.value)} InputProps={{
              endAdornment: <IconButton
                onClick={() => setSource("")}
                disabled={uploading}
                title='Clear'
                edge="end"
              >
                <ClearIcon />
              </IconButton>
            }} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField disabled={uploading} fullWidth placeholder={autoName || "Save name"}
            value={name} onChange={e => setName(e.target.value)} InputProps={{
              endAdornment:
                <>
                  <IconButton
                    disabled={uploading || !source}
                    onClick={() => setName(generatePassword(6) + ext)}
                    title="Random name"
                    edge="end"
                  >
                    <CasinoIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => setName("")}
                    disabled={uploading || !name}
                    title='Reset'
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </>
            }} />
        </Box>
        {!!error && <Typography>{error.toString()}</Typography>}
        <Box sx={{ mt: 1 }}>
          <FormControlLabel disabled={uploading} label="Async" title="Async download mode" control={
            <Checkbox checked={asyncMode} onChange={e => setAsyncMode(e.target.checked)} />
          } />
          <Button disabled={uploading || !source} type="submit" onClick={onSubmit} color='primary'>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <Button disabled={!uploading} color="secondary" onClick={() => {
            if (ac) {
              ac.abort();
            }
          }}>Cancel</Button>
          <Button disabled={!uploaded.length && !error} color="secondary" onClick={() => {
            setUploaded([]);
            setError(null)
          }}>Clear</Button>
        </Box>
      </form>
      {uploaded.length > 0 && <Box>
        <TableContainer component={Paper}>
          <Table aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Downloaded File</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="left">Dir</TableCell>
                <TableCell align="right">Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploaded.map((item, i) => {
                return <TableRow key={i}>
                  <TableCell>
                    {item.file
                      ? <a href={fileUrl({ key: item.file.key, auth })}>{item.saveName}</a>
                      : <span>{item.saveName}</span>
                    }
                  </TableCell>
                  <TableCell align="right">
                    {item.file ? humanReadableSize(item.file.size) : "Unknown (Async task)"}
                  </TableCell>
                  <TableCell align="left"><a href={item.dir} onClick={e => {
                    e.preventDefault();
                    navigate(e.currentTarget.getAttribute("href")!);
                    onClose();
                  }}>{item.dir}/</a></TableCell>
                  <TableCell align="right"><a href={item.sourceUrl}>Source</a></TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>}
    </DialogContent>
  </Dialog >;
}
