import React, { useState } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Circle, Square, Download, Clock } from 'lucide-react';

const RecordingControls = () => {
    const {
        isListening,
        isRecording,
        recordingDuration,
        startRecording,
        saveRecording,
        addLog,
    } = useAudioEngine();

    const [selectedFormat, setSelectedFormat] = useState('wav');

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
        await saveRecording(selectedFormat);
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
                        <SelectItem value="wav" data-testid="format-wav">
                            WAV (Uncompressed)
                        </SelectItem>
                        <SelectItem value="mp3" data-testid="format-mp3">
                            WebM/Opus (Compressed)
                        </SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {selectedFormat === 'wav'
                        ? 'High quality, larger file size'
                        : 'Good quality, smaller file size'}
                </p>
            </div>

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
                        className="flex-1 btn-destructive"
                        data-testid="stop-save-btn"
                    >
                        <Square className="w-4 h-4 mr-2 fill-current" />
                        Stop & Save
                    </Button>
                )}
            </div>

            {!isListening && (
                <p className="text-xs text-muted-foreground text-center">
                    Start listening to enable recording
                </p>
            )}

            {/* Recording tips */}
            <div className="pt-4 border-t border-border/30 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Recording captures processed audio</li>
                    <li>• Use headphones to prevent feedback</li>
                    <li>• Monitor levels to avoid clipping</li>
                </ul>
            </div>
        </div>
    );
};

export default RecordingControls;
