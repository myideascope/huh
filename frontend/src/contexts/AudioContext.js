import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const AudioEngineContext = createContext(null);

export const useAudioEngine = () => {
    const context = useContext(AudioEngineContext);
    if (!context) {
        throw new Error('useAudioEngine must be used within AudioEngineProvider');
    }
    return context;
};

// Default EQ settings - 15 band graphic equalizer
// Standard ISO frequencies: 25, 40, 63, 100, 160, 250, 400, 630, 1k, 1.6k, 2.5k, 4k, 6.3k, 10k, 16k Hz
const DEFAULT_EQ = {
    band_25hz: 0,
    band_40hz: 0,
    band_63hz: 0,
    band_100hz: 0,
    band_160hz: 0,
    band_250hz: 0,
    band_400hz: 0,
    band_630hz: 0,
    band_1000hz: 0,
    band_1600hz: 0,
    band_2500hz: 0,
    band_4000hz: 0,
    band_6300hz: 0,
    band_10000hz: 0,
    band_16000hz: 0,
};

// Default advanced filter settings
const DEFAULT_ADVANCED = {
    noise_reduction: 0,
    noise_reduction_mode: 'basic', // 'basic' (spectral gating) or 'ml' (RNNoise)
    voice_isolation: 0,
    gain: 1,
    highpass_enabled: false,
    highpass_frequency: 80,
    lowpass_enabled: false,
    lowpass_frequency: 16000,
    // Human voice focus DSP settings
    human_focus: 0,           // 0-100: Master control for human voice isolation
    formant_boost: 0,         // 0-100: Boost human voice formant frequencies
    presence_boost: 0,        // 0-100: Boost speech clarity range (2-5kHz)
    de_esser: 0,              // 0-100: Reduce harsh sibilance
    rumble_filter: false,     // Remove sub-bass rumble
    air_cut: false,           // Cut high frequencies above speech range
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
    const [workletsLoaded, setWorkletsLoaded] = useState(false);
    const [noiseProfileReady, setNoiseProfileReady] = useState(false);
    const [mlNoiseReductionReady, setMlNoiseReductionReady] = useState(false);
    const [vadProbability, setVadProbability] = useState(0);
    const [humanVoiceReady, setHumanVoiceReady] = useState(false);

    // Refs for Web Audio API
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyserNodeRef = useRef(null);
    const eqFiltersRef = useRef([]);
    const highpassFilterRef = useRef(null);
    const lowpassFilterRef = useRef(null);
    const noiseReductionNodeRef = useRef(null);
    const rnnoiseNodeRef = useRef(null);  // ML-based noise reduction
    const voiceIsolationNodeRef = useRef(null);
    const humanVoiceNodeRef = useRef(null);  // Human voice focus DSP
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

    // Load Audio Worklets
    const loadWorklets = useCallback(async (audioContext) => {
        try {
            addLog('info', 'Loading audio worklet processors...');
            
            // Load basic noise reduction worklet
            await audioContext.audioWorklet.addModule('/worklets/noise-reduction-processor.js');
            addLog('success', 'Basic noise reduction processor loaded');
            
            // Load voice isolation worklet
            await audioContext.audioWorklet.addModule('/worklets/voice-isolation-processor.js');
            addLog('success', 'Voice isolation processor loaded');
            
            // Load human voice focus processor
            try {
                await audioContext.audioWorklet.addModule('/worklets/human-voice-processor.js');
                addLog('success', 'Human voice focus processor loaded');
                setHumanVoiceReady(true);
            } catch (hvErr) {
                addLog('warning', 'Human voice processor not available', { error: hvErr.message });
            }
            
            // Load RNNoise ML worklet
            try {
                await audioContext.audioWorklet.addModule('/worklets/rnnoise-processor.js');
                addLog('success', 'RNNoise ML processor loaded');
                setMlNoiseReductionReady(true);
            } catch (rnnoiseErr) {
                addLog('warning', 'RNNoise ML processor not available', { error: rnnoiseErr.message });
            }
            
            setWorkletsLoaded(true);
            return true;
        } catch (err) {
            addLog('error', 'Failed to load audio worklets', { error: err.message });
            // Continue without worklets - will use fallback
            return false;
        }
    }, [addLog]);


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
            
            // Load worklets
            await loadWorklets(audioContextRef.current);
            
            // Create analyser node for visualization
            analyserNodeRef.current = audioContextRef.current.createAnalyser();
            analyserNodeRef.current.fftSize = 2048;
            analyserNodeRef.current.smoothingTimeConstant = 0.8;

            // Create gain node
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.value = advancedSettings.gain;

            // Create EQ filters (15-band graphic equalizer)
            // ISO standard 1/3 octave center frequencies
            const frequencies = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
            eqFiltersRef.current = frequencies.map((freq, index) => {
                const filter = audioContextRef.current.createBiquadFilter();
                // Use lowshelf for lowest, highshelf for highest, peaking for middle bands
                filter.type = index === 0 ? 'lowshelf' : index === frequencies.length - 1 ? 'highshelf' : 'peaking';
                filter.frequency.value = freq;
                // Q factor for 1/3 octave bandwidth is approximately 4.3
                filter.Q.value = index === 0 || index === frequencies.length - 1 ? 0.7 : 4.3;
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

            // Create noise reduction worklet node if available
            if (workletsLoaded || audioContextRef.current.audioWorklet) {
                try {
                    // Basic noise reduction (spectral gating)
                    noiseReductionNodeRef.current = new AudioWorkletNode(
                        audioContextRef.current,
                        'noise-reduction-processor'
                    );
                    
                    // Listen for messages from the basic worklet
                    noiseReductionNodeRef.current.port.onmessage = (event) => {
                        if (event.data.type === 'noiseProfileReady') {
                            setNoiseProfileReady(true);
                            addLog('success', 'Noise profile learned', { threshold: event.data.threshold.toFixed(4) });
                        } else if (event.data.type === 'learningNoise') {
                            addLog('info', 'Learning ambient noise profile...');
                        }
                    };
                    
                    // ML-based noise reduction (RNNoise)
                    try {
                        rnnoiseNodeRef.current = new AudioWorkletNode(
                            audioContextRef.current,
                            'rnnoise-processor'
                        );
                        
                        // Listen for messages from RNNoise worklet
                        rnnoiseNodeRef.current.port.onmessage = (event) => {
                            if (event.data.type === 'initialized') {
                                if (event.data.success) {
                                    setMlNoiseReductionReady(true);
                                    addLog('success', 'RNNoise ML engine initialized');
                                } else {
                                    addLog('warning', 'RNNoise initialization failed', { error: event.data.error });
                                }
                            } else if (event.data.type === 'vad') {
                                setVadProbability(event.data.probability);
                            }
                        };
                        
                        addLog('info', 'RNNoise ML worklet node created');
                    } catch (rnnoiseErr) {
                        addLog('warning', 'RNNoise not available', { error: rnnoiseErr.message });
                    }
                    
                    // Create voice isolation worklet node
                    voiceIsolationNodeRef.current = new AudioWorkletNode(
                        audioContextRef.current,
                        'voice-isolation-processor'
                    );
                    
                    // Create human voice focus worklet node
                    try {
                        humanVoiceNodeRef.current = new AudioWorkletNode(
                            audioContextRef.current,
                            'human-voice-processor'
                        );
                        addLog('info', 'Human voice focus worklet node created');
                    } catch (hvErr) {
                        addLog('warning', 'Human voice processor not available', { error: hvErr.message });
                    }
                    
                    addLog('success', 'Audio worklet nodes created');
                } catch (err) {
                    addLog('warning', 'Worklet nodes unavailable, using basic processing', { error: err.message });
                }
            }

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
    }, [advancedSettings.gain, advancedSettings.highpass_frequency, advancedSettings.lowpass_frequency, refreshDevices, addLog, loadWorklets, workletsLoaded]);

    // Build and connect the audio processing graph
    const connectAudioGraph = useCallback(() => {
        if (!sourceNodeRef.current || !audioContextRef.current) return;

        try {
            // Disconnect all existing connections
            try {
                sourceNodeRef.current.disconnect();
            } catch (e) { /* Ignore */ }
            
            eqFiltersRef.current.forEach(filter => {
                try { filter.disconnect(); } catch (e) { /* Ignore */ }
            });
            
            if (highpassFilterRef.current) {
                try { highpassFilterRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (lowpassFilterRef.current) {
                try { lowpassFilterRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (noiseReductionNodeRef.current) {
                try { noiseReductionNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (rnnoiseNodeRef.current) {
                try { rnnoiseNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (voiceIsolationNodeRef.current) {
                try { voiceIsolationNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (humanVoiceNodeRef.current) {
                try { humanVoiceNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (gainNodeRef.current) {
                try { gainNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }
            if (analyserNodeRef.current) {
                try { analyserNodeRef.current.disconnect(); } catch (e) { /* Ignore */ }
            }

            // Build the audio graph:
            // Source -> [Highpass] -> [Noise Reduction] -> [Voice Isolation] -> [Human Voice Focus] -> EQ -> [Lowpass] -> Gain -> Analyser -> Destination
            
            let currentNode = sourceNodeRef.current;

            // Optional highpass filter
            if (advancedSettings.highpass_enabled && highpassFilterRef.current) {
                currentNode.connect(highpassFilterRef.current);
                currentNode = highpassFilterRef.current;
            }

            // Noise reduction (choose ML or basic based on mode)
            if (advancedSettings.noise_reduction > 0) {
                if (advancedSettings.noise_reduction_mode === 'ml' && rnnoiseNodeRef.current && mlNoiseReductionReady) {
                    // ML-based noise reduction (RNNoise)
                    currentNode.connect(rnnoiseNodeRef.current);
                    currentNode = rnnoiseNodeRef.current;
                } else if (noiseReductionNodeRef.current) {
                    // Basic spectral gating noise reduction
                    currentNode.connect(noiseReductionNodeRef.current);
                    currentNode = noiseReductionNodeRef.current;
                }
            }

            // Voice isolation worklet (if available and enabled)
            if (voiceIsolationNodeRef.current && advancedSettings.voice_isolation > 0) {
                currentNode.connect(voiceIsolationNodeRef.current);
                currentNode = voiceIsolationNodeRef.current;
            }

            // Human voice focus DSP (if any settings are active)
            const humanVoiceActive = advancedSettings.human_focus > 0 || 
                                     advancedSettings.formant_boost > 0 || 
                                     advancedSettings.presence_boost > 0 ||
                                     advancedSettings.de_esser > 0 ||
                                     advancedSettings.rumble_filter ||
                                     advancedSettings.air_cut;
            if (humanVoiceNodeRef.current && humanVoiceActive) {
                currentNode.connect(humanVoiceNodeRef.current);
                currentNode = humanVoiceNodeRef.current;
            }

            // EQ chain
            eqFiltersRef.current.forEach(filter => {
                currentNode.connect(filter);
                currentNode = filter;
            });

            // Optional lowpass filter
            if (advancedSettings.lowpass_enabled && lowpassFilterRef.current) {
                currentNode.connect(lowpassFilterRef.current);
                currentNode = lowpassFilterRef.current;
            }

            // Gain -> Analyser -> Destination
            currentNode.connect(gainNodeRef.current);
            gainNodeRef.current.connect(analyserNodeRef.current);
            analyserNodeRef.current.connect(audioContextRef.current.destination);

            addLog('info', 'Audio graph connected');
        } catch (err) {
            addLog('error', 'Failed to connect audio graph', { error: err.message });
        }
    }, [advancedSettings.highpass_enabled, advancedSettings.lowpass_enabled, advancedSettings.noise_reduction, advancedSettings.voice_isolation, addLog]);

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

            // Connect the audio graph
            connectAudioGraph();

            setIsListening(true);
            setError(null);
            addLog('success', 'Audio listening started', { device: selectedDevice });

            // Start level metering
            const updateLevel = () => {
                if (analyserNodeRef.current) {
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
    }, [selectedDevice, initializeAudio, connectAudioGraph, addLog]);

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
            setNoiseProfileReady(false);
            addLog('info', 'Audio listening stopped');
            return true;
        } catch (err) {
            addLog('error', 'Failed to stop audio listening', { error: err.message });
            return false;
        }
    }, [addLog]);

    // Update EQ settings
    const updateEQ = useCallback((band, value) => {
        setEqSettings(prev => ({ ...prev, [band]: value }));
        
        // Map band names to filter indices (15-band)
        const bandMap = {
            band_25hz: 0,
            band_40hz: 1,
            band_63hz: 2,
            band_100hz: 3,
            band_160hz: 4,
            band_250hz: 5,
            band_400hz: 6,
            band_630hz: 7,
            band_1000hz: 8,
            band_1600hz: 9,
            band_2500hz: 10,
            band_4000hz: 11,
            band_6300hz: 12,
            band_10000hz: 13,
            band_16000hz: 14,
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
            case 'noise_reduction':
                // Update basic noise reduction
                if (noiseReductionNodeRef.current) {
                    noiseReductionNodeRef.current.port.postMessage({ type: 'setReduction', value });
                    if (value > 0 && advancedSettings.noise_reduction_mode === 'basic' && !noiseProfileReady) {
                        addLog('info', 'Basic noise reduction enabled - learning noise profile');
                    }
                }
                // Update ML noise reduction
                if (rnnoiseNodeRef.current) {
                    rnnoiseNodeRef.current.port.postMessage({ type: 'setEnabled', value: value > 0 });
                    if (value > 0 && advancedSettings.noise_reduction_mode === 'ml') {
                        addLog('info', 'ML noise reduction (RNNoise) enabled');
                    }
                }
                // Reconnect graph if enabling/disabling
                if ((value > 0) !== (advancedSettings.noise_reduction > 0)) {
                    setTimeout(() => {
                        if (isListening) connectAudioGraph();
                    }, 50);
                }
                break;
            case 'noise_reduction_mode':
                // Reconnect graph to switch between basic and ML
                if (advancedSettings.noise_reduction > 0 && isListening) {
                    addLog('info', `Switched to ${value === 'ml' ? 'ML (RNNoise)' : 'Basic'} noise reduction`);
                    setTimeout(() => connectAudioGraph(), 50);
                }
                break;
            case 'voice_isolation':
                if (voiceIsolationNodeRef.current) {
                    voiceIsolationNodeRef.current.port.postMessage({ type: 'setIsolation', value });
                }
                // Reconnect graph if enabling/disabling
                if ((value > 0) !== (advancedSettings.voice_isolation > 0)) {
                    setTimeout(() => {
                        if (isListening) connectAudioGraph();
                    }, 50);
                }
                break;
            case 'highpass_enabled':
            case 'lowpass_enabled':
                if (isListening) {
                    connectAudioGraph();
                }
                break;
            default:
                break;
        }
    }, [connectAudioGraph, isListening, noiseProfileReady, advancedSettings.noise_reduction, advancedSettings.voice_isolation, advancedSettings.noise_reduction_mode, addLog]);

    // Trigger noise profile re-learning
    const learnNoiseProfile = useCallback(() => {
        if (noiseReductionNodeRef.current) {
            noiseReductionNodeRef.current.port.postMessage({ type: 'learnNoise' });
            setNoiseProfileReady(false);
            addLog('info', 'Re-learning noise profile...');
        }
    }, [addLog]);

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
        workletsLoaded,
        noiseProfileReady,
        mlNoiseReductionReady,
        vadProbability,

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
        learnNoiseProfile,
    };

    return (
        <AudioEngineContext.Provider value={value}>
            {children}
        </AudioEngineContext.Provider>
    );
};

export default AudioEngineContext;
