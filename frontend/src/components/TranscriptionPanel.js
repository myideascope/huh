import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { 
    MessageSquareText, 
    Loader2, 
    Trash2, 
    Copy, 
    Check,
    CircleDot
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHUNK_INTERVAL_MS = 6000; // Send audio every 6 seconds

const TranscriptionPanel = () => {
    const { isListening, addLog } = useAudioEngine();

    const [liveEnabled, setLiveEnabled] = useState(false);
    const [transcriptLines, setTranscriptLines] = useState([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [copied, setCopied] = useState(false);

    // Refs for live capture
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const intervalRef = useRef(null);
    const destNodeRef = useRef(null);
    const scrollRef = useRef(null);

    // Auto-scroll to bottom when new lines arrive
    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }, [transcriptLines]);

    const sendChunkForTranscription = useCallback(async (blob) => {
        if (blob.size < 1000) return; // skip tiny chunks
        try {
            setIsTranscribing(true);
            const reader = new FileReader();
            const b64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            const res = await axios.post(`${API}/transcribe/live`, { audio_data: b64 });
            const text = res.data?.text?.trim();
            if (text) {
                setTranscriptLines(prev => [...prev, {
                    id: Date.now(),
                    text,
                    timestamp: new Date(),
                }]);
            }
        } catch (err) {
            addLog('error', 'Transcription failed', { error: err.message });
        } finally {
            setIsTranscribing(false);
        }
    }, [addLog]);

    const startLiveCapture = useCallback(() => {
        // Access the audio context and gain node via the provider's refs
        // We need the AudioContext to create a MediaStreamDestination
        const audioCtx = window.__audioForgeCtx;
        const gainNode = window.__audioForgeGain;
        if (!audioCtx || !gainNode) {
            addLog('warning', 'Audio engine not ready for transcription');
            return;
        }

        try {
            const dest = audioCtx.createMediaStreamDestination();
            gainNode.connect(dest);
            destNodeRef.current = dest;

            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }

            const recorder = new MediaRecorder(dest.stream, options);
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start(CHUNK_INTERVAL_MS);
            recorderRef.current = recorder;

            // Every interval, collect the chunks, create a blob, and send
            intervalRef.current = setInterval(() => {
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    chunksRef.current = [];
                    sendChunkForTranscription(blob);
                }
            }, CHUNK_INTERVAL_MS + 500); // slight offset so data is ready

            addLog('info', 'Live transcription started');
        } catch (err) {
            addLog('error', 'Failed to start live transcription', { error: err.message });
        }
    }, [addLog, sendChunkForTranscription]);

    const stopLiveCapture = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        if (destNodeRef.current) {
            try { destNodeRef.current.disconnect(); } catch (e) { /* ok */ }
            destNodeRef.current = null;
        }
        chunksRef.current = [];
        addLog('info', 'Live transcription stopped');
    }, [addLog]);

    // Handle toggle
    const handleToggle = useCallback((enabled) => {
        setLiveEnabled(enabled);
        if (enabled && isListening) {
            startLiveCapture();
        } else {
            stopLiveCapture();
        }
    }, [isListening, startLiveCapture, stopLiveCapture]);

    // Start/stop when listening state changes
    useEffect(() => {
        if (liveEnabled && isListening) {
            startLiveCapture();
        } else if (!isListening) {
            stopLiveCapture();
        }
        return () => stopLiveCapture();
    }, [isListening]); // eslint-disable-line react-hooks/exhaustive-deps

    const clearTranscript = () => setTranscriptLines([]);

    const copyTranscript = () => {
        const text = transcriptLines.map(l => l.text).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const fullText = transcriptLines.map(l => l.text).join(' ');

    return (
        <div className="control-card space-y-4" data-testid="transcription-panel">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4" />
                    Live Transcription
                </h3>
                <div className="flex items-center gap-2">
                    {isTranscribing && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    )}
                    {liveEnabled && isListening && (
                        <CircleDot className="w-3.5 h-3.5 text-destructive animate-pulse" />
                    )}
                    <Switch
                        checked={liveEnabled}
                        onCheckedChange={handleToggle}
                        data-testid="live-transcription-toggle"
                    />
                </div>
            </div>

            {!liveEnabled && (
                <p className="text-xs text-muted-foreground">
                    Enable to transcribe audio in real-time via OpenAI Whisper. Uses credits per chunk.
                </p>
            )}

            {liveEnabled && (
                <>
                    {!isListening && (
                        <p className="text-xs text-accent">
                            Start listening to begin transcription.
                        </p>
                    )}

                    <ScrollArea className="h-[340px] rounded-md border border-border/30 bg-muted/20 p-3" ref={scrollRef} data-testid="transcript-output">
                        {transcriptLines.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                                {isListening ? 'Waiting for speech...' : 'No transcript yet.'}
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {transcriptLines.map((line) => (
                                    <p key={line.id} className="text-sm text-foreground leading-relaxed">
                                        {line.text}
                                    </p>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {transcriptLines.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyTranscript}
                                className="h-7 text-xs"
                                data-testid="copy-transcript-btn"
                            >
                                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearTranscript}
                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                data-testid="clear-transcript-btn"
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Clear
                            </Button>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {transcriptLines.length} segment{transcriptLines.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TranscriptionPanel;
