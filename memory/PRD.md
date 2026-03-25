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
- Authentication: Emergent-managed Google login (optional)
- Sync: Recordings only (presets remain local)
- Transcription: OpenAI Whisper via Emergent Universal Key

## Architecture

### Frontend (React)
- **App.js**: Main entry point with theme detection and auth routing
- **AuthContext.js**: Emergent Google Auth integration
- **AudioContext.js**: Web Audio API engine with AudioWorklet support for DSP
- **Dashboard.js**: Main control room layout with UserMenu
- **UserMenu.js**: Sign in/out and sync status
- **AuthCallback.js**: OAuth callback handler
- **DeviceSelector.js**: Audio input device selection with level meter
- **Equalizer.js**: 15-band EQ (ISO 1/3 octave)
- **AdvancedFilters.js**: Gain, noise reduction, voice isolation, highpass/lowpass, human voice focus DSP
- **Visualizer.js**: Canvas-based waveform and spectrum analyzer
- **RecordingControls.js**: Record/stop/save with format selection and cloud upload
- **RecordingHistory.js**: Cloud recording history with playback, download, and transcription
- **TranscriptionPanel.js**: Live real-time transcription with toggle (default OFF)
- **PresetsPanel.js**: Preset management (load/save/delete)
- **LogsPanel.js**: Activity logging display

### Backend (FastAPI)
- **server.py**: REST API for auth, presets, logs, recordings, and transcription
- MongoDB collections: users, user_sessions, presets, logs, recordings

### Audio Worklets (DSP)
- **noise-reduction-processor.js**: Basic spectral gating with noise floor estimation
- **rnnoise-processor.js**: ML-based noise reduction using RNNoise neural network
- **voice-isolation-processor.js**: Bandpass filtering with formant enhancement
- **human-voice-processor.js**: Advanced human speech isolation (formant boost, presence, de-esser, rumble/air filters)

## Core Requirements (Static)
1. Real-time audio passthrough via Web Audio API
2. User-selectable audio input devices
3. 15-band equalizer (-12dB to +12dB per band)
4. Master gain control (0.1x to 5x)
5. Highpass/lowpass filter toggles with configurable frequencies
6. Dual visualization (waveform + spectrum)
7. Recording capability with format selection
8. Preset system (save/load/delete)
9. Activity logging
10. Headphone warning
11. OS theme detection
12. User authentication (optional)
13. Cross-device recording sync
14. Human voice focus DSP (formant boost, presence, de-esser, rumble/air cut)
15. Voice-to-text transcription (live + recording)

## API Endpoints

### Authentication
- `POST /api/auth/session` - Exchange Emergent session_id for app session
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout and clear session

### Presets
- `GET /api/presets` - List all presets
- `POST /api/presets` - Create preset
- `GET /api/presets/{id}` - Get single preset
- `PUT /api/presets/{id}` - Update preset
- `DELETE /api/presets/{id}` - Delete preset

### Recordings
- `GET /api/recordings` - List user's recordings (filtered by auth)
- `POST /api/recordings` - Save metadata only
- `POST /api/recordings/upload` - Upload with audio data (base64)
- `GET /api/recordings/{id}` - Get recording metadata
- `GET /api/recordings/{id}/download` - Download audio file
- `PUT /api/recordings/{id}` - Update notes
- `DELETE /api/recordings/{id}` - Delete recording

### Transcription
- `POST /api/transcribe/live` - Transcribe live audio chunk (base64 webm)
- `POST /api/transcribe/recording/{id}` - Transcribe saved recording, store transcript
- `GET /api/recordings/{id}/transcript` - Get saved transcript

### Logs
- `GET /api/logs` - List activity logs
- `POST /api/logs` - Create log entry
- `DELETE /api/logs` - Clear all logs

## Prioritized Backlog

### P0 (Critical) - All Complete
- Core audio functionality
- Device selection, EQ and filters
- Recording, User authentication
- Human voice focus DSP
- Voice-to-text transcription

### P1 (Important) - Future
- Keyboard shortcuts
- Audio file import for processing

### P2 (Nice to Have) - Future
- Shareable public links for cloud recordings
- Multi-track recording
- Recording scheduling
- Audio effects (reverb, compression)
- Preset sync across devices

## Next Action Items
1. Add keyboard shortcuts for common actions (space for listen, R for record)
2. Implement audio file import to process existing recordings
3. Consider shareable links for cloud recordings
