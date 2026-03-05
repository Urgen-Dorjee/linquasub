<p align="center">
  <h1 align="center">LinguaSub</h1>
  <p align="center">
    AI-powered subtitle generation, translation, and video production suite
    <br />
    <strong>Offline-first &middot; Multi-language &middot; Free &amp; Open Source</strong>
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#keyboard-shortcuts">Shortcuts</a> &middot;
  <a href="#license">License</a>
</p>

---

## Features

### Subtitle Engine
- **AI Transcription** &mdash; Whisper (offline, local) and Google Gemini (cloud) engines
- **Multi-language Translation** &mdash; Translate subtitles into multiple languages simultaneously
- **Speaker Diarization** &mdash; Identify and label speakers with color-coded segments
- **Word-level Timing** &mdash; Precise per-word timestamps for karaoke and effects
- **Subtitle Import** &mdash; Load existing SRT, VTT, and ASS files for editing
- **Style Presets** &mdash; Netflix, YouTube, Cinematic, Minimal &mdash; or fully customize
- **Subtitle Effects** &mdash; Fade, typewriter, pop-in animations via ASS tags
- **Batch Processing** &mdash; Queue multiple videos with the same settings

### Video Editing
- **Non-linear Timeline** &mdash; Multi-track video/audio with drag-and-drop clips
- **Trim, Cut & Split** &mdash; Razor tool and trim handles for precise editing
- **Transitions** &mdash; Crossfade, dissolve, and wipe between clips
- **Speed & Reverse** &mdash; Per-clip playback speed control and reverse
- **Effects & Filters** &mdash; Color filters, blur, vignette, text/image overlays
- **Color Grading** &mdash; Lift/gamma/gain wheels, curves, and LUT import
- **Keyframe Animation** &mdash; Animate position, scale, opacity, rotation with easing curves
- **Audio Mixing** &mdash; Per-track volume, pan, and EQ controls

### AI Features
- **Background Removal** &mdash; Remove or replace video backgrounds (rembg / U2Net)
- **Scene Detection** &mdash; Auto-detect scene boundaries with PySceneDetect
- **Silence Detection** &mdash; Find and remove silent pauses automatically
- **AI Highlights** &mdash; Gemini-powered highlight extraction for social clips
- **B-Roll Suggestions** &mdash; AI-generated search terms + stock footage from Pexels/Pixabay

### Export
- **SRT, VTT, ASS** &mdash; Standard subtitle file formats
- **Burned Video** &mdash; Hard-burn subtitles into video with FFmpeg
- **Karaoke Video** &mdash; Word-by-word highlighted subtitle rendering
- **Configurable Encoding** &mdash; H.264/H.265, adjustable CRF quality

---

## Getting Started

### Prerequisites
- **Node.js** 18+
- **Python** 3.10+
- **FFmpeg** (auto-downloaded during setup)

### Installation

```bash
# Clone the repository
git clone https://github.com/Urgen-Dorjee/linquasub.git
cd linquasub

# Install Node dependencies
npm install

# Set up Python backend and download FFmpeg
npm run setup:all
```

### Development

```bash
# Start the Electron app with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Production Build

```bash
# Build everything (backend + frontend + installer)
npm run build
```

This produces a Windows NSIS installer and portable zip in the output directory.

---

## Architecture

```
LinguaSub/
├── electron/              # Electron main process
│   ├── main.ts            # Window management, backend lifecycle
│   ├── preload.ts         # Context bridge API
│   └── auto-updater.ts    # GitHub Releases auto-update
├── src/                   # React renderer
│   ├── pages/             # Route pages (Home, Editor, Export, Batch, Settings)
│   ├── components/
│   │   ├── common/        # ErrorBoundary, WelcomeDialog, Tooltip, PageTransition
│   │   ├── editor/        # SubtitleRow, SubtitleEditor (virtualized)
│   │   ├── timeline/      # Timeline, TimelineTrack, TimelineClip, Ruler, Playhead
│   │   ├── preview/       # VideoPlayer, WaveformDisplay
│   │   ├── input/         # VideoDropZone, InputPanel
│   │   ├── export/        # ExportPanel, StyleEditor
│   │   ├── translation/   # TranslationPanel (virtualized)
│   │   ├── transcription/ # TranscriptionControls
│   │   └── layout/        # Sidebar, Header, NLE layout
│   ├── stores/            # Zustand state management
│   │   ├── projectStore       # Video file, metadata
│   │   ├── transcriptionStore # Segments, undo/redo history
│   │   ├── translationStore   # Multi-track translations
│   │   ├── exportStore        # Export options, style presets
│   │   ├── timelineStore      # Timeline clips, tracks, playhead
│   │   ├── batchStore         # Batch job queue
│   │   ├── keyframeStore      # Property keyframes with easing
│   │   ├── pluginStore        # Plugin registration
│   │   └── settingsStore      # Engine config, API keys, GPU
│   ├── hooks/             # useKeyboardShortcuts, useWebSocket, useSessionPersistence
│   └── services/          # API client, transcription/export orchestration, error logger
├── backend/               # Python FastAPI server
│   ├── main.py            # FastAPI app, CORS, lifespan
│   ├── routers/           # REST endpoints (transcription, translation, export, batch, analysis)
│   ├── services/          # Business logic
│   │   ├── ffmpeg_service              # FFmpeg operations
│   │   ├── gemini_transcription_service # Gemini AI transcription
│   │   ├── gemini_translation_service   # Gemini AI translation
│   │   ├── background_service           # AI background removal
│   │   ├── scene_detection_service      # PySceneDetect
│   │   ├── diarization_service          # Speaker identification
│   │   ├── highlights_service           # AI highlight extraction
│   │   └── ...
│   └── core/              # Task manager, WebSocket progress
└── resources/             # FFmpeg binaries, app icons
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33 |
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 3, Radix UI, Framer Motion |
| State | Zustand 5 with undo/redo middleware |
| Virtualization | @tanstack/react-virtual |
| Backend | Python FastAPI, WebSocket progress |
| AI | OpenAI Whisper (local), Google Gemini (cloud) |
| Video | FFmpeg, wavesurfer.js |
| Testing | Vitest, React Testing Library |
| Build | electron-builder, GitHub Actions CI/CD |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Left / Right` | Seek -5s / +5s |
| `Ctrl + Enter` | Start transcription |
| `Ctrl + S` | Export |
| `Delete` | Delete selected segments |

---

## Testing

```bash
npm test          # Run all 101 tests
npm run test:watch # Watch mode
```

Test coverage includes:
- **Stores**: transcription, translation, export, batch, project, settings, timeline, keyframe
- **Middleware**: SegmentHistory (undo/redo with 50-entry limit, clone isolation)
- **Components**: ErrorBoundary, WelcomeDialog, SubtitleRow
- **Services**: Error logger
- **Types**: Timeline type validation

---

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2026 [Urgen Dorjee](https://github.com/Urgen-Dorjee)
