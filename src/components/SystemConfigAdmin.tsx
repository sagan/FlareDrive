import React from 'react';
import { useSystemConfig } from '../commons';
import { Box, Typography } from '@mui/material';

export default function SystemConfigAdmin({ }) {
  const systemConfig = useSystemConfig();
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        System Configuration
      </Typography>
      <Box sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(systemConfig, null, 2)}
        </pre>
      </Box>
    </Box>
  );
}