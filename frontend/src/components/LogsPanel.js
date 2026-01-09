import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Terminal, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

const LogsPanel = () => {
    const { logs, clearLogs } = useAudioEngine();

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getLevelIcon = (level) => {
        switch (level) {
            case 'success':
                return <CheckCircle className="w-3 h-3 text-primary" />;
            case 'warning':
                return <AlertTriangle className="w-3 h-3 text-accent" />;
            case 'error':
                return <AlertCircle className="w-3 h-3 text-destructive" />;
            default:
                return <Info className="w-3 h-3 text-secondary" />;
        }
    };

    const getLevelClass = (level) => {
        switch (level) {
            case 'success':
                return 'log-success';
            case 'warning':
                return 'log-warning';
            case 'error':
                return 'log-error';
            default:
                return 'log-info';
        }
    };

    return (
        <div className="control-card p-0 overflow-hidden" data-testid="logs-panel">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Activity Log
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLogs}
                    className="h-7 px-2 text-xs"
                    disabled={logs.length === 0}
                    data-testid="clear-logs-btn"
                >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                </Button>
            </div>

            <ScrollArea className="h-48 bg-black/50" data-testid="logs-scroll-area">
                <div className="p-2 font-mono text-xs">
                    {logs.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">
                            No activity logged yet
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div
                                key={log.id}
                                className="log-entry flex items-start gap-2"
                                data-testid={`log-entry-${log.id}`}
                            >
                                <span className="text-muted-foreground shrink-0">
                                    [{formatTime(log.timestamp)}]
                                </span>
                                <span className="shrink-0">{getLevelIcon(log.level)}</span>
                                <span className={getLevelClass(log.level)}>
                                    {log.message}
                                    {log.details && (
                                        <span className="text-muted-foreground ml-2">
                                            {JSON.stringify(log.details)}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default LogsPanel;
