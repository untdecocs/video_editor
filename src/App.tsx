import { useEffect, useRef, useState } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { CompositionPreview } from './components/CompositionPreview';
import { ExportProgress } from './components/ExportProgress';
import { TimelineEditor } from './components/TimelineEditor';
import { buildOutputFileName, formatDuration, formatFileSize } from './services/media';
import { getSupportedMimeType, renderVideo } from './services/videoExport';
import {
  defaultTransform,
  formatAspectRatio,
  getClipDuration,
  getTimelineDuration,
  moveClip,
  platformPresets,
  splitClip,
  type TimelineAsset,
  type TimelineClip,
  type VisualTransform,
} from './services/timeline';

const steps = ['Audio', 'Visuals', 'Edit & export'];

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function App() {
  const [step, setStep] = useState(1);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [assets, setAssets] = useState<TimelineAsset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presetId, setPresetId] = useState('youtube');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [frameRate, setFrameRate] = useState(30);
  const [format, setFormat] = useState('MP4');
  const [statusMessage, setStatusMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasExportingRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const preset = platformPresets.find((item) => item.id === presetId) ?? platformPresets[0];
  const width = presetId === 'custom' ? customWidth : preset.width;
  const height = presetId === 'custom' ? customHeight : preset.height;
  const timelineDuration = getTimelineDuration(clips);
  const audioMeta = {
    fileName: audioFile?.name ?? 'No audio selected',
    fileSize: audioFile ? formatFileSize(audioFile.size) : '0 KB',
    detectedType: audioFile?.type || 'audio',
  };

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    mainRef.current?.toggleAttribute('inert', isExporting);
  }, [isExporting]);
  useEffect(() => {
    if (wasExportingRef.current && !isExporting) exportButtonRef.current?.focus();
    wasExportingRef.current = isExporting;
  }, [isExporting]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) void audio.play().catch(() => {
      setIsPlaying(false);
      setStatusMessage('Playback was blocked by the browser. Press play to try again.');
    });
    else audio.pause();
  }, [audioUrl, isPlaying]);
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (isPlaying) void video.play().catch(() => undefined);
    else video.pause();
  }, [isPlaying, currentTime, selectedClipId]);

  const readAudioDuration = (file: File) => new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    urlsRef.current.push(url);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = url;
  });

  const handleAudioSelect = async (file: File) => {
    if (file.size === 0) {
      setStatusMessage('This audio file is empty. Choose a valid audio file and try again.');
      return;
    }
    const duration = await readAudioDuration(file);
    const url = URL.createObjectURL(file);
    urlsRef.current.push(url);
    setAudioFile(file);
    setAudioUrl(url);
    setAudioDuration(duration);
    setCurrentTime(0);
    setStatusMessage(duration > 0 ? `Loaded ${file.name}` : 'Audio loaded, but its duration could not be read.');
  };

  const handleAddVisuals = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) => file.size > 0);
    const newAssets = await Promise.all(files.map(async (file): Promise<TimelineAsset | null> => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v'].includes(extension ?? '');
      const kind = isVideo ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      const duration = kind === 'image' ? 5 : await new Promise<number>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : 0);
        video.onerror = () => resolve(0);
        video.src = url;
      });
      if (kind === 'image') {
        const image = new Image();
        image.src = url;
        try { await image.decode(); } catch {
          URL.revokeObjectURL(url);
          urlsRef.current = urlsRef.current.filter((item) => item !== url);
          return null;
        }
      }
      if (kind === 'video' && duration <= 0) {
        URL.revokeObjectURL(url);
        urlsRef.current = urlsRef.current.filter((item) => item !== url);
        return null;
      }
      return { id: newId(), file, url, kind, duration };
    }));
    const validAssets = newAssets.filter((asset): asset is TimelineAsset => Boolean(asset));
    const newClips = validAssets.map((asset): TimelineClip => ({
      id: newId(),
      assetId: asset.id,
      start: 0,
      end: asset.kind === 'video' ? asset.duration : 0,
      stillDuration: 5,
      transition: 'none',
      transform: { ...defaultTransform },
    }));
    setAssets((current) => [...current, ...validAssets]);
    setClips((current) => [...current, ...newClips]);
    if (newClips.length) setSelectedClipId(newClips[0].id);
    setStatusMessage(validAssets.length ? `Added ${validAssets.length} visual clip${validAssets.length === 1 ? '' : 's'}.` : 'No supported image or video files could be loaded.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateClip = (id: string, patch: Partial<TimelineClip>) => {
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, ...patch } : clip));
  };
  const updateTransform = (id: string, patch: Partial<VisualTransform>) => {
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, transform: { ...clip.transform, ...patch } } : clip));
  };
  const removeClip = (id: string) => {
    const nextClips = clips.filter((clip) => clip.id !== id);
    const removed = assets.find((asset) => asset.id === clips.find((clip) => clip.id === id)?.assetId);
    setClips(nextClips);
    if (removed && !nextClips.some((clip) => clip.assetId === removed.id)) {
      setAssets((current) => current.filter((asset) => asset.id !== removed.id));
      URL.revokeObjectURL(removed.url);
      urlsRef.current = urlsRef.current.filter((url) => url !== removed.url);
    }
    setSelectedClipId(nextClips[0]?.id ?? '');
  };

  const handleSplit = (id: string) => {
    const clip = clips.find((item) => item.id === id);
    if (!clip || clip.end - clip.start < 0.2) return;
    const next = splitClip(clips, id, clip.start + (clip.end - clip.start) / 2);
    setClips(next);
    if (next.length > clips.length) setSelectedClipId(next[next.findIndex((item) => item.id === id) + 1].id);
  };

  const startNewVideo = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    previewVideoRef.current?.pause();
    previewVideoRef.current?.removeAttribute('src');
    previewVideoRef.current?.load();
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    setStep(1);
    setAudioFile(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setAssets([]);
    setClips([]);
    setSelectedClipId('');
    setCurrentTime(0);
    setIsPlaying(false);
    setPresetId('youtube');
    setCustomWidth(1920);
    setCustomHeight(1080);
    setFrameRate(30);
    setFormat('MP4');
    setStatusMessage('');
    setExportProgress(0);
    setExportComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    if (!audioFile || clips.length === 0) {
      setStatusMessage('Add a soundtrack and at least one visual clip before exporting.');
      return;
    }
    const mimeType = getSupportedMimeType(format);
    if (!mimeType) {
      setStatusMessage(`${format} recording is not supported in this browser. Choose another format or use a supported browser.`);
      return;
    }
    setIsPlaying(false);
    setIsExporting(true);
    setExportComplete(false);
    setExportProgress(0);
    setStatusMessage('Preparing your video…');
    try {
      const blob = await renderVideo({
        audioFile,
        assets,
        clips,
        width,
        height,
        frameRate,
        mimeType,
        onProgress: (progress) => {
          setExportProgress(progress);
          setStatusMessage(`Creating your video · ${Math.round(progress)}%`);
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildOutputFileName(audioFile.name, format.toLowerCase(), preset.id);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportProgress(100);
      setExportComplete(true);
      setStatusMessage('Export complete. Your video is downloading.');
    } catch (error) {
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const canContinue = step === 1 ? Boolean(audioFile && audioDuration > 0) : clips.length > 0;
  const stepsComplete = [Boolean(audioFile), clips.length > 0, false];
  const playPause = () => {
    if (currentTime >= audioDuration) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    setIsPlaying((playing) => !playing);
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-neutral-200 px-5 py-4 md:px-10">
        <a className="flex items-center gap-3 text-sm font-bold tracking-wide text-ink no-underline" href="#" aria-label="Stillwave home">
          <span className="grid h-8 w-8 place-items-center bg-moss text-lime" aria-hidden="true">S</span> STILLWAVE
        </a>
        <span className="text-xs text-neutral-500">SOCIAL VIDEO STUDIO</span>
      </header>
      <main ref={mainRef} className="mx-auto max-w-[1500px] px-5 pb-12 pt-6 md:px-10 md:pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-moss">Create a video</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Your story, in motion.</h1>
          </div>
          <nav aria-label="Creation steps" className="flex items-center gap-2">
            {steps.map((label, index) => {
              const number = index + 1;
              return <button key={label} type="button" onClick={() => number < step && setStep(number)} disabled={number > step} aria-label={`Step ${number}: ${label}`} aria-current={number === step ? 'step' : undefined} className={`flex items-center gap-2 border-b-2 px-2 py-3 text-xs ${number === step ? 'border-moss font-semibold text-ink' : 'border-transparent text-neutral-400'} disabled:cursor-default`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${stepsComplete[index] ? 'bg-moss text-white' : number === step ? 'bg-lime text-ink' : 'bg-neutral-200 text-neutral-500'}`}>{stepsComplete[index] ? '✓' : `0${number}`}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>;
            })}
          </nav>
        </div>

        {step === 1 && <section className="mx-auto max-w-2xl border-t border-neutral-200 py-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold">Choose your soundtrack</h2>
            <p className="mt-2 text-sm text-neutral-500">Add one audio track. It sets the finished video's duration.</p>
          </div>
          <AudioUploader onFileSelect={handleAudioSelect} fileName={audioMeta.fileName} fileSize={audioMeta.fileSize} detectedType={audioMeta.detectedType} duration={audioDuration} />
          {audioFile && <div className="mt-5 flex items-center justify-between border-b border-neutral-200 py-4 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{audioFile.name}</p><p className="mt-1 text-xs text-neutral-500">{formatDuration(audioDuration)} · {audioMeta.fileSize}</p></div>
            <button type="button" className="text-xs font-medium text-moss underline underline-offset-4" onClick={() => document.getElementById('audio-upload')?.click()}>Replace audio</button>
          </div>}
          {statusMessage && <p className="mt-4 text-sm text-neutral-600" role="status">{statusMessage}</p>}
          <div className="mt-8 flex justify-end"><button type="button" onClick={() => setStep(2)} disabled={!canContinue} className="bg-moss px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue to visuals <span aria-hidden="true">→</span></button></div>
        </section>}

        {step === 2 && <section className="mx-auto max-w-3xl border-t border-neutral-200 py-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div><h2 className="text-xl font-semibold">Build your visual sequence</h2><p className="mt-2 text-sm text-neutral-500">Add images and video clips. Video source audio is automatically excluded.</p></div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="shrink-0 bg-moss px-4 py-3 text-sm font-semibold text-white">+ Add media</button>
          </div>
          <input ref={fileInputRef} className="sr-only" type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" onChange={(event) => void handleAddVisuals(event.target.files)} />
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleAddVisuals(event.dataTransfer.files); }} className="border border-dashed border-neutral-300 bg-white/70 p-6 text-center text-sm text-neutral-500">
            Drop image or video files here, or choose Add media above.
          </div>
          <div className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
            {clips.map((clip, index) => {
              const asset = assets.find((item) => item.id === clip.assetId);
              return <div key={clip.id} className="flex items-center gap-3 py-3">
                {asset?.kind === 'image' ? <img src={asset.url} className="h-14 w-20 object-cover" alt="" /> : <video src={asset?.url} muted className="h-14 w-20 object-cover" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{asset?.file.name}</p><p className="mt-1 text-xs text-neutral-500">{asset?.kind === 'image' ? 'Still image' : 'Video clip'} · {getClipDuration(clip).toFixed(1)} sec</p></div>
                <button type="button" title="Move clip up" aria-label="Move clip up" disabled={index === 0} onClick={() => setClips((current) => moveClip(current, index, index - 1))} className="px-2 py-2 text-neutral-600 disabled:opacity-30">↑</button>
                <button type="button" title="Move clip down" aria-label="Move clip down" disabled={index === clips.length - 1} onClick={() => setClips((current) => moveClip(current, index, index + 1))} className="px-2 py-2 text-neutral-600 disabled:opacity-30">↓</button>
                <button type="button" title="Remove clip" aria-label="Remove clip" onClick={() => removeClip(clip.id)} className="px-2 py-2 text-neutral-500">×</button>
              </div>;
            })}
            {!clips.length && <p className="py-10 text-center text-sm text-neutral-500">Your sequence is empty.</p>}
          </div>
          {statusMessage && <p role="status" className="mt-4 text-sm text-neutral-600">{statusMessage}</p>}
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(1)} className="px-1 py-3 text-sm text-neutral-600">← Back</button><button type="button" onClick={() => setStep(3)} disabled={!canContinue} className="bg-moss px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue to editor <span aria-hidden="true">→</span></button></div>
        </section>}

        {step === 3 && <section className="space-y-7 border-t border-neutral-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-xl font-semibold">Preview and edit</h2><p className="mt-1 text-sm text-neutral-500">{audioFile?.name} · {formatDuration(audioDuration)} soundtrack</p></div>
            <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="h-2 w-2 rounded-full bg-lime-500" />Autosaved in this session</div>
          </div>
          <div className="border border-neutral-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)] sm:items-end">
              <div>
                <h3 className="text-sm font-semibold">Video dimensions</h3>
                <p className="mt-1 text-xs text-neutral-500">Choose where you’ll share your video. The preview and export update to match.</p>
              </div>
              <label className="text-xs font-semibold text-neutral-600">Social media platform
                <select className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-sm font-normal text-ink" value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                  {platformPresets.map((item) => <option key={item.id} value={item.id}>{item.platform} · {item.placement} · {formatAspectRatio(item.width, item.height)} ({item.width} × {item.height})</option>)}
                </select>
              </label>
            </div>
            {presetId === 'custom' && <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-neutral-600">Width<input className="mt-2 w-full border border-neutral-200 px-3 py-3 text-sm font-normal" type="number" min="144" max="3840" step="2" value={customWidth} onChange={(event) => setCustomWidth(Math.max(144, Number(event.target.value)))} /></label>
              <label className="text-xs font-semibold text-neutral-600">Height<input className="mt-2 w-full border border-neutral-200 px-3 py-3 text-sm font-normal" type="number" min="144" max="3840" step="2" value={customHeight} onChange={(event) => setCustomHeight(Math.max(144, Number(event.target.value)))} /></label>
            </div>}
            <p className="mt-3 text-xs text-neutral-600">Selected export size: <strong className="font-semibold text-ink">{width} × {height} · {formatAspectRatio(width, height)}</strong></p>
          </div>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(390px,0.9fr)]">
            <div className="space-y-4">
              <CompositionPreview assets={assets} clips={clips} currentTime={currentTime} width={width} height={height} videoRef={previewVideoRef} />
              <div className="flex items-center gap-4 border-b border-neutral-200 pb-4">
                <button type="button" onClick={playPause} className="grid h-10 w-10 shrink-0 place-items-center bg-ink text-white" aria-label={isPlaying ? 'Pause preview' : 'Play preview'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
                <div className="min-w-0 flex-1"><input aria-label="Preview position" type="range" min="0" max={audioDuration || 1} step="0.1" value={Math.min(currentTime, audioDuration || 0)} onChange={(event) => { const time = Number(event.target.value); setCurrentTime(time); if (audioRef.current) audioRef.current.currentTime = time; }} className="w-full accent-moss" /><div className="flex justify-between text-[11px] tabular-nums text-neutral-500"><span>{formatDuration(currentTime)}</span><span>{formatDuration(audioDuration)}</span></div></div>
              </div>
              <TimelineEditor assets={assets} clips={clips} selectedClipId={selectedClipId} onSelect={setSelectedClipId} onChange={updateClip} onTransform={updateTransform} onMove={(from, to) => setClips((current) => moveClip(current, from, to))} onRemove={removeClip} onSplit={handleSplit} />
            </div>
            <aside className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-neutral-600">File format<select className="mt-2 w-full border border-neutral-200 bg-white px-3 py-3 text-sm font-normal text-ink" value={format} onChange={(event) => setFormat(event.target.value)}><option>MP4</option><option>WebM</option></select></label>
                <label className="text-xs font-semibold text-neutral-600">Frame rate<select className="mt-2 w-full border border-neutral-200 bg-white px-3 py-3 text-sm font-normal text-ink" value={frameRate} onChange={(event) => setFrameRate(Number(event.target.value))}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
              </div>
              <div className="border-t border-neutral-200 pt-4"><div className="flex justify-between text-xs text-neutral-500"><span>Export dimensions</span><span className="font-medium text-ink">{width} × {height} · {formatAspectRatio(width, height)}</span></div><div className="mt-2 flex justify-between text-xs text-neutral-500"><span>Sequence</span><span className="font-medium text-ink">{formatDuration(Math.min(audioDuration, timelineDuration))} of {formatDuration(audioDuration)}</span></div><p className="mt-3 text-[11px] leading-relaxed text-neutral-500">Platform presets set the exported video dimensions. Check current platform requirements before publishing.</p></div>
            </aside>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-5">
            <button type="button" onClick={() => setStep(2)} className="px-1 py-3 text-sm text-neutral-600">← Back to visuals</button>
            <div className="flex items-center gap-4">
              {statusMessage && !isExporting && <p role="status" className="max-w-sm text-right text-xs text-neutral-600">{statusMessage}</p>}
              {exportComplete ? (
                <button type="button" onClick={startNewVideo} className="bg-moss px-6 py-3 text-sm font-semibold text-white">Start a new video <span aria-hidden="true">→</span></button>
              ) : (
                <button ref={exportButtonRef} type="button" onClick={() => void handleExport()} disabled={!audioFile || !clips.length} className="bg-moss px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Create video <span aria-hidden="true">→</span></button>
              )}
            </div>
          </div>
        </section>}
        <audio className="sr-only" ref={audioRef} src={audioUrl ?? undefined} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => setIsPlaying(false)} />
      </main>
      {isExporting && <ExportProgress progress={exportProgress} isExporting statusMessage={statusMessage} />}
    </div>
  );
}

export default App;
