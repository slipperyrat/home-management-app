import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AdminMetricsPage() {
  const { data, error } = useSWR('/api/metrics/summary', fetcher, { refreshInterval: 60000 });

  if (error) {
    return <div className="p-6">Failed to load metrics.</div>;
  }

  if (!data) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>P95 Latency</TableHead>
                <TableHead>Total Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.api.map((row: any) => (
                <TableRow key={row.route}>
                  <TableCell>{row.route}</TableCell>
                  <TableCell>{row.successRate}%</TableCell>
                  <TableCell>{row.p95} ms</TableCell>
                  <TableCell>{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Average Duration</TableHead>
                <TableHead>Queue Depth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.map((row: any) => (
                <TableRow key={row.job}>
                  <TableCell>{row.job}</TableCell>
                  <TableCell>{row.successRate}%</TableCell>
                  <TableCell>{row.avgDuration} ms</TableCell>
                  <TableCell>{row.queueDepth}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
