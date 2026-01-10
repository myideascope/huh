import React, { useState } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Circle, Square, Download, CloudUpload, Loader2 } from 'lucide-react';
import RecordingHistory from './RecordingHistory';
import { SyncStatus } from './UserMenu';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RecordingControls = () => {
    const {
        isListening,
        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        addLog,
    } = useAudioEngine();

    const [selectedFormat, setSelectedFormat] = useState('webm');
    const [saveToCloud, setSaveToCloud] = useState(true);
    const [recordingNotes, setRecordingNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    const handleStartRecording = async () => {
        if (!isListening) {
            addLog('warning', 'Start listening before recording');
            return;
        }
        await startRecording();
    };

    const handleStopAndSave = async () => {
        const result = await stopRecording();
        if (!result) {
            addLog('error', 'No recording to save');
            return;
        }

        const { blob, duration } = result;
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audioforge-${timestamp}.${selectedFormat}`;

        if (saveToCloud) {
            // Upload to cloud
            setIsUploading(true);
            try {
                // Convert blob to base64
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                
                await new Promise((resolve, reject) => {
                    reader.onloadend = async () => {
                        try {
                            const base64data = reader.result;
                            
                            const formData = new FormData();
                            formData.append('audio_data', base64data);
                            formData.append('filename', filename);
                            formData.append('format', selectedFormat);
                            formData.append('duration_seconds', duration.toString());
                            formData.append('file_size_bytes', blob.size.toString());
                            if (recordingNotes.trim()) {
                                formData.append('notes', recordingNotes.trim());
                            }
                            
                            await axios.post(`${API}/recordings/upload`, formData, {
                                headers: {
                                    'Content-Type': 'multipart/form-data'
                                }
                            });
                            
                            addLog('success', `Saved to cloud: ${filename}`, {
                                duration: duration.toFixed(1),
                                size: (blob.size / 1024).toFixed(1) + ' KB',
                            });
                            
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    };
                    reader.onerror = reject;
                });
                
                setRecordingNotes('');
            } catch (err) {
                addLog('error', 'Failed to upload to cloud', { error: err.message });
                // Fall back to local download
                downloadLocally(blob, filename);
            } finally {
                setIsUploading(false);
            }
        } else {
            // Local download only
            downloadLocally(blob, filename);
            
            // Still save metadata to backend
            try {
                await axios.post(`${API}/recordings`, {
                    filename,
                    format: selectedFormat,
                    duration_seconds: duration,
                    file_size_bytes: blob.size,
                    notes: recordingNotes.trim() || null
                });
            } catch (err) {
                // Ignore metadata save error
            }
            
            setRecordingNotes('');
        }
    };

    const downloadLocally = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        addLog('success', `Downloaded locally: ${filename}`);
    };

    return (
        <div className="control-card space-y-4" data-testid="recording-controls-panel">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Circle className="w-4 h-4" />
                Recording
            </h3>

            {/* Recording duration display */}
            <div
                className={`flex items-center justify-center gap-3 py-4 rounded-lg ${
                    isRecording ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'
                }`}
                data-testid="recording-duration-display"
            >
                {isRecording && (
                    <div className="recording-dot" data-testid="recording-indicator" />
                )}
                <span className="text-3xl font-mono time-display" data-testid="duration-value">
                    {formatDuration(recordingDuration)}
                </span>
            </div>

            {/* Format selection */}
            <div className="space-y-2">
                <Label className="label-text">Output Format</Label>
                <Select
                    value={selectedFormat}
                    onValueChange={setSelectedFormat}
                    disabled={isRecording}
                    data-testid="format-select"
                >
                    <SelectTrigger className="w-full bg-background">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="webm" data-testid="format-webm">
                            WebM/Opus (Recommended)
                        </SelectItem>
                        <SelectItem value="wav" data-testid="format-wav">
                            WAV (Larger files)
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Cloud save toggle */}
            <div className="flex items-center justify-between py-2">
                <Label className="label-text flex items-center gap-2">
                    <CloudUpload className="w-3 h-3" />
                    Save to Cloud
                </Label>
                <Switch
                    checked={saveToCloud}
                    onCheckedChange={setSaveToCloud}
                    disabled={isRecording}
                    data-testid="save-to-cloud-toggle"
                />
            </div>
            {saveToCloud && (
                <p className="text-xs text-muted-foreground -mt-2">
                    Recordings will be saved online for later access
                </p>
            )}

            {/* Recording notes (when not recording) */}
            {!isRecording && (
                <div className="space-y-2">
                    <Label className="label-text">Notes (optional)</Label>
                    <Input
                        value={recordingNotes}
                        onChange={(e) => setRecordingNotes(e.target.value)}
                        placeholder="What is this recording about?"
                        className="text-sm"
                        disabled={isRecording}
                        data-testid="recording-notes-input"
                    />
                </div>
            )}

            {/* Recording controls */}
            <div className="flex gap-3 pt-2">
                {!isRecording ? (
                    <Button
                        onClick={handleStartRecording}
                        disabled={!isListening}
                        className="flex-1 btn-primary"
                        data-testid="start-recording-btn"
                    >
                        <Circle className="w-4 h-4 mr-2 fill-current" />
                        Record
                    </Button>
                ) : (
                    <Button
                        onClick={handleStopAndSave}
                        disabled={isUploading}
                        className="flex-1 btn-destructive"
                        data-testid="stop-save-btn"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Square className="w-4 h-4 mr-2 fill-current" />
                                Stop & Save
                            </>
                        )}
                    </Button>
                )}
            </div>

            {!isListening && (
                <p className="text-xs text-muted-foreground text-center">
                    Start listening to enable recording
                </p>
            )}

            {/* Recording History Button */}
            <RecordingHistory />

            {/* Recording tips */}
            <div className="pt-4 border-t border-border/30 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Recording captures processed audio</li>
                    <li>• Use headphones to prevent feedback</li>
                    <li>• Cloud recordings can be accessed later</li>
                </ul>
            </div>
        </div>
    );
};

export default RecordingControls;
