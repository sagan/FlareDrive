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
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { loadLanguage, LanguageName } from '@uiw/codemirror-extensions-langs';
import { EditorView } from '@codemirror/view';

import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  EXPIRES_VARIABLE, HEADER_CONTENT_LENGTH, HTML_VARIABLE, Permission, SCOPE_VARIABLE, TOKEN_VARIABLE,
  appendQueryStringToUrl,
  extname, fileUrl, humanReadableSize, str2int
} from '../lib/commons';
import { EDIT_FILE_SIZE_LIMIT, FileViewerProps, getFilePermission, useConfig, useGlobalConfig } from './commons';
import { CopyButton } from './components';
import { putFile } from './app/transfer';

enum State {
  Idle,
  Editing,
  Loading,
  Saving,
}

// Map extensions to CodeMirror LanguageNames
const extToCodeMirrorLang: Record<string, string> = {
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
  // Additions/Fallbacks
  ".sh": "shell",
  ".sql": "sql",
}

export default function EditorDialog({ filekey, open, close, setError }: FileViewerProps) {
  const globalConfig = useGlobalConfig();
  const { auth, effectiveAuth, authSearchParams, expires, editorPrompt, fullControl,
    setEditorPrompt, editorReadOnly, setEditorReadOnly } = useConfig();

  const [state, setState] = useState<State>(State.Idle);
  const [contents, setContents] = useState<string | undefined>(undefined);
  const [changed, setChanged] = useState(false);
  const [ts, setTs] = useState(+new Date);

  // Ref to access the CodeMirror instance imperatively
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const [permission] = useMemo(() => getFilePermission(filekey, globalConfig), [filekey, globalConfig]);

  // Determine CodeMirror language extension
  const extension = useMemo(() => {
    const ext = extname(filekey);
    const langName = extToCodeMirrorLang[ext];
    return langName ? loadLanguage(langName as LanguageName) : null;
  }, [filekey]);

  const fileLink = useMemo(() => fileUrl({
    key: filekey,
    auth,
    expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
    scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
    token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
    fullControl: auth ? undefined : fullControl,
    raw: true,
    ts
  }), [filekey, auth, expires, authSearchParams, fullControl, ts])

  const onLoad = useCallback(() => {
    void (async () => {
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
        const text = await res.text()
        setContents(text)
        setChanged(false)
        setState(State.Editing)

        // Update Editor Content manually if it's already mounted
        if (editorRef.current?.view) {
          const view = editorRef.current.view;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text }
          });
        }
      } catch (err) {
        setError(err)
        setState(State.Idle)
      }
    })();
  }, [fileLink, setError]);

  useEffect(() => {
    onLoad()
  }, [onLoad]);

  const onChange = useCallback((value: string) => {
    // Only flag as changed if it actually differs from loaded contents
    setChanged(value !== contents)
  }, [contents])

  const onCloseNoPrompt = useCallback(() => {
    if (changed) {
      return
    }
    close()
  }, [close, changed])

  const viewLink = useMemo(() => {
    let link = fileLink
    if (filekey.endsWith(".md")) {
      link = appendQueryStringToUrl(link, HTML_VARIABLE + "=1")
    }
    return link
  }, [fileLink, filekey])

  const onClose = useCallback(() => {
    if (changed && !confirm("Exit? Your edit will be lost.")) {
      return
    }
    close()
  }, [close, changed])

  const onSave = useCallback(async () => {
    if (!editorRef.current?.view) {
      return
    }
    if (editorPrompt && !confirm("Save changes?")) {
      return
    }
    try {
      setState(State.Saving)
      // Get value from CodeMirror View
      const currentContent = editorRef.current.view.state.doc.toString();

      await putFile({ key: filekey, auth: effectiveAuth, body: currentContent })
      setContents(currentContent)
      setChanged(false)
      setTs(+new Date)
    } catch (err) {
      setError(err)
    }
    setState(State.Editing)
  }, [editorPrompt, filekey, effectiveAuth, setError])

  const onReset = useCallback(() => {
    if (!editorRef.current?.view) {
      return
    }
    if (editorPrompt && !confirm("Reset to original contents? all changes will be lost.")) {
      return
    }
    // Set value in CodeMirror View
    const view = editorRef.current.view;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: contents || "" }
    });
  }, [contents, editorPrompt])

  const handleKeyDown: React.KeyboardEventHandler<unknown> = function (event) {
    // ctrl + s
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      if (state === State.Editing) {
        void onSave();
      }
    }
  }

  const permitWrite = !!auth || (effectiveAuth ? fullControl : permission == Permission.OpenRwDir)
  const roMode = !permitWrite || !!editorReadOnly || state !== State.Editing

  return <Dialog open={open} onClose={onCloseNoPrompt} fullScreen>
    <DialogTitle component={Typography} className='single-line' sx={{ p: 1, pb: 0 }}>
      <IconButton title="Close" color='secondary' disabled={state !== State.Editing && state !== State.Idle}
        onClick={onClose}><CloseIcon /></IconButton>
      {({
        [State.Editing]: roMode ? "View" : "Edit",
        [State.Idle]: roMode ? "View" : "Edit",
        [State.Loading]: "Loading...",
        [State.Saving]: "Saving...",
      })[state]}
      <PriorityHighIcon fontSize='small' titleAccess="Unsaved" sx={{ visibility: changed ? "visible" : "hidden" }} />
      <Link href={viewLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent onKeyDown={handleKeyDown} sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Typography className="single-line" sx={{ p: 2, pt: 0 }}>
        {permitWrite && <>
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
            disabled={roMode || !changed} onClick={() => void onSave()}>
            <SaveIcon />
          </IconButton>
          <IconButton title="Reset" color={changed ? "primary" : "inherit"}
            disabled={roMode || !changed} onClick={onReset}>
            <RestoreIcon />
          </IconButton>
        </>}
        <CopyButton isIcon color="secondary" disabled={state === State.Loading} text={() => {
          if (!editorRef.current?.view) {
            return ""
          }
          return editorRef.current.view.state.doc.toString()
        }}><ContentCopyIcon /></CopyButton>
        <IconButton title="Refresh" color='secondary' onClick={onLoad}
          disabled={changed || (state !== State.Editing && state !== State.Idle)}>
          <RefreshIcon />
        </IconButton>
      </Typography>

      {/* Editor Container */}
      <Box sx={{
        flexGrow: 1,
        overflow: 'auto',
        mt: 1,
        borderTop: '1px solid rgba(0,0,0,0.12)',
        fontSize: '14px'
      }}>
        {contents !== undefined && (
          <CodeMirror
            ref={editorRef}
            value={contents}
            height="100%"
            extensions={[
              EditorView.lineWrapping,
              ...(extension ? [extension] : [])
            ]}
            onChange={onChange}
            readOnly={roMode}
            theme="light" // or 'dark'
            basicSetup={{
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
            }}
          />
        )}
      </Box>
    </DialogContent>
  </Dialog >;
}
