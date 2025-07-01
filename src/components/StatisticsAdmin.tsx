import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { HEADER_AUTHORIZATION, STATISTICS_API, FORCR_VARIABLE, humanReadableSize } from '../../lib/commons';
import { useConfig } from '../commons';
import { Statistics, StatisticsSchema } from '../../graphql/statistics';

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
  const [stats, setStats] = useState<Statistics | null>(null);

  const fetchStats = useCallback(async (force = false) => {
    setStats(null);
    if (!auth) {
      return;
    };
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${STATISTICS_API}?${FORCR_VARIABLE}=${force ? "1" : "0"}`, {
        headers: {
          [HEADER_AUTHORIZATION]: auth,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch statistics: ${res.status} ${await res.text()}`);
      }
      const data = StatisticsSchema.parse(await res.json());
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

  const tableData = useMemo(() => {
    const formatNumber = (num: number) => num != null ? num.toLocaleString('en-US') : '-';
    const placeholder = '-';

    return usageLimits.map(limit => {
      let todayStat = placeholder;
      let monthStat = placeholder;

      if (stats) {
        switch (limit.resource) {
          case 'Workers Requests':
            todayStat = formatNumber(stats.workersRequestsToday);
            break;
          case 'R2 (Standard storage) Storage':
            // Storage is a snapshot, best represented as a monthly-billed value
            monthStat = humanReadableSize(stats.r2TotalStorage);
            break;
          case 'R2 (Standard storage) Class A Ops (write/list)':
            monthStat = formatNumber(stats.r2OperationsAThisMonth);
            break;
          case 'R2 (Standard storage) Class B Ops (read)':
            monthStat = formatNumber(stats.r2OperationsBThisMonth);
            break;
          case 'D1 Rows Read':
            todayStat = formatNumber(stats.d1RowsReadToday);
            break;
          case 'D1 Rows Written':
            todayStat = formatNumber(stats.d1RowsWrittenToday);
            break;
          // KV and D1 Storage stats are not in the API response, so they remain '-'
          default:
            break;
        }
      }

      return {
        ...limit,
        today: todayStat,
        month: monthStat,
      };
    });
  }, [stats]);

  return (
    <Card>
      <CardHeader
        title="Statistics"
        action={<>
          <CircularProgress size={16} style={{ visibility: loading ? "visible" : "hidden" }} />
          <Button onClick={() => fetchStats(true)} disabled={loading || !auth}>Force Update</Button>
          <Button onClick={() => fetchStats()} disabled={loading || !auth}>Refresh</Button>
        </>}
      />
      <CardContent>
        {!!error && <Typography color="error">Error: {error.message}</Typography>}
        <Typography>Data date: {stats ? stats.date.toISOString().slice(0, 19) + "Z" : "-"}</Typography>
        <TableContainer component={Paper}>
          <Table aria-label="usage and limits table">
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell align="right">Today</TableCell>
                <TableCell align="right">This Month</TableCell>
                <TableCell align="right">Free Plan (Free Tier)</TableCell>
                <TableCell align="right">Paid Plan (Workers Paid)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.resource}>
                  <TableCell component="th" scope="row">
                    {row.resource}
                  </TableCell>
                  <TableCell align="right">{row.today}</TableCell>
                  <TableCell align="right">{row.month}</TableCell>
                  <TableCell align="right">{row.free}</TableCell>
                  <TableCell align="right">{row.paid}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
          This is the usage data of your whole Cloudflare account.&nbsp;
          Limits data from Cloudflare documents:&nbsp;
          <a href="https://developers.cloudflare.com/workers/platform/pricing/">Workers Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/r2/pricing/">R2 Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/kv/platform/pricing/">KV Pricing</a>,&nbsp;
          <a href="https://developers.cloudflare.com/d1/platform/pricing/">D1 Pricing</a>.
        </Typography>
      </CardContent>
    </Card>
  );
}