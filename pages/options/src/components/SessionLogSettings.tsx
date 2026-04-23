import { useState, useCallback } from 'react';
import { sessionLogStore } from '@extension/storage';
import type { SessionLog } from '@extension/storage';
import { FiDownload, FiTrash2, FiRefreshCw } from 'react-icons/fi';

interface Props {
  isDarkMode?: boolean;
}

function outcomeColor(outcome: SessionLog['outcome'], dark: boolean): string {
  switch (outcome) {
    case 'complete':
      return dark ? 'text-green-400' : 'text-green-600';
    case 'cancelled':
      return dark ? 'text-yellow-400' : 'text-yellow-600';
    case 'max_steps':
      return dark ? 'text-orange-400' : 'text-orange-600';
    default:
      return dark ? 'text-red-400' : 'text-red-600';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export const SessionLogSettings = ({ isDarkMode = false }: Props) => {
  const [logs, setLogs] = useState<SessionLog[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [status, setStatus] = useState('');

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-blue-100 bg-white';
  const heading = isDarkMode ? 'text-gray-200' : 'text-gray-800';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const body = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await sessionLogStore.getAll();
      all.sort((a, b) => b.startedAt - a.startedAt);
      setLogs(all);
    } finally {
      setLoading(false);
    }
  }, []);

  const exportAll = useCallback(async () => {
    const all = logs ?? (await sessionLogStore.getAll());
    const json = JSON.stringify(all, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nanobrowser-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${all.length} session${all.length !== 1 ? 's' : ''}.`);
  }, [logs]);

  const clearAll = useCallback(async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    await sessionLogStore.clear();
    setLogs([]);
    setClearConfirm(false);
    setStatus('Session logs cleared.');
  }, [clearConfirm]);

  const sessionCount = logs?.length ?? null;
  const totalSteps = logs?.reduce((acc, l) => acc + l.steps, 0) ?? null;
  const totalDuration = logs?.reduce((acc, l) => acc + (l.completedAt - l.startedAt), 0) ?? null;

  return (
    <section className="space-y-6">
      <div className={`rounded-lg border ${card} p-6 text-left shadow-sm`}>
        <h2 className={`mb-1 text-xl font-semibold ${heading}`}>Session Logs</h2>
        <p className={`mb-4 text-sm ${sub}`}>
          Every agent run is logged automatically. Export as JSON for debugging or analysis. Max 50 sessions are kept.
        </p>

        {/* Action bar */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
              ${isDarkMode ? 'bg-slate-700 text-gray-200 hover:bg-slate-600' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}
              disabled:opacity-50`}>
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {logs === null ? 'Load sessions' : 'Refresh'}
          </button>

          <button
            onClick={exportAll}
            disabled={logs !== null && logs.length === 0}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
              ${isDarkMode ? 'bg-sky-700 text-white hover:bg-sky-600' : 'bg-sky-600 text-white hover:bg-sky-700'}
              disabled:opacity-50`}>
            <FiDownload className="h-3.5 w-3.5" />
            Export JSON
          </button>

          <button
            onClick={clearAll}
            disabled={logs !== null && logs.length === 0}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
              ${
                clearConfirm
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : isDarkMode
                    ? 'bg-slate-700 text-red-400 hover:bg-slate-600'
                    : 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
              }
              disabled:opacity-50`}>
            <FiTrash2 className="h-3.5 w-3.5" />
            {clearConfirm ? 'Confirm clear' : 'Clear all'}
          </button>

          {clearConfirm && (
            <button onClick={() => setClearConfirm(false)} className={`text-sm ${sub} underline`}>
              Cancel
            </button>
          )}

          {status && <span className={`text-sm ${sub}`}>{status}</span>}
        </div>

        {/* Summary stats */}
        {logs !== null && logs.length > 0 && (
          <div
            className={`mb-4 grid grid-cols-3 gap-3 rounded-md p-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div>
              <div className={`text-xl font-bold ${heading}`}>{sessionCount}</div>
              <div className={`text-xs ${sub}`}>sessions</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${heading}`}>{totalSteps}</div>
              <div className={`text-xs ${sub}`}>total steps</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${heading}`}>{formatDuration(totalDuration ?? 0)}</div>
              <div className={`text-xs ${sub}`}>total time</div>
            </div>
          </div>
        )}

        {/* Session list */}
        {logs === null && <p className={`text-sm ${sub}`}>Click "Load sessions" to see stored logs.</p>}

        {logs !== null && logs.length === 0 && (
          <p className={`text-sm ${sub}`}>No sessions logged yet. Run a task to start capturing data.</p>
        )}

        {logs !== null && logs.length > 0 && (
          <ul className="space-y-2">
            {logs.map(log => {
              const duration = log.completedAt - log.startedAt;
              const date = new Date(log.startedAt).toLocaleString();
              return (
                <li
                  key={log.id}
                  className={`rounded-md border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-700/40' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${body}`} title={log.task}>
                        {log.task}
                      </p>
                      <p className={`mt-0.5 text-xs ${sub}`}>
                        {date} · {log.steps} steps · {formatDuration(duration)} · {log.navigatorModel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold uppercase ${outcomeColor(log.outcome, isDarkMode)}`}>
                      {log.outcome.replace('_', ' ')}
                    </span>
                  </div>
                  {log.finalAnswer && (
                    <p className={`mt-1.5 text-xs ${sub} line-clamp-2`}>
                      <span className="font-medium">Answer:</span> {log.finalAnswer}
                    </p>
                  )}
                  {log.errorMessage && (
                    <p className={`mt-1.5 text-xs text-red-500 line-clamp-2`}>
                      <span className="font-medium">Error:</span> {log.errorMessage}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
