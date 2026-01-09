import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const AudioEngineContext = createContext(null);

export const useAudioEngine = () => {
    const context = useContext(AudioEngineContext);
    if (!context) {
        throw new Error('useAudioEngine must be used within AudioEngineProvider');
    }
    return context;
};

// Default EQ settings
const DEFAULT_EQ = {
    band_60hz: 0,
    band_230hz: 0,
    band_910hz: 0,
    band_3600hz: 0,
    band_14000hz: 0,
};

// Default advanced filter settings
const DEFAULT_ADVANCED = {
    noise_reduction: 0,
    voice_isolation: 0,
    gain: 1,
    highpass_enabled: false,
    highpass_frequency: 80,
    lowpass_enabled: false,
    lowpass_frequency: 16000,
};

export const AudioEngineProvider = ({ children }) => {
    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [eqSettings, setEqSettings] = useState(DEFAULT_EQ);
    const [advancedSettings, setAdvancedSettings] = useState(DEFAULT_ADVANCED);
    const [inputLevel, setInputLevel] = useState(0);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);

    // Refs for Web Audio API
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyserNodeRef = useRef(null);
    const eqFiltersRef = useRef([]);
    const highpassFilterRef = useRef(null);
    const lowpassFilterRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const animationFrameRef = useRef(null);
    const recordingIntervalRef = useRef(null);
    const recordingStartTimeRef = useRef(null);

    // Logging helper
    const addLog = useCallback((level, message, details = null) => {
        const logEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            level,
            message,
            details,
        };
        setLogs(prev => [logEntry, ...prev].slice(0, 100));
        return logEntry;
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    // Get available audio devices
    const refreshDevices = useCallback(async () => {
        try {
            // Request permission first to get device labels
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const deviceList = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = deviceList.filter(d => d.kind === 'audioinput');
            setDevices(audioInputs);
            addLog('info', `Found ${audioInputs.length} audio input device(s)`);
            
            // Auto-select first device if none selected
            if (!selectedDevice && audioInputs.length > 0) {
                setSelectedDevice(audioInputs[0].deviceId);
            }
            return audioInputs;
        } catch (err) {
            const errorMsg = 'Failed to enumerate audio devices';
            setError(errorMsg);
            addLog('error', errorMsg, { error: err.message });
            return [];
        }
    }, [selectedDevice, addLog]);

    // Initialize audio context
    const initializeAudio = useCallback(async () => {
        try {
            if (audioContextRef.current) {
                addLog('info', 'Audio context already initialized');
                return true;
            }

            // Create audio context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            
            // Create analyser node for visualization
            analyserNodeRef.current = audioContextRef.current.createAnalyser();
            analyserNodeRef.current.fftSize = 2048;
            analyserNodeRef.current.smoothingTimeConstant = 0.8;

            // Create gain node
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.value = advancedSettings.gain;

            // Create EQ filters (5-band)
            const frequencies = [60, 230, 910, 3600, 14000];
            eqFiltersRef.current = frequencies.map((freq, index) => {
                const filter = audioContextRef.current.createBiquadFilter();
                filter.type = index === 0 ? 'lowshelf' : index === 4 ? 'highshelf' : 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;
                return filter;
            });

            // Create highpass filter
            highpassFilterRef.current = audioContextRef.current.createBiquadFilter();
            highpassFilterRef.current.type = 'highpass';
            highpassFilterRef.current.frequency.value = advancedSettings.highpass_frequency;
            highpassFilterRef.current.Q.value = 0.7;

            // Create lowpass filter
            lowpassFilterRef.current = audioContextRef.current.createBiquadFilter();
            lowpassFilterRef.current.type = 'lowpass';
            lowpassFilterRef.current.frequency.value = advancedSettings.lowpass_frequency;
            lowpassFilterRef.current.Q.value = 0.7;

            await refreshDevices();
            setIsInitialized(true);
            setError(null);
            addLog('success', 'Audio engine initialized successfully');
            return true;
        } catch (err) {
            const errorMsg = 'Failed to initialize audio engine';
            setError(errorMsg);
            addLog('error', errorMsg, { error: err.message });
            return false;
        }
    }, [advancedSettings.gain, advancedSettings.highpass_frequency, advancedSettings.lowpass_frequency, refreshDevices, addLog]);

    // Start listening to audio input
    const startListening = useCallback(async () => {
        try {
            if (!audioContextRef.current) {
                await initializeAudio();
            }

            // Resume audio context if suspended
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            // Get user media with selected device
            const constraints = {
                audio: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            };

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
            sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

            // Connect the audio graph:
            // Source -> Highpass -> EQ Filters -> Lowpass -> Gain -> Analyser -> Destination
            let currentNode = sourceNodeRef.current;

            // Optional highpass
            if (advancedSettings.highpass_enabled) {
                currentNode.connect(highpassFilterRef.current);
                currentNode = highpassFilterRef.current;
            }

            // EQ chain
            eqFiltersRef.current.forEach(filter => {
                currentNode.connect(filter);
                currentNode = filter;
            });

            // Optional lowpass
            if (advancedSettings.lowpass_enabled) {
                currentNode.connect(lowpassFilterRef.current);
                currentNode = lowpassFilterRef.current;
            }

            // Gain -> Analyser -> Destination
            currentNode.connect(gainNodeRef.current);
            gainNodeRef.current.connect(analyserNodeRef.current);
            analyserNodeRef.current.connect(audioContextRef.current.destination);

            setIsListening(true);
            setError(null);
            addLog('success', 'Audio listening started', { device: selectedDevice });

            // Start level metering
            const updateLevel = () => {
                if (analyserNodeRef.current && isListening) {
                    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
                    analyserNodeRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setInputLevel(average / 255);
                }
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            return true;
        } catch (err) {
            const errorMsg = 'Failed to start audio listening';
            setError(errorMsg);
            addLog('error', errorMsg, { error: err.message });
            return false;
        }
    }, [selectedDevice, advancedSettings.highpass_enabled, advancedSettings.lowpass_enabled, initializeAudio, addLog, isListening]);

    // Stop listening
    const stopListening = useCallback(() => {
        try {
            // Stop animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Disconnect nodes
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
            }

            // Stop media stream
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }

            setIsListening(false);
            setInputLevel(0);
            addLog('info', 'Audio listening stopped');
            return true;
        } catch (err) {
            addLog('error', 'Failed to stop audio listening', { error: err.message });
            return false;
        }
    }, [addLog]);

    // Reconnect audio graph when settings change
    const reconnectAudioGraph = useCallback(() => {
        if (!isListening || !sourceNodeRef.current) return;

        try {
            // Disconnect everything first
            sourceNodeRef.current.disconnect();
            eqFiltersRef.current.forEach(filter => filter.disconnect());
            highpassFilterRef.current.disconnect();
            lowpassFilterRef.current.disconnect();
            gainNodeRef.current.disconnect();
            analyserNodeRef.current.disconnect();

            // Reconnect with new settings
            let currentNode = sourceNodeRef.current;

            if (advancedSettings.highpass_enabled) {
                currentNode.connect(highpassFilterRef.current);
                currentNode = highpassFilterRef.current;
            }

            eqFiltersRef.current.forEach(filter => {
                currentNode.connect(filter);
                currentNode = filter;
            });

            if (advancedSettings.lowpass_enabled) {
                currentNode.connect(lowpassFilterRef.current);
                currentNode = lowpassFilterRef.current;
            }

            currentNode.connect(gainNodeRef.current);
            gainNodeRef.current.connect(analyserNodeRef.current);
            analyserNodeRef.current.connect(audioContextRef.current.destination);
        } catch (err) {
            addLog('error', 'Failed to reconnect audio graph', { error: err.message });
        }
    }, [isListening, advancedSettings.highpass_enabled, advancedSettings.lowpass_enabled, addLog]);

    // Update EQ settings
    const updateEQ = useCallback((band, value) => {
        setEqSettings(prev => ({ ...prev, [band]: value }));
        
        // Map band names to filter indices
        const bandMap = {
            band_60hz: 0,
            band_230hz: 1,
            band_910hz: 2,
            band_3600hz: 3,
            band_14000hz: 4,
        };
        
        const filterIndex = bandMap[band];
        if (filterIndex !== undefined && eqFiltersRef.current[filterIndex]) {
            eqFiltersRef.current[filterIndex].gain.value = value;
        }
    }, []);

    // Update advanced settings
    const updateAdvanced = useCallback((setting, value) => {
        setAdvancedSettings(prev => ({ ...prev, [setting]: value }));
        
        switch (setting) {
            case 'gain':
                if (gainNodeRef.current) {
                    gainNodeRef.current.gain.value = value;
                }
                break;
            case 'highpass_frequency':
                if (highpassFilterRef.current) {
                    highpassFilterRef.current.frequency.value = value;
                }
                break;
            case 'lowpass_frequency':
                if (lowpassFilterRef.current) {
                    lowpassFilterRef.current.frequency.value = value;
                }
                break;
            case 'highpass_enabled':
            case 'lowpass_enabled':
                reconnectAudioGraph();
                break;
            default:
                break;
        }
    }, [reconnectAudioGraph]);

    // Load preset
    const loadPreset = useCallback((preset) => {
        if (preset.equalizer) {
            Object.entries(preset.equalizer).forEach(([band, value]) => {
                updateEQ(band, value);
            });
        }
        if (preset.advanced) {
            Object.entries(preset.advanced).forEach(([setting, value]) => {
                updateAdvanced(setting, value);
            });
        }
        addLog('success', `Loaded preset: ${preset.name}`);
    }, [updateEQ, updateAdvanced, addLog]);

    // Reset to defaults
    const resetSettings = useCallback(() => {
        Object.entries(DEFAULT_EQ).forEach(([band, value]) => {
            updateEQ(band, value);
        });
        Object.entries(DEFAULT_ADVANCED).forEach(([setting, value]) => {
            updateAdvanced(setting, value);
        });
        addLog('info', 'Settings reset to defaults');
    }, [updateEQ, updateAdvanced, addLog]);

    // Start recording
    const startRecording = useCallback(async () => {
        if (!isListening) {
            addLog('warning', 'Cannot record - not currently listening');
            return false;
        }

        try {
            // Create a destination node for recording
            const dest = audioContextRef.current.createMediaStreamDestination();
            gainNodeRef.current.connect(dest);

            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }

            mediaRecorderRef.current = new MediaRecorder(dest.stream, options);
            recordedChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.start(100);
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingDuration(0);

            // Update duration every 100ms
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration((Date.now() - recordingStartTimeRef.current) / 1000);
            }, 100);

            addLog('success', 'Recording started');
            return true;
        } catch (err) {
            addLog('error', 'Failed to start recording', { error: err.message });
            return false;
        }
    }, [isListening, addLog]);

    // Stop recording and return blob
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || !isRecording) {
                resolve(null);
                return;
            }

            clearInterval(recordingIntervalRef.current);

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                recordedChunksRef.current = [];
                setIsRecording(false);
                
                const duration = recordingDuration;
                addLog('success', `Recording stopped - ${duration.toFixed(1)}s`);
                resolve({ blob, duration });
            };

            mediaRecorderRef.current.stop();
        });
    }, [isRecording, recordingDuration, addLog]);

    // Save recording to file
    const saveRecording = useCallback(async (format = 'wav') => {
        const result = await stopRecording();
        if (!result) {
            addLog('error', 'No recording to save');
            return null;
        }

        const { blob, duration } = result;
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audioforge-${timestamp}.${format === 'mp3' ? 'webm' : 'wav'}`;

        // For simplicity, we save as webm (browser native) and rename
        // Full conversion would require server-side or Web Assembly
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        addLog('success', `Saved recording: ${filename}`, {
            format,
            duration: duration.toFixed(1),
            size: (blob.size / 1024).toFixed(1) + ' KB',
        });

        return { filename, blob, duration };
    }, [stopRecording, addLog]);

    // Get analyser data for visualization
    const getAnalyserData = useCallback(() => {
        if (!analyserNodeRef.current) return { waveform: null, frequency: null };

        const waveformData = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
        const frequencyData = new Uint8Array(analyserNodeRef.current.frequencyBinCount);

        analyserNodeRef.current.getByteTimeDomainData(waveformData);
        analyserNodeRef.current.getByteFrequencyData(frequencyData);

        return { waveform: waveformData, frequency: frequencyData };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopListening();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [stopListening]);

    const value = {
        // State
        isInitialized,
        isListening,
        isRecording,
        devices,
        selectedDevice,
        eqSettings,
        advancedSettings,
        inputLevel,
        recordingDuration,
        error,
        logs,

        // Actions
        initializeAudio,
        refreshDevices,
        setSelectedDevice,
        startListening,
        stopListening,
        updateEQ,
        updateAdvanced,
        loadPreset,
        resetSettings,
        startRecording,
        stopRecording,
        saveRecording,
        getAnalyserData,
        addLog,
        clearLogs,
    };

    return (
        <AudioEngineContext.Provider value={value}>
            {children}
        </AudioEngineContext.Provider>
    );
};

export default AudioEngineContext;
