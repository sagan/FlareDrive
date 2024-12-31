import React, { SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link,
  Typography,
} from "@mui/material"
import Editor, { EditorProps } from '@monaco-editor/react';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { HEADER_AUTHORIZATION, HEADER_CONTENT_LENGTH, WEBDAV_ENDPOINT, extname, fileUrl, humanReadableSize, key2Path, str2int } from '../lib/commons';
import { EDIT_FILE_SIZE_LIMIT, EDITOR_PROMPT_VARIABLE } from './commons';

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

export default function EditorDialog({ filekey, auth, open, close }: {
  filekey: string;
  auth: string | null;
  open: boolean;
  close: () => void;
}) {

  const [editorPrompt, setEditorPrompt] = useState<number>(
    () => str2int(localStorage.getItem(EDITOR_PROMPT_VARIABLE), 1)
  )
  const language = extLanguages[extname(filekey)] || extLanguages[""]
  const [state, setState] = useState<State>(State.Idle)
  const [contents, setContents] = useState<string | undefined>(undefined)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<any>("")
  const [ts, setTs] = useState(+new Date);
  const editorRef = useRef<Parameters<Exclude<EditorProps["onMount"], undefined>>[0] | null>(null);

  useEffect(() => {
    if (editorPrompt !== str2int(localStorage.getItem(EDITOR_PROMPT_VARIABLE), 1)) {
      localStorage.setItem(EDITOR_PROMPT_VARIABLE, `${editorPrompt}`)
    }
  }, [editorPrompt])

  useEffect(() => {
    (async () => {
      setState(State.Loading)
      setError(null)
      try {
        const res = await fetch(fileUrl({ key: filekey, auth, ts }))
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
      } catch (e) {
        setError(e)
        setState(State.Idle)
      }
    })();
  }, [filekey, auth, ts])


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
      setError(null)
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

  return <Dialog open={open} onClose={onCloseNoPrompt} fullWidth maxWidth="xl">
    <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
      <span>{({
        [State.Editing]: "Edit",
        [State.Idle]: "Edit",
        [State.Loading]: "Loading...",
        [State.Saving]: "Saving...",
      })[state]} <Link href={fileUrl({ key: filekey, auth, ts })}>{filekey}</Link>
        {changed && <PriorityHighIcon fontSize='small' titleAccess="Unsaved" />}
      </span>
      <span>
        <FormControlLabel label="Prompt" title="Ask confirm on save / reset" control={
          <Checkbox checked={!!editorPrompt} onChange={e => setEditorPrompt(+e.target.checked)} />
        } />
        <IconButton title="Save (Ctrl+S)" color={changed ? "primary" : "inherit"}
          disabled={state !== State.Editing || !changed} onClick={onSave}>
          <SaveIcon />
        </IconButton>
        <IconButton title="Reset" color={changed ? "secondary" : "inherit"}
          disabled={state !== State.Editing || !changed} onClick={onReset}>
          <RestoreIcon />
        </IconButton>
        <IconButton title="Close" disabled={state !== State.Editing && state !== State.Idle}
          onClick={onClose}><CloseIcon /></IconButton>
      </span>
    </DialogTitle>
    <DialogContent onKeyDown={handleKeyDown} sx={{ minHeight: "70vh" }} >
      {!!error && <Typography>{error.toString()}</Typography>}
      {contents !== undefined && <Editor
        key={filekey}
        height="70vh"
        defaultLanguage={language}
        defaultValue={contents}
        onChange={onChange}
        options={{ readOnly: state !== State.Editing, wordWrap: "on" }}
        onMount={(editor) => editorRef.current = editor}
      />}
    </DialogContent>
  </Dialog >;
}
