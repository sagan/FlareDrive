import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { HEADER_AUTHORIZATION, STATISTICS_API, humanReadableSize } from '../../lib/commons';
import { useConfig } from '../commons';
import { GetStatisticsQuery } from '../../graphql/generated/graphql';

// All limits are per-account. Paid plan refers to the "Workers Paid" plan.
const usageLimits = [
  { resource: "Workers Requests", free: "100,000 / day", paid: "10 million included / month + $0.30 / million" },
  { resource: 'R2 (Standard storage) Storage', free: '10 GB / month', paid: 'free tier + $0.015 / GB-month' },
  { resource: 'R2 (Standard storage) Class A Ops (write/list)', free: '1 million / month', paid: 'free tier + $4.50 / million' },
  { resource: 'R2 (Standard storage) Class B Ops (read)', free: '10 million / month', paid: 'free tier + $0.36 / million' },
  { resource: 'KV Storage', free: '1 GiB', paid: '1 GiB included + $0.50 / GiB-month' },
  { resource: 'KV Reads', free: '100,000 / day', paid: '10 million included / month + $0.50 / million' },
  { resource: 'KV Writes', free: '1,000 / day', paid: '1 million included / month + $5.00 / million' },
  { resource: 'KV Deletes', free: '1,000 / day', paid: '1 million included / month + $5.00 / million' },
  { resource: 'KV Lists', free: '1,000 / day', paid: '1 million included / month + $5.00 / million' },
  { resource: 'D1 Storage', free: '5 GB', paid: '5 GB included + $0.75 / GB' },
  { resource: 'D1 Rows Read', free: '5 million / day', paid: '25 billion included / month + $0.001 / million' },
  { resource: 'D1 Rows Written', free: '100,000 / day', paid: '50 million included / month + $1.00 / million' },
];

export default function StatisticsAdmin() {
  const { auth } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [stats, setStats] = useState<GetStatisticsQuery | null>(null);

  const fetchStats = useCallback(async () => {
    setStats(null);
    if (!auth) {
      return;
    };
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(STATISTICS_API, {
        headers: {
          [HEADER_AUTHORIZATION]: auth,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch statistics: ${res.status} ${await res.text()}`);
      }
      const data = await res.json<GetStatisticsQuery>();
      setStats(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalR2Storage = useMemo(() => {
    let stat = stats?.viewer?.accounts[0].r2StorageAdaptiveGroups[0]
    if (!stat?.max) {
      return 0;
    }
    return stat.max.metadataSize + stat.max.payloadSize;
  }, [stats]);

  return (
    <Card>
      <CardHeader
        title="Statistics"
        action={<Button onClick={fetchStats} disabled={loading || !auth}>Refresh</Button>}
      />
      <CardContent>
        {loading && <CircularProgress />}
        {!!error && <Typography color="error">Error: {error.message}</Typography>}
        {!!stats && (<List dense>
          <ListItem>
            <ListItemText primary="Workers Requests (today)"
              secondary={stats.viewer?.accounts[0]?.workersInvocationsAdaptive[0]?.sum?.requests} />
          </ListItem>
          <ListItem>
            <ListItemText primary="R2 Operations A (this month)"
              secondary={stats.viewer?.accounts[0]?.classA[0]?.sum?.requests} />
          </ListItem>
          <ListItem>
            <ListItemText primary="R2 Operations B (this month)"
              secondary={stats.viewer?.accounts[0]?.classB[0]?.sum?.requests} />
          </ListItem>
          <ListItem>
            <ListItemText primary="R2 Total Storage (current)"
              secondary={humanReadableSize(totalR2Storage)} />
          </ListItem>
          <ListItem>
            <ListItemText primary="D1 Rows read (today)"
              secondary={stats.viewer?.accounts[0]?.d1AnalyticsAdaptiveGroups[0]?.sum?.rowsRead} />
          </ListItem>
          <ListItem>
            <ListItemText primary="D1 Rows written (today)"
              secondary={stats.viewer?.accounts[0]?.d1AnalyticsAdaptiveGroups[0]?.sum?.rowsWritten} />
          </ListItem>
        </List>
        )}
        <Typography variant="h6">
          Cloudflare Usage Limits
        </Typography>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="usage limits table">
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell align="right">Free Plan (Free Tier)</TableCell>
                <TableCell align="right">Paid Plan (Workers Paid)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usageLimits.map((row) => (
                <TableRow
                  key={row.resource}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {row.resource}
                  </TableCell>
                  <TableCell align="right">{row.free}</TableCell>
                  <TableCell align="right">{row.paid}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
          Data from Cloudflare documents:&nbsp;
          <a href="https://developers.cloudflare.com/workers/platform/pricing/">Workers Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/r2/pricing/">R2 Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/kv/platform/pricing/">KV Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/d1/platform/pricing/">D1 Pricing</a>.
        </Typography>
      </CardContent>
    </Card>
  );
}