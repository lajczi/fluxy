import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Download, Trash2, Loader2, AlertTriangle, Database, Shield } from 'lucide-react';
import { api } from '../lib/api';

export function MyData() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get<Record<string, unknown>>('/data/me', { skipCache: true });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluxy-data-${(data as any).userId || 'export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setResult('Your data has been downloaded.');
    } catch (err: any) {
      setError(err.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 30000);
      return;
    }

    setDeleting(true);
    setError(null);
    setResult(null);
    try {
      await api.delete('/data/me');
      setResult('All your data has been deleted. Moderation logs and ticket transcripts have been anonymized.');
      setConfirmDelete(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="h-5 w-5" /> Your Data
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          View, export, or delete all the data Fluxy stores about you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> What we store</CardTitle>
          <CardDescription>Fluxy only stores data needed for its features to work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-300">
          <p>- <strong>Personal settings</strong> (custom prefix)</p>
          <p>- <strong>Warnings</strong> you have received in servers</p>
          <p>- <strong>Moderation logs</strong> involving you (as target or moderator)</p>
          <p>- <strong>Ticket messages</strong> you sent in support tickets</p>
          <p>- <strong>Command usage</strong> statistics</p>
          <p>- <strong>Global ban entry</strong> (if applicable)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Export your data</CardTitle>
          <CardDescription>Download a JSON file with everything Fluxy has stored about you</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Download my data</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400"><Trash2 className="h-4 w-4" /> Delete your data</CardTitle>
          <CardDescription>Permanently remove all your data from Fluxy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-400 space-y-1">
            <p>This will:</p>
            <p>- Delete your personal settings and warnings</p>
            <p>- Anonymize your identity in moderation logs and ticket transcripts</p>
            <p>- Delete your command usage statistics</p>
            <p>- Remove you from any guild allowlists</p>
          </div>

          <Separator />

          {confirmDelete && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">This cannot be undone</p>
                <p className="text-xs text-red-400/70 mt-1">Click the button again to confirm permanent deletion.</p>
              </div>
            </div>
          )}

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
            ) : confirmDelete ? (
              <><Trash2 className="h-4 w-4 mr-2" /> Confirm permanent deletion</>
            ) : (
              <><Trash2 className="h-4 w-4 mr-2" /> Delete all my data</>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
          {result}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
