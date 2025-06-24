import React, { useState, useEffect, useCallback } from 'react';
import { reindexerApi, reindexerStatus } from '../app/reindex';
import { useConfig } from '../commons';
import type { ReindexerPayload, ReindexerStorage } from '../../lib/reindexer';
import { Box, Button, TextField, Typography } from '@mui/material';

export default function ReindexerAdmin({ currentDir }: { currentDir: string }) {
  const config = useConfig();
  const { auth } = config;
  const [state, setState] = useState<ReindexerStorage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pathPrefixInput, setPathPrefixInput] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!config.auth) {
      return;
    }
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await reindexerStatus(auth);
      setState(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to fetch reindexer status');
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    // Update pathPrefixInput when state.pathPrefix changes
    setPathPrefixInput(state?.pathPrefix ?? '');
  }, [state?.pathPrefix]);

  useEffect(() => {
    if (auth) {
      fetchStatus();
    }
  }, [fetchStatus, auth]);

  const handleCommand = async (command: "start" | "stop" | "flush") => {
    if (!auth) {
      return;
    }
    setIsLoading(true);
    setApiError(null);
    try {
      const payload: ReindexerPayload = { command, path_prefix: pathPrefixInput };
      await reindexerApi(auth, payload);
      await fetchStatus(); // Refresh status after command
    } catch (err) {
      setApiError(err instanceof Error ? err.message : `Failed to ${command} reindexer`);
      // Optionally, refetch status even on error to get the latest state
      await fetchStatus();
    }
    // setIsLoading(false) is handled by fetchStatus in the success path
  };

  if (!auth) {
    return <p>Authentication required to manage reindexer.</p>;
  }

  const isRunning = state?.status == "running"

  return <Box>
    <Typography variant="h5" gutterBottom>
      Reindexer Management  {isLoading && <i>Loading...</i>}
    </Typography>
    {apiError && <Typography sx={{ color: 'red' }} gutterBottom>API Error: {apiError}</Typography>}
    {state ? (
      <Box>
        <Box>
          <TextField
            type="text"
            label="Path prefix"
            value={pathPrefixInput}
            onChange={(e) => setPathPrefixInput(e.target.value)}
            disabled={isLoading || isRunning}
          />
          <Button color='secondary'
            onClick={() => setPathPrefixInput('')}
            disabled={isLoading || isRunning}
            title="Set to root directory"
          >
            Root
          </Button>
          <Button color='secondary'
            onClick={() => setPathPrefixInput(currentDir)}
            disabled={isLoading || isRunning}
            title={`Set to current working directory: ${currentDir}`}
          >
            CWD
          </Button>
        </Box>
        <Typography><strong>Status:</strong> {state.status}</Typography>
        {state.startTime && <Typography>Last Start: {new Date(state.startTime).toLocaleString()}</Typography>}
        {state.endTime && <Typography>Last End: {new Date(state.endTime).toLocaleString()}</Typography>}
        <Typography>Processed Items: {state.filesProcessed}</Typography>
        <Typography>Failed Items: {state.filesFailed}</Typography>
        {state.lastError && <Typography sx={{ color: "orange" }}>Last Error: {state.lastError}</Typography>}
      </Box>
    ) : (
      !isLoading && !apiError && <Typography>Could not load reindexer status.</Typography>
    )}

    <Typography gutterBottom>
      <Button color='secondary' onClick={() => handleCommand("start")} disabled={isLoading || isRunning}>
        Start
      </Button>
      <Button color='secondary' onClick={() => handleCommand("stop")} disabled={isLoading}>
        Stop
      </Button>
      <Button color='secondary' onClick={() => {
        if (!confirm(`Flush all indexes of dir "${pathPrefixInput}"`)) {
          return
        }
        handleCommand("flush");
      }} disabled={isLoading}>
        Flush
      </Button>
      <Button color='secondary' onClick={fetchStatus} disabled={isLoading}>
        Refresh
      </Button>
    </Typography>
  </Box>
};
