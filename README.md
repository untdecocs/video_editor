# Audio Video Creator

A lightweight React + TypeScript app for building videos from an audio track and a static image. It includes drag-and-drop upload areas, playback controls, export settings, and browser-based video recording.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`

## Design goals

- Clean three-step workflow: add audio, add image, export video.
- Responsive UI inspired by a minimalist desktop tool.
- Clear export settings for format, resolution, and frame rate.
- Modular component structure aligned with the project specification.

## Export destination and format support

Use **Choose location** to select a filename and folder in browsers that support the File System Access API. Otherwise, the browser saves to its configured Downloads location. The export is recorded using the browser's `MediaRecorder`; MP4 is available only when the browser supports MP4 recording, while WebM support is more common.
