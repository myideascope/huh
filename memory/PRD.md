# AudioForge - Audio Enhancement Application

## Original Problem Statement
Build a browser-based app for PC that allows listening to other peoples conversations via boosting and filtering frequencies. App requires headphones to prevent feedback. Features include user-configurable settings, clean error handling, logging, and ability to save recordings to file.

## User Choices
- Audio input: User-selectable from available devices
- Audio processing: Both basic (EQ) and advanced (noise reduction, voice isolation, filters)
- Recording formats: Both WAV and MP3 (WebM/Opus) available
- Visualizations: Both waveform and frequency spectrum
- Theme: Follows OS configuration (light/dark mode)
- Platform: Browser-based tool using Web Audio API

## Architecture

### Frontend (React)
- **App.js**: Main entry point with theme detection
- **AudioContext.js**: Web Audio API engine (AudioContext, BiquadFilters, AnalyserNode, MediaRecorder)
- **Dashboard.js**: Main control room layout
- **DeviceSelector.js**: Audio input device selection with level meter
- **Equalizer.js**: 5-band EQ (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz)
- **AdvancedFilters.js**: Gain, noise reduction, voice isolation, highpass/lowpass
- **Visualizer.js**: Canvas-based waveform and spectrum analyzer
- **RecordingControls.js**: Record/stop/save with format selection
- **PresetsPanel.js**: Preset management (load/save/delete)
- **LogsPanel.js**: Activity logging display

### Backend (FastAPI)
- **server.py**: REST API for presets, logs, and recording metadata
- MongoDB collections: presets, logs, recordings

## Core Requirements (Static)
1. ✅ Real-time audio passthrough via Web Audio API
2. ✅ User-selectable audio input devices
3. ✅ 5-band equalizer (-12dB to +12dB per band)
4. ✅ Master gain control (0.1x to 5x)
5. ✅ Highpass/lowpass filter toggles with configurable frequencies
6. ✅ Dual visualization (waveform + spectrum)
7. ✅ Recording capability with format selection
8. ✅ Preset system (save/load/delete)
9. ✅ Activity logging
10. ✅ Headphone warning
11. ✅ OS theme detection

## What's Been Implemented (January 2026)
- [x] Complete audio engine with Web Audio API
- [x] All UI components with Shadcn UI
- [x] Backend CRUD for presets
- [x] Default presets (Flat, Voice Clarity, Distant Audio)
- [x] Real-time visualizations
- [x] Recording with download
- [x] Activity logging
- [x] Theme switching

## MOCKED Features
- Noise reduction slider (visual only, no DSP processing)
- Voice isolation slider (visual only, no DSP processing)
- MP3 conversion (saves as WebM/Opus, browser native format)

## Prioritized Backlog

### P0 (Critical) - All Complete ✅
- Core audio functionality
- Device selection
- EQ and filters
- Recording

### P1 (Important) - Future
- Real noise reduction using WebRTC NoiseSuppress
- Real voice isolation using ML models
- True WAV/MP3 conversion via Web Assembly

### P2 (Nice to Have) - Future
- Multiple recording profiles
- Audio file import for processing
- Keyboard shortcuts
- Recording history browser

## Next Action Items
1. Implement actual noise reduction using Web Audio API worklets
2. Add ML-based voice isolation (e.g., RNNoise)
3. Add server-side audio format conversion for true WAV/MP3
4. Add user authentication for cloud preset sync
