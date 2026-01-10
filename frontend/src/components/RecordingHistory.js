import React, { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from './ui/alert-dialog';
import { 
    History, 
    Download, 
    Trash2, 
    Clock, 
    HardDrive,
    CloudUpload,
    Play,
    Pause,
    FileAudio,
    Edit3,
    Check,
    X,
    Loader2
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RecordingHistory = () => {
    const { addLog } = useAudioEngine();
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [playingId, setPlayingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);
    const audioRef = React.useRef(null);

    // Fetch recordings from backend
    const fetchRecordings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API}/recordings?limit=50`);
            setRecordings(response.data);
        } catch (err) {
            addLog('error', 'Failed to fetch recording history', { error: err.message });
        } finally {
            setLoading(false);
        }
    }, [addLog]);

    useEffect(() => {
        if (dialogOpen) {
            fetchRecordings();
        }
    }, [dialogOpen, fetchRecordings]);

    // Format duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Format date
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Download recording
    const handleDownload = async (recording) => {
        try {
            setDownloadingId(recording.id);
            
            if (recording.has_audio_data) {
                // Download from cloud
                const response = await axios.get(`${API}/recordings/${recording.id}/download`, {
                    responseType: 'blob'
                });
                
                const url = URL.createObjectURL(response.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = recording.filename;
                a.click();
                URL.revokeObjectURL(url);
                
                addLog('success', `Downloaded: ${recording.filename}`);
            } else {
                addLog('warning', 'No audio data available for this recording');
            }
        } catch (err) {
            addLog('error', 'Failed to download recording', { error: err.message });
        } finally {
            setDownloadingId(null);
        }
    };

    // Play recording
    const handlePlay = async (recording) => {
        try {
            if (playingId === recording.id) {
                // Stop playing
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                setPlayingId(null);
                return;
            }

            if (!recording.has_audio_data) {
                addLog('warning', 'No audio data available for playback');
                return;
            }

            // Fetch and play
            const response = await axios.get(`${API}/recordings/${recording.id}/download`, {
                responseType: 'blob'
            });
            
            const url = URL.createObjectURL(response.data);
            
            if (audioRef.current) {
                audioRef.current.pause();
            }
            
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => {
                setPlayingId(null);
                URL.revokeObjectURL(url);
            };
            audioRef.current.play();
            setPlayingId(recording.id);
        } catch (err) {
            addLog('error', 'Failed to play recording', { error: err.message });
        }
    };

    // Delete recording
    const handleDelete = async (recordingId) => {
        try {
            await axios.delete(`${API}/recordings/${recordingId}`);
            setRecordings(prev => prev.filter(r => r.id !== recordingId));
            addLog('info', 'Recording deleted from history');
        } catch (err) {
            addLog('error', 'Failed to delete recording', { error: err.message });
        }
    };

    // Start editing notes
    const startEditNotes = (recording) => {
        setEditingId(recording.id);
        setEditNotes(recording.notes || '');
    };

    // Save notes
    const saveNotes = async (recordingId) => {
        try {
            await axios.put(`${API}/recordings/${recordingId}?notes=${encodeURIComponent(editNotes)}`);
            setRecordings(prev => prev.map(r => 
                r.id === recordingId ? { ...r, notes: editNotes } : r
            ));
            setEditingId(null);
            addLog('success', 'Notes saved');
        } catch (err) {
            addLog('error', 'Failed to save notes', { error: err.message });
        }
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingId(null);
        setEditNotes('');
    };

    // Cleanup on dialog close
    useEffect(() => {
        if (!dialogOpen && audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setPlayingId(null);
        }
    }, [dialogOpen]);

    const cloudRecordings = recordings.filter(r => r.has_audio_data);
    const localOnlyRecordings = recordings.filter(r => !r.has_audio_data);

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs"
                    data-testid="recording-history-btn"
                >
                    <History className="w-3 h-3 mr-2" />
                    Recording History ({recordings.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh]" data-testid="recording-history-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Recording History
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[500px] pr-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : recordings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No recordings saved yet</p>
                            <p className="text-xs mt-2">
                                Enable "Save to Cloud" when recording to see them here
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Cloud recordings */}
                            {cloudRecordings.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                        <CloudUpload className="w-3 h-3" />
                                        Cloud Recordings ({cloudRecordings.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {cloudRecordings.map((recording) => (
                                            <RecordingItem
                                                key={recording.id}
                                                recording={recording}
                                                isPlaying={playingId === recording.id}
                                                isEditing={editingId === recording.id}
                                                isDownloading={downloadingId === recording.id}
                                                editNotes={editNotes}
                                                setEditNotes={setEditNotes}
                                                onPlay={() => handlePlay(recording)}
                                                onDownload={() => handleDownload(recording)}
                                                onDelete={() => handleDelete(recording.id)}
                                                onStartEdit={() => startEditNotes(recording)}
                                                onSaveNotes={() => saveNotes(recording.id)}
                                                onCancelEdit={cancelEdit}
                                                formatDuration={formatDuration}
                                                formatFileSize={formatFileSize}
                                                formatDate={formatDate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Local-only recordings (metadata only) */}
                            {localOnlyRecordings.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                        <HardDrive className="w-3 h-3" />
                                        Local Records ({localOnlyRecordings.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {localOnlyRecordings.map((recording) => (
                                            <RecordingItem
                                                key={recording.id}
                                                recording={recording}
                                                isPlaying={false}
                                                isEditing={editingId === recording.id}
                                                isDownloading={false}
                                                editNotes={editNotes}
                                                setEditNotes={setEditNotes}
                                                onPlay={() => {}}
                                                onDownload={() => {}}
                                                onDelete={() => handleDelete(recording.id)}
                                                onStartEdit={() => startEditNotes(recording)}
                                                onSaveNotes={() => saveNotes(recording.id)}
                                                onCancelEdit={cancelEdit}
                                                formatDuration={formatDuration}
                                                formatFileSize={formatFileSize}
                                                formatDate={formatDate}
                                                isLocalOnly
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

// Recording item component
const RecordingItem = ({
    recording,
    isPlaying,
    isEditing,
    isDownloading,
    editNotes,
    setEditNotes,
    onPlay,
    onDownload,
    onDelete,
    onStartEdit,
    onSaveNotes,
    onCancelEdit,
    formatDuration,
    formatFileSize,
    formatDate,
    isLocalOnly = false
}) => {
    return (
        <div
            className={`p-4 rounded-lg border ${
                isPlaying ? 'bg-primary/10 border-primary/30' : 'bg-card border-border/50'
            }`}
            data-testid={`recording-item-${recording.id}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <FileAudio className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">
                            {recording.filename}
                        </span>
                        {isLocalOnly && (
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                Metadata only
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(recording.duration_seconds)}
                        </span>
                        <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(recording.file_size_bytes)}
                        </span>
                        <span>{formatDate(recording.created_at)}</span>
                    </div>

                    {recording.preset_used && (
                        <div className="mt-2">
                            <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded">
                                Preset: {recording.preset_used}
                            </span>
                        </div>
                    )}

                    {/* Notes section */}
                    {isEditing ? (
                        <div className="mt-3 flex items-center gap-2">
                            <Input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Add notes..."
                                className="h-8 text-xs"
                                autoFocus
                                data-testid="edit-notes-input"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onSaveNotes}
                                className="h-8 w-8 p-0 text-primary"
                                data-testid="save-notes-btn"
                            >
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCancelEdit}
                                className="h-8 w-8 p-0 text-muted-foreground"
                                data-testid="cancel-notes-btn"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : recording.notes ? (
                        <div className="mt-2 flex items-start gap-2">
                            <p className="text-xs text-muted-foreground italic flex-1">
                                "{recording.notes}"
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onStartEdit}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                data-testid="edit-notes-trigger"
                            >
                                <Edit3 className="w-3 h-3" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onStartEdit}
                            className="mt-2 h-6 px-2 text-xs text-muted-foreground"
                            data-testid="add-notes-btn"
                        >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Add notes
                        </Button>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {!isLocalOnly && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onPlay}
                                className={`h-8 w-8 p-0 ${isPlaying ? 'text-primary' : ''}`}
                                data-testid={`play-recording-${recording.id}`}
                            >
                                {isPlaying ? (
                                    <Pause className="w-4 h-4" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDownload}
                                disabled={isDownloading}
                                className="h-8 w-8 p-0"
                                data-testid={`download-recording-${recording.id}`}
                            >
                                {isDownloading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                            </Button>
                        </>
                    )}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                data-testid={`delete-recording-${recording.id}`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete "{recording.filename}"? 
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={onDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
};

export default RecordingHistory;
