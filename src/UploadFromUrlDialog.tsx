import React, { SyntheticEvent, useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
import { Permission, basename, fileUrl, humanReadableSize } from '../lib/commons';
import { FileItem } from './commons';
import { uploadFromUrl } from './app/transfer';


export default function UploadFromUrlDialog({ cwd, auth, permission, open, close, onUpload }: {
  cwd: string;
  auth: string | null;
  permission: Permission;
  open: boolean;
  close: () => void;
  onUpload: () => void;
}) {
  const [source, setSource] = useState("")
  const [name, setName] = useState("")
  const [uploaded, setUploaded] = useState<{ file: FileItem, name: string, sourceUrl: string, url: string }[]>([])
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

  const onClose = useCallback(() => {
    if (ac) {
      ac.abort();
      setAc(null);
    }
    close();
  }, [close, ac])

  const onSubmit = useCallback(async (e: SyntheticEvent) => {
    e.preventDefault();
    let sourceUrl = source
    let saveName = name || autoName
    if (!sourceUrl || !saveName) {
      setError(new Error(`invalid source url or save name`))
      return
    }
    const key = (cwd ? cwd + "/" : "") + saveName;
    const ac = new AbortController()
    setError(null);
    setUploading(true);
    setAc(ac);
    try {
      let file = await uploadFromUrl({ key, auth, sourceUrl, signal: ac.signal })
      setUploaded(uploaded => [...uploaded, {
        file,
        name: saveName,
        sourceUrl,
        url: fileUrl({ key: file.key, auth }),
      }])
      setSource("")
      setName("")
    } catch (e) {
      setError(e)
    }
    setUploading(false)
    onUpload();
  }, [source, name, autoName]);


  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle sx={{ display: "flex" }}>
      Upload file from URL to "{cwd + "/"}"
    </DialogTitle>
    <DialogContent autoFocus>
      <form>
        <Box sx={{ mt: 1 }}>
          <TextField type='search' disabled={uploading} autoFocus={true} label="File URL" fullWidth placeholder='http(s)://'
            value={source} onChange={e => setSource(e.target.value)} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField type='search' disabled={uploading} fullWidth placeholder={autoName}
            value={name} onChange={e => setName(e.target.value)} helperText="Save name (optional)" />
        </Box>
        {!!error && <Typography>{error.toString()}</Typography>}
        <Box sx={{ mt: 1 }}>
          <Button disabled={uploading} type="submit" onClick={onSubmit} color='primary'>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <Button disabled={!uploaded.length && !error} color="secondary" onClick={() => {
            setUploaded([]);
            setError(null)
          }}>Clear</Button>
        </Box>
      </form>
      {uploaded.length > 0 && <Box>
        <Typography>Uploaded files:</Typography>
        <TableContainer component={Paper}>
          <Table aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right">Link</TableCell>
                <TableCell align="right">Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploaded.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {item.name}
                  </TableCell>
                  <TableCell align="right">{humanReadableSize(item.file.size)}</TableCell>
                  <TableCell align="right"><a href={item.url}>Link</a></TableCell>
                  <TableCell align="right"><a href={item.sourceUrl}>Source</a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>}
    </DialogContent>
  </Dialog >;
}
