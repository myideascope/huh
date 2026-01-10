# AudioForge - Audio Enhancement Application

## Original Problem Statement
Build a browser-based app for PC that allows listening to other peoples conversations via boosting and filtering frequencies. App requires headphones to prevent feedback. Features include user-configurable settings, clean error handling, logging, and ability to save recordings to file.

## User Choices
- Audio input: User-selectable from available devices
- Audio processing: Both basic (EQ) and advanced (noise reduction, voice isolation, filters)
- Recording formats: Both WAV and WebM/Opus available
- Visualizations: Both waveform and frequency spectrum
- Theme: Follows OS configuration (light/dark mode)
- Platform: Browser-based tool using Web Audio API

## Architecture

### Frontend (React)
- **App.js**: Main entry point with theme detection
- **AudioContext.js**: Web Audio API engine with AudioWorklet support for DSP
- **Dashboard.js**: Main control room layout
- **DeviceSelector.js**: Audio input device selection with level meter
- **Equalizer.js**: 5-band EQ (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz)
- **AdvancedFilters.js**: Gain, noise reduction, voice isolation, highpass/lowpass
- **Visualizer.js**: Canvas-based waveform and spectrum analyzer
- **RecordingControls.js**: Record/stop/save with format selection and cloud upload
- **RecordingHistory.js**: Cloud recording history with playback and download
- **PresetsPanel.js**: Preset management (load/save/delete)
- **LogsPanel.js**: Activity logging display

### Backend (FastAPI)
- **server.py**: REST API for presets, logs, and recordings
- MongoDB collections: presets, logs, recordings

### Audio Worklets (DSP)
- **noise-reduction-processor.js**: Spectral gating with noise floor estimation
- **voice-isolation-processor.js**: Bandpass filtering with formant enhancement

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

## What's Been Implemented

### Phase 1 (January 2026)
- [x] Complete audio engine with Web Audio API
- [x] All UI components with Shadcn UI
- [x] Backend CRUD for presets
- [x] Default presets (Flat, Voice Clarity, Distant Audio)
- [x] Real-time visualizations
- [x] Recording with download
- [x] Activity logging
- [x] Theme switching

### Phase 2 - Real DSP (January 2026)
- [x] AudioWorklet-based noise reduction (spectral gating)
- [x] AudioWorklet-based voice isolation (bandpass + formant enhancement)
- [x] Noise profile learning with re-learn capability
- [x] DSP Active status indicator

### Phase 3 - Recording History (January 2026)
- [x] Cloud storage for recordings (MongoDB with base64 audio)
- [x] Recording History dialog with list view
- [x] In-browser playback of cloud recordings
- [x] Download recordings from cloud
- [x] Add/edit notes on recordings
- [x] Delete recordings with confirmation
- [x] "Save to Cloud" toggle (default: ON)
- [x] Notes input before recording

## API Endpoints

### Presets
- `GET /api/presets` - List all presets
- `POST /api/presets` - Create preset
- `GET /api/presets/{id}` - Get single preset
- `PUT /api/presets/{id}` - Update preset
- `DELETE /api/presets/{id}` - Delete preset

### Recordings
- `GET /api/recordings` - List recordings (without audio data)
- `POST /api/recordings` - Save metadata only
- `POST /api/recordings/upload` - Upload with audio data (base64)
- `GET /api/recordings/{id}` - Get recording metadata
- `GET /api/recordings/{id}/download` - Download audio file
- `PUT /api/recordings/{id}` - Update notes
- `DELETE /api/recordings/{id}` - Delete recording

### Logs
- `GET /api/logs` - List activity logs
- `POST /api/logs` - Create log entry
- `DELETE /api/logs` - Clear all logs

## Prioritized Backlog

### P0 (Critical) - All Complete ✅
- Core audio functionality
- Device selection
- EQ and filters
- Recording

### P1 (Important) - Future
- Streaming/live sharing of enhanced audio
- Audio file import for processing
- Advanced noise reduction (RNNoise ML model)
- Multi-track recording

### P2 (Nice to Have) - Future
- Keyboard shortcuts
- User accounts for preset sync
- Recording scheduling
- Audio effects (reverb, compression)

## Next Action Items
1. Add keyboard shortcuts for common actions (space for listen, R for record)
2. Implement audio file import to process existing recordings
3. Add user authentication for cross-device preset/recording sync
4. Consider integrating ML-based noise reduction (RNNoise WebAssembly)
