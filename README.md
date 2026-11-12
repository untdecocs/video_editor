# Stillwave Social Video Studio

A client-side React and TypeScript editor for combining one soundtrack with a sequence of images and video clips, framing the result for common social placements, and exporting through the browser's MediaRecorder API.

## Workflow

1. Add one audio track. Its duration determines the exported video's duration.
2. Add multiple image or video clips. Video source audio is muted and is not included in the export.
3. Preview and edit the sequence, select a platform size or custom dimensions, and create the video.

The visual timeline supports clip reordering, video trim in/out points, midpoint splitting, still-image duration, cut/fade transitions, fit/fill, zoom, horizontal and vertical repositioning, rotation, and flips. If visuals run out before the soundtrack, the final visual frame is held. Visuals are trimmed when the soundtrack ends.

## Platform presets

Presets provide practical starting dimensions for YouTube landscape, Instagram Reels, TikTok, X/Twitter landscape, LinkedIn landscape, Pinterest video pins, Facebook Reels, and Snapchat Spotlight. Platform requirements can vary by placement and change over time; verify the target placement's current requirements before publishing. Custom dimensions are available.

## Development

```sh
npm install
npm run dev
npm test
npm run build
npm run readiness:dashboard
```

Timeline helper tests use Node's built-in test runner. The app uses Tailwind CSS for styling.

`npm run build` creates a preview-mode artifact. Public builds are intentionally separate and blocked until the production, release, privacy, and media-readiness records are approved. See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md), [PRIVACY_REVIEW.md](./PRIVACY_REVIEW.md), [MEDIA_LIMITS.md](./MEDIA_LIMITS.md), and [RELEASE_APPROVAL.md](./RELEASE_APPROVAL.md).

## Browser export support

Export is rendered locally with canvas capture, Web Audio, and `MediaRecorder`. MP4 and WebM availability depends on the browser's recorder implementation; the app checks supported MIME types before recording. Safari support varies by macOS/iOS release and selected codec. Exports can be CPU- and memory-intensive for long, high-resolution projects. The browser downloads the finished file when recording completes.

While exporting (inside the progress dialog) and after a successful render, an optional [Buy me a coffee](https://buymeacoffee.com/alexmano12) link lets users support the creator. It opens in a new tab and does not change the exported video or interrupt the download.
