import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { PublicSystemConfig } from '../../lib/commons';
import { useSystemConfig, useConfig } from '../commons';
import { updateGlobalConfig } from '../app/config';

export default function SystemConfigAdmin({ setSystemConfig }: {
  setSystemConfig: React.Dispatch<React.SetStateAction<PublicSystemConfig>>
}) {
  const systemConfig = useSystemConfig();
  const { auth } = useConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [configText, setConfigText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalConfigText = useMemo(() => {
    return systemConfig ? JSON.stringify(systemConfig, null, 2) : '';
  }, [systemConfig]);

  const isChanged = useMemo(() => configText !== originalConfigText, [configText, originalConfigText]);

  useEffect(() => {
    // This effect sets the initial value and updates the text
    // if the canonical systemConfig changes from outside (e.g., after a save),
    // but only when not in edit mode to avoid overwriting user's changes.
    if (!isEditing) {
      setConfigText(originalConfigText);
    }
  }, [originalConfigText, isEditing]);

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

    let newConfig: PublicSystemConfig;
    try {
      newConfig = JSON.parse(configText);
    } catch (e) {
      setError(`Invalid JSON format: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const newSystemConfig = await updateGlobalConfig(auth, newConfig);
      setSystemConfig(newSystemConfig);
      setIsEditing(false)
    } catch (e) {
      setError(`Failed to save config: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        System Configuration
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
      {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" onClick={handleEdit} disabled={isEditing || !auth}>
          Edit
        </Button>
        <Button variant="contained" onClick={handleCancel} disabled={!isEditing || isSaving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving || !isEditing || !isChanged}>
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
            <li>Each one of the above lists must not be empty and do not start or end with white space or "/".</li>
          </ul>
        </Typography>
      </Box>
    </Box>
  );
}
