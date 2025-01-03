import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from "@mui/material"
import Editor, { EditorProps } from '@monaco-editor/react';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import {
  HEADER_AUTHORIZATION, HEADER_CONTENT_LENGTH, WEBDAV_ENDPOINT,
  extname, fileUrl, humanReadableSize, key2Path, str2int
} from '../lib/commons';
import { EDIT_FILE_SIZE_LIMIT, useConfig } from './commons';

enum State {
  Idle,
  Editing,
  Loading,
  Saving,
}


const extLanguages: Record<string, string> = {
  "": "plain", // fallback
  ".c": "c",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".css": 'css',
  ".go": "go",
  ".htm": "html",
  ".html": "html",
  ".java": 'java',
  ".js": 'javascript',
  ".json": 'json',
  ".md": 'markdown',
  ".mjs": 'javascript',
  ".php": "php",
  ".py": "python",
  ".rs": "rust",
  ".toml": "toml",
  ".ts": 'typescript',
  ".yaml": "yaml",
  ".xml": "xml",
}

export default function EditorDialog({ filekey, open, close, setError }: {
  filekey: string;
  open: boolean;
  close: () => void;
  setError: React.Dispatch<React.SetStateAction<any>>;
}) {
  const { auth, expires, editorPrompt, setEditorPrompt, editorReadOnly, setEditorReadOnly } = useConfig()
  const language = extLanguages[extname(filekey)] || extLanguages[""]
  const [state, setState] = useState<State>(State.Idle)
  const [contents, setContents] = useState<string | undefined>(undefined)
  const [changed, setChanged] = useState(false)
  const [ts, setTs] = useState(+new Date);
  const editorRef = useRef<Parameters<Exclude<EditorProps["onMount"], undefined>>[0] | null>(null);
  const fileLink = useMemo(() => fileUrl({ key: filekey, auth, expires, ts }), [filekey, auth, ts])

  const onLoad = useCallback(() => {
    (async () => {
      setState(State.Loading)
      try {
        const res = await fetch(fileLink)
        if (!res.ok) {
          throw new Error(`failed to load file: status=${res.status}`)
        }
        const size = str2int(res.headers.get(HEADER_CONTENT_LENGTH))
        if (size > EDIT_FILE_SIZE_LIMIT) {
          throw new Error(`file is too large: ${humanReadableSize(size)}`)
        }
        const contents = await res.text()
        setContents(contents)
        setChanged(false)
        setState(State.Editing)
        if (editorRef.current) {
          editorRef.current.setValue(contents)
        }
      } catch (err) {
        setError(err)
        setState(State.Idle)
      }
    })();
  }, [fileLink])

  useEffect(() => {
    onLoad()
  }, [])


  const onChange = useCallback((value: string | undefined, event: any) => {
    setChanged(value !== contents)
  }, [contents])

  const onCloseNoPrompt = useCallback(() => {
    if (changed) {
      return
    }
    close()
  }, [close, changed])

  const onClose = useCallback(() => {
    if (changed && !confirm("Exit? Your edit will be lost.")) {
      return
    }
    close()
  }, [close, changed])

  const onSave = useCallback(async () => {
    if (!editorRef.current) {
      return
    }
    if (editorPrompt && !confirm("Save changes?")) {
      return
    }
    try {
      setState(State.Saving)
      const contents = editorRef.current.getValue()
      const res = await fetch(`${WEBDAV_ENDPOINT}${key2Path(filekey)}`, {
        method: "PUT",
        headers: {
          ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
        },
        body: contents,
      })
      if (!res.ok) {
        throw new Error(`status=${res.status}`)
      }
      setContents(contents)
      setChanged(false)
      setTs(+new Date)
    } catch (err) {
      setError(err)
    }
    setState(State.Editing)
  }, [contents, auth, editorPrompt])

  const onReset = useCallback(() => {
    if (!editorRef.current) {
      return
    }
    if (editorPrompt && !confirm("Reset to original contents? all changes will be lost.")) {
      return
    }
    editorRef.current.setValue(contents || "")
  }, [contents, editorPrompt])

  function handleKeyDown(event: any) {
    // ctrl + s
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault(); // Prevent the default browser behavior (saving the webpage)
      if (state === State.Editing) {
        onSave();
      }
    }
  }

  const roMode = !auth || !!editorReadOnly || state !== State.Editing

  return <Dialog open={open} onClose={onCloseNoPrompt} fullWidth maxWidth="xl">
    <DialogTitle component={Typography} className='single-line'>
      {({
        [State.Editing]: roMode ? "View" : "Edit",
        [State.Idle]: roMode ? "View" : "Edit",
        [State.Loading]: "Loading...",
        [State.Saving]: "Saving...",
      })[state]}
      <PriorityHighIcon fontSize='small' titleAccess="Unsaved" sx={{ visibility: changed ? "visible" : "hidden" }} />
      <Link href={fileLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent onKeyDown={handleKeyDown}>
      <Typography className="single-line">
        {!!auth && <>
          <IconButton title={roMode ? "View Mode" : "Edit Mode"} color="secondary"
            disabled={changed || state !== State.Editing} onClick={() => setEditorReadOnly(v => +!v)}>
            {roMode ? <RemoveRedEyeIcon /> : <EditIcon />}
          </IconButton>
          <IconButton title={editorPrompt ? "Confirm on save / reset" : "Do NOT confirm on save / reset"}
            color={editorPrompt ? "secondary" : "default"}
            disabled={roMode} onClick={() => setEditorPrompt(v => +!v)}>
            <ConfirmationNumberIcon />
          </IconButton>
          <IconButton title="Save (Ctrl+S)" color={changed ? "primary" : "inherit"}
            disabled={roMode || !changed} onClick={onSave}>
            <SaveIcon />
          </IconButton>
          <IconButton title="Reset" color={changed ? "primary" : "inherit"}
            disabled={roMode || !changed} onClick={onReset}>
            <RestoreIcon />
          </IconButton>
        </>}
        <IconButton title="Refresh" color='secondary' onClick={onLoad}
          disabled={changed || (state !== State.Editing && state !== State.Idle)}>
          <RefreshIcon />
        </IconButton>
        <IconButton title="Close" color='secondary' disabled={state !== State.Editing && state !== State.Idle}
          onClick={onClose}><CloseIcon /></IconButton>
      </Typography>
      {/*
      Dialog max-height: calc(100vh - 64px)
      DialogTitle height: 32px + 16px (padding-top & padding-bottom ) * 2 = 64px
      Toolbar height: 40px
      DialogContent padding-bottom: 20px
      */}
      <Box sx={{ minHeight: "50vh", height: "calc(100vh - 188px)" }}>
        {contents !== undefined && <Editor
          key={filekey}
          defaultLanguage={language}
          defaultValue={contents}
          onChange={onChange}
          options={{ readOnly: roMode, domReadOnly: roMode, wordWrap: "on" }}
          onMount={(editor) => editorRef.current = editor}
        />}
      </Box>
    </DialogContent>
  </Dialog >;
}
