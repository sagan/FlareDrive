import React, { useEffect, useMemo, useState } from 'react';
import JSOX from "jsox";
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { GlobalConfig, GlobalConfigSchema } from '../../lib/commons';
import { useGlobalConfig, useConfig } from '../commons';
import { updateGlobalConfig } from '../app/config';

export default function GlobalConfigAdmin({ setGlobalConfig }: {
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>
}) {
  const globalConfig = useGlobalConfig();
  const { auth } = useConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [configText, setConfigText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [originalConfigText, originalCommentText] = useMemo(() => {
    const comment = globalConfig?.comment || "";
    const text = globalConfig ? JSON.stringify({
      ...globalConfig,
      comment: undefined,
      buildConfig: undefined,
    }, undefined, 2) : ''
    return [text, comment];
  }, [globalConfig]);

  const isChanged = useMemo(() => {
    return configText !== originalConfigText || commentText !== originalCommentText;
  }, [configText, originalConfigText, commentText, originalCommentText]);

  useEffect(() => {
    // This effect sets the initial value and updates the text
    // if the canonical globalConfig changes from outside (e.g., after a save),
    // but only when not in edit mode to avoid overwriting user's changes.
    if (!isEditing) {
      setConfigText(originalConfigText);
      setCommentText(originalCommentText);
    }
  }, [originalConfigText, isEditing, originalCommentText]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  }

  const handleSave = async () => {
    if (!auth) {
      setError("Authentication is required to save.");
      return;
    }

    let newConfig: GlobalConfig;
    try {
      newConfig = JSOX.parse(configText);
      newConfig.comment = commentText;
    } catch (e) {
      setError(`Invalid JSON format: ${e}`);
      return;
    }
    try {
      GlobalConfigSchema.parse(newConfig);
    } catch (e) {
      setError(`Invalid config: ${e}`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const newGlobalConfig = await updateGlobalConfig(auth, newConfig);
      setGlobalConfig(newGlobalConfig);
      setIsEditing(false);
    } catch (e) {
      setError(`Failed to save config: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Global Configuration
      </Typography>
      <TextField
        label="Configuration JSON"
        multiline
        disabled={!isEditing}
        rows={15}
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
        variant="outlined"
        fullWidth
        sx={{ mt: 2, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
      />
      <TextField
        label="Comment (admin visible)"
        multiline
        disabled={!isEditing}
        rows={5}
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        variant="outlined"
        fullWidth
        sx={{ mt: 2, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
      />
      {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" onClick={handleEdit} disabled={isEditing || !auth}>
          Edit
        </Button>
        <Button variant="contained" onClick={handleCancel} disabled={!isEditing || isSaving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || !isEditing || !isChanged}>
          Save
        </Button>
        {isSaving && <CircularProgress size={24} />}
      </Box>
      <Box sx={{ mt: 2, color: 'text.secondary' }}>
        <Typography variant="caption" component="div">
          <strong>Configuration fields explanation:</strong>
          <ul>
            <li><code>publicPrefix</code>: An array of path prefixes. Files under these paths are publicly readable.</li>
            <li><code>publicDirPrefix</code>: An array of path prefixes. Directories under these paths are publicly listable. This implies files are also readable.</li>
            <li><code>publicRwdirPrefix</code>: An array of path prefixes. Directories under these paths are publicly writable (upload/modify/delete). This implies directory listing and file reading.</li>
            <li>Each one of the above lists must not be empty and do not start or end with white space or &quot;/&quot;.</li>
            <li><code>mappings</code>: Record&lt;string,string&gt;. Map path prefix to share name. E.g. <code>foo/bar</code> =&gt; <code>tmp</code>, then <code>/foo/bar</code> url is equal with <code>/s/tmp</code> url. Require prefixes in build time wrangler <a href="https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first">run_worker_first</a> config.</li>
            <li><code>hardShareExpiration</code>: If set to true, the share KV object will be automatically deleted after expiration.</li>
          </ul>
        </Typography>
      </Box>
      <Typography variant="h5" gutterBottom>
        Build time config
      </Typography>
      <TextField
        label="Build config"
        multiline
        disabled={true}
        rows={5}
        value={JSON.stringify(globalConfig.buildConfig || {}, null, 2)}
        variant="outlined"
        fullWidth
        sx={{ mt: 2, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
      />
      <Box sx={{ mt: 2, color: 'text.secondary' }}>
        <Typography variant="caption" component="div">
          <strong>To modify build-time configuration:</strong>
          <ul>
            <li><code>run_worker_first</code>: Use <code>RUN_WORKER_FIRST</code> env (JSON string).
              E.g. <code>[&quot;/foo/*&quot;]</code>.
            </li>
          </ul>
        </Typography>
      </Box>
    </Box >
  );
}
