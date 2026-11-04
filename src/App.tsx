import { useEffect, useRef, useState } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { CompositionPreview } from './components/CompositionPreview';
import { ExportProgress } from './components/ExportProgress';
import { TimelineEditor } from './components/TimelineEditor';
import { TitleOverlayEditor } from './components/TitleOverlayEditor';
import {
  buildOutputFileName,
  formatDuration,
  formatFileSize,
  getSupportedFormatsLabel,
  validateMediaImport,
  visualExtensions,
} from './services/media';
import { projectStorage, type ProjectSummary, type StoredProject } from './services/projectStorage';
import type { ProjectDocument } from './services/project';
import { MediaUrlRegistry } from './services/mediaUrlRegistry';
import { waitForVideoMetadata } from './services/videoMetadata';
import { waitForAudioMetadata } from './services/audioMetadata';
import { createHistory, type History } from './services/history';
import { getSupportedMimeType, renderVideo } from './services/videoExport';
import { createDefaultTitle, type TitleOverlay } from './services/titleOverlay';
import {
  clampTimelineTime,
  defaultTransform,
  getClipDuration,
  getTimelineDuration,
  defaultVideoTrack,
  duplicateTimelineClip,
  platformPresets,
  snapTimelinePosition,
  splitClipAtTimelineTime,
  createTimelineMarker,
  type TimelineTrack,
  type TimelineAsset,
  type TimelineClip,
  type TimelineMarker,
  type VisualTransform,
} from './services/timeline';

const steps = ['Audio', 'Visuals', 'Edit & export'];
const HISTORY_LIMIT = 50;

type EditSnapshot = {
  audioFile: File | null;
  audioDuration: number;
  assets: Array<Pick<TimelineAsset, 'id' | 'file' | 'kind' | 'duration'>>;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  markers: TimelineMarker[];
  outputSettings: {
    presetId: string;
    customWidth: number;
    customHeight: number;
    frameRate: number;
    format: string;
  };
};

type MediaLibraryItem = {
  id: string;
  file: File;
  kind: 'audio' | 'image' | 'video';
  duration: number;
};

const visualAccept = visualExtensions.map((extension) => `.${extension}`).join(',');

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getMediaTypeLabel(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop();
  return extension && extension !== file.name
    ? `.${extension.toUpperCase()} (MIME unavailable)`
    : 'Unknown type';
}

function App() {
  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState<string>(() => newId());
  const [projectName, setProjectName] = useState('Untitled project');
  const [projectCreatedAt, setProjectCreatedAt] = useState(() => new Date().toISOString());
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [projectToOpen, setProjectToOpen] = useState('');
  const [projectStorageStatus, setProjectStorageStatus] = useState('Checking local project storage…');
  const [isProjectStorageReady, setIsProjectStorageReady] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [assets, setAssets] = useState<TimelineAsset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([defaultVideoTrack()]);
  const [titles, setTitles] = useState<TitleOverlay[]>([]);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [previewSeekRevision, setPreviewSeekRevision] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presetId, setPresetId] = useState('youtube');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [frameRate, setFrameRate] = useState(30);
  const [format, setFormat] = useState('MP4');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [isImportingVisuals, setIsImportingVisuals] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasExportingRef = useRef(false);
  const visualImportRef = useRef(false);
  const urlsRef = useRef(new MediaUrlRegistry());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startupRef = useRef(false);
  const historyRef = useRef<History<EditSnapshot> | null>(null);
  const projectListRef = useRef(projectList);
  projectListRef.current = projectList;

  const makeEditSnapshot = (overrides: Partial<EditSnapshot> = {}): EditSnapshot => ({
    audioFile,
    audioDuration,
    assets: assets.map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
    tracks,
    clips,
    titles,
    markers,
    outputSettings: { presetId, customWidth, customHeight, frameRate, format },
    ...overrides,
  });

  if (!historyRef.current) {
    historyRef.current = createHistory(makeEditSnapshot(), { limit: HISTORY_LIMIT });
  }

  const syncHistoryButtons = () => {
    setCanUndo(historyRef.current?.canUndo() ?? false);
    setCanRedo(historyRef.current?.canRedo() ?? false);
  };

  const recordEdit = (snapshot: EditSnapshot) => {
    historyRef.current?.push(snapshot);
    syncHistoryButtons();
  };

  const resetEditHistory = (snapshot: EditSnapshot) => {
    historyRef.current?.clear(snapshot);
    syncHistoryButtons();
  };

  const applyEditSnapshot = (snapshot: EditSnapshot) => {
    const newUrls: string[] = [];
    const restoredAssets: TimelineAsset[] = snapshot.assets.map((asset) => {
      const url = urlsRef.current.create(asset.file);
      newUrls.push(url);
      return { ...asset, url };
    });
    const restoredAudioUrl = snapshot.audioFile ? urlsRef.current.create(snapshot.audioFile) : null;
    if (restoredAudioUrl) newUrls.push(restoredAudioUrl);

    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    urlsRef.current.replace(newUrls);

    setAudioFile(snapshot.audioFile);
    setAudioUrl(restoredAudioUrl);
    setAudioDuration(snapshot.audioDuration);
    setAssets(restoredAssets);
    setTracks(snapshot.tracks);
    setClips(snapshot.clips);
    setSelectedTitleId((current) => snapshot.titles.some((title) => title.id === current)
      ? current
      : (snapshot.titles[0]?.id ?? ''));
    setTitles(snapshot.titles);
    setMarkers(snapshot.markers);
    setSelectedClipId((current) => snapshot.clips.some((clip) => clip.id === current)
      ? current
      : (snapshot.clips[0]?.id ?? ''));
    setPresetId(snapshot.outputSettings.presetId);
    setCustomWidth(snapshot.outputSettings.customWidth);
    setCustomHeight(snapshot.outputSettings.customHeight);
    setFrameRate(snapshot.outputSettings.frameRate);
    setFormat(snapshot.outputSettings.format);
  };

  const undoEdit = () => {
    if (!historyRef.current?.canUndo()) return;
    applyEditSnapshot(historyRef.current.undo());
    syncHistoryButtons();
  };

  const redoEdit = () => {
    if (!historyRef.current?.canRedo()) return;
    applyEditSnapshot(historyRef.current.redo());
    syncHistoryButtons();
  };

  const preset = platformPresets.find((item) => item.id === presetId) ?? platformPresets[0];
  const width = presetId === 'custom' ? customWidth : preset.width;
  const height = presetId === 'custom' ? customHeight : preset.height;
  const timelineDuration = getTimelineDuration(clips);
  const audioMeta = {
    fileName: audioFile?.name ?? 'No audio selected',
    fileSize: audioFile ? formatFileSize(audioFile.size) : '0 KB',
    detectedType: audioFile?.type || 'audio',
  };
  const libraryItems: MediaLibraryItem[] = [
    ...(audioFile ? [{ id: 'current-audio', file: audioFile, kind: 'audio' as const, duration: audioDuration }] : []),
    ...assets.map((asset) => ({ id: asset.id, file: asset.file, kind: asset.kind, duration: asset.duration })),
  ];
  const normalizedAssetSearch = assetSearch.trim().toLocaleLowerCase();
  const filteredLibraryItems = libraryItems.filter(({ file, kind }) => (
    !normalizedAssetSearch
    || file.name.toLocaleLowerCase().includes(normalizedAssetSearch)
    || kind.includes(normalizedAssetSearch)
    || (file.type || '').toLocaleLowerCase().includes(normalizedAssetSearch)
  ));

  useEffect(() => () => urlsRef.current.clear(), []);
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
  const revokeUrl = (url: string) => {
    urlsRef.current.revoke(url);
  };

  const makeProjectDocument = (
    id = projectId,
    name = projectName,
    createdAt = projectCreatedAt,
  ): ProjectDocument => ({
    id,
    name: name.trim() || 'Untitled project',
    createdAt,
    updatedAt: new Date().toISOString(),
    schemaVersion: 4,
    audio: audioFile ? {
      id: `${id}-audio`,
      fileName: audioFile.name,
      mimeType: audioFile.type,
      size: audioFile.size,
      duration: audioDuration,
    } : null,
    assets: assets.map((asset) => ({
      id: asset.id,
      fileName: asset.file.name,
      mimeType: asset.file.type,
      size: asset.file.size,
      kind: asset.kind,
      duration: asset.duration,
    })),
    tracks,
    clips,
    titleOverlays: titles,
    markers,
    outputSettings: {
      presetId,
      customWidth,
      customHeight,
      frameRate,
      format: format === 'WebM' ? 'WebM' : 'MP4',
    },
  });

  const makeProjectMedia = () => ({
    audio: audioFile,
    assets: Object.fromEntries(assets.map((asset) => [asset.id, asset.file])),
  });

  const refreshProjectList = async (preferredProjectId?: string) => {
    const projects = await projectStorage.listProjects();
    setProjectList(projects);
    setProjectToOpen((current) => {
      const selectedId = preferredProjectId ?? current;
      return selectedId && projects.some((project) => project.id === selectedId)
        ? selectedId
        : (projects[0]?.id ?? '');
    });
  };

  const applyStoredProject = async (stored: StoredProject) => {
    const createdUrls: string[] = [];
    try {
      const restoredAssets = await Promise.all(stored.document.assets.map(async (asset): Promise<TimelineAsset> => {
        const blob = stored.media.assets[asset.id];
        const file = new File([blob], asset.fileName, { type: asset.mimeType });
        const url = urlsRef.current.create(file);
        createdUrls.push(url);
        if (asset.kind === 'image') {
          const image = new Image();
          image.src = url;
          try {
            await image.decode();
          } catch {
            throw new Error(`Could not read "${asset.fileName}". Re-import the original media file.`);
          }
        } else {
          const video = document.createElement('video');
          video.preload = 'metadata';
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => Number.isFinite(video.duration) && video.duration > 0
              ? resolve()
              : reject(new Error(`Could not read "${asset.fileName}". Re-import the original media file.`));
            video.onerror = () => reject(new Error(`Could not read "${asset.fileName}". Re-import the original media file.`));
            video.src = url;
          });
        }
        return { id: asset.id, file, url, kind: asset.kind, duration: asset.duration };
      }));

      const audioFileToRestore = stored.document.audio && stored.media.audio
        ? new File([stored.media.audio], stored.document.audio.fileName, { type: stored.document.audio.mimeType })
        : null;
      const restoredAudioUrl = audioFileToRestore ? urlsRef.current.create(audioFileToRestore) : null;
      if (restoredAudioUrl) createdUrls.push(restoredAudioUrl);

      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      urlsRef.current.replace(createdUrls);

      const documentValue = stored.document;
      setProjectId(documentValue.id);
      setProjectName(documentValue.name);
      setProjectCreatedAt(documentValue.createdAt);
      setAudioFile(audioFileToRestore);
      setAudioUrl(restoredAudioUrl);
      setAudioDuration(documentValue.audio?.duration ?? 0);
      setAssets(restoredAssets);
      setTracks(documentValue.tracks);
      setClips(documentValue.clips);
      setTitles(documentValue.titleOverlays);
      setMarkers(documentValue.markers);
      setSelectedClipId(documentValue.clips[0]?.id ?? '');
      setSelectedTitleId(documentValue.titleOverlays[0]?.id ?? '');
      setStep(documentValue.audio ? (documentValue.clips.length ? 3 : 2) : 1);
      setCurrentTime(0);
      setIsPlaying(false);
      setPresetId(documentValue.outputSettings.presetId);
      setCustomWidth(documentValue.outputSettings.customWidth);
      setCustomHeight(documentValue.outputSettings.customHeight);
      setFrameRate(documentValue.outputSettings.frameRate);
      setFormat(documentValue.outputSettings.format);
      setExportComplete(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      resetEditHistory({
        audioFile: audioFileToRestore,
        audioDuration: documentValue.audio?.duration ?? 0,
        assets: restoredAssets.map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
        tracks: documentValue.tracks,
        clips: documentValue.clips,
        titles: documentValue.titleOverlays,
        markers: documentValue.markers,
        outputSettings: { ...documentValue.outputSettings },
      });
    } catch (error) {
      createdUrls.forEach((url) => urlsRef.current.revoke(url));
      throw error;
    }
  };

  const saveCurrentProject = async (
    id = projectId,
    name = projectName,
    createdAt = projectCreatedAt,
  ) => {
    await projectStorage.saveProject(makeProjectDocument(id, name, createdAt), makeProjectMedia());
    await refreshProjectList();
  };

  useEffect(() => {
    if (startupRef.current) return;
    startupRef.current = true;
    void (async () => {
      try {
        const projects = await projectStorage.listProjects();
        const recoverable = projects.find((project) => !project.problem);
        setProjectList(projects);
        setProjectToOpen(recoverable?.id ?? projects[0]?.id ?? '');
        setIsProjectStorageReady(true);
        if (recoverable) {
          const stored = await projectStorage.loadProject(recoverable.id);
          await applyStoredProject(stored);
          setProjectStorageStatus(projects.some((project) => project.problem)
            ? `Recovered “${stored.document.name}”. Another saved project needs attention; select it to inspect or delete.`
            : `Recovered “${stored.document.name}” from this browser.`);
        } else if (projects.length) {
          setProjectStorageStatus('Saved project records need attention. Select a record to open for details or delete it; your current project remains open.');
        } else {
          setProjectStorageStatus('Local project storage is ready. Edits will autosave in this browser.');
        }
      } catch (error) {
        setIsProjectStorageReady(true);
        setProjectStorageStatus(error instanceof Error ? error.message : 'Local project recovery failed. Your current project is still open.');
      }
    })();
  }, []);

  useEffect(() => {
    const hasProjectContent = Boolean(audioFile || assets.length || clips.length || titles.length || markers.length);
    const isExistingSavedProject = projectListRef.current.some((project) => project.id === projectId);
    if (!isProjectStorageReady || (!hasProjectContent && !isExistingSavedProject)) return;
    const snapshot = makeProjectDocument();
    const media = makeProjectMedia();
    setProjectStorageStatus('Saving project locally…');
    const timer = window.setTimeout(() => {
      void projectStorage.saveProject(snapshot, media)
        .then(() => refreshProjectList())
        .then(() => setProjectStorageStatus(`Saved “${snapshot.name}” in this browser.`))
        .catch((error: unknown) => setProjectStorageStatus(
          error instanceof Error ? error.message : 'Could not autosave. Your current edits are still open; use Save to retry.',
        ));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    isProjectStorageReady, projectId, projectName, projectCreatedAt, audioFile, audioDuration,
    assets, tracks, clips, titles, markers, presetId, customWidth, customHeight, frameRate, format,
  ]);

  const readAudioDuration = async (file: File) => {
    const url = urlsRef.current.create(file);
    try {
      const audio = new Audio();
      audio.preload = 'metadata';
      return await waitForAudioMetadata(audio, url);
    } finally {
      revokeUrl(url);
    }
  };

  const handleAudioSelect = async (file: File) => {
    const validation = validateMediaImport(file, 'audio');
    if (!validation.valid) {
      setStatusMessage(validation.message);
      return;
    }
    let duration: number;
    try {
      duration = await readAudioDuration(file);
    } catch (error) {
      const reason = error instanceof Error ? ` ${error.message}` : '';
      setStatusMessage(`Could not read the duration of "${file.name}".${reason} Your existing soundtrack was kept.`);
      return;
    }
    if (duration <= 0) {
      setStatusMessage(`Could not read the duration of "${file.name}". This browser may not be able to decode this file. Your existing soundtrack was kept.`);
      return;
    }
    if (audioUrl) {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      revokeUrl(audioUrl);
    }
    const url = urlsRef.current.create(file);
    setAudioFile(file);
    setAudioUrl(url);
    setAudioDuration(duration);
    recordEdit(makeEditSnapshot({ audioFile: file, audioDuration: duration }));
    setCurrentTime(0);
    setStatusMessage(`Loaded ${file.name}`);
  };

  const removeAudio = () => {
    if (!audioFile) return;
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    if (audioUrl) revokeUrl(audioUrl);
    setAudioFile(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    recordEdit(makeEditSnapshot({ audioFile: null, audioDuration: 0 }));
    setStatusMessage('Soundtrack removed from this project. The original source file on your device was not deleted.');
  };

  const handleAddVisuals = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length || visualImportRef.current) return;
    if (!tracks.some((track) => !track.locked)) {
      setStatusMessage('Unlock a video track before adding visual clips.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    visualImportRef.current = true;
    setIsImportingVisuals(true);
    const rejected: string[] = [];
    try {
      const eligibleFiles = files.filter((file) => {
        const validation = validateMediaImport(file, 'visual');
        if (!validation.valid) rejected.push(validation.message);
        return validation.valid;
      });
      const newAssets = await Promise.all(eligibleFiles.map(async (file): Promise<TimelineAsset | null> => {
        const validation = validateMediaImport(file, 'visual');
        if (!validation.valid || !validation.visualKind) return null;
        const kind = validation.visualKind;
        const url = urlsRef.current.create(file);
        try {
          const duration = kind === 'image' ? 5 : await (() => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            return waitForVideoMetadata(video, url);
          })();
          if (kind === 'image') {
            const image = new Image();
            image.src = url;
            await image.decode();
          }
          return { id: newId(), file, url, kind, duration };
        } catch (error) {
          revokeUrl(url);
          if (kind === 'image') {
            rejected.push(`Could not decode "${file.name}" in this browser.`);
          } else {
            const reason = error instanceof Error ? error.message : 'The browser could not read its metadata.';
            rejected.push(`Could not import "${file.name}": ${reason} Check the file and try re-encoding it.`);
          }
          return null;
        }
      }));
      const validAssets = newAssets.filter((asset): asset is TimelineAsset => Boolean(asset));
      let appendAt = getTimelineDuration(clips);
      const appendTrackId = tracks.find((track) => !track.locked)!.id;
      const newClips = validAssets.map((asset): TimelineClip => {
        const clip: TimelineClip = {
          id: newId(),
          assetId: asset.id,
          trackId: appendTrackId,
          timelinePosition: appendAt,
          start: 0,
          end: asset.kind === 'video' ? asset.duration : 0,
          stillDuration: 5,
          transition: 'none',
          transform: { ...defaultTransform },
        };
        appendAt += getClipDuration(clip);
        return clip;
      });
      setAssets((current) => [...current, ...validAssets]);
      setClips((current) => [...current, ...newClips]);
      if (newClips.length) {
        recordEdit(makeEditSnapshot({
          assets: [...assets, ...validAssets].map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
          tracks,
          clips: [...clips, ...newClips],
        }));
      }
      if (newClips.length) setSelectedClipId(newClips[0].id);
      const rejectionSummary = rejected.length
        ? ` ${rejected.slice(0, 3).join(' ')}${rejected.length > 3 ? ` ${rejected.length - 3} more file(s) were rejected.` : ''}`
        : '';
      setStatusMessage(validAssets.length
        ? `Added ${validAssets.length} visual clip${validAssets.length === 1 ? '' : 's'}.${rejectionSummary}`
        : `No visual files were added.${rejectionSummary || ' Choose a supported, decodable image or video file.'}`);
    } catch (error) {
      setStatusMessage(error instanceof Error
        ? `Could not import visual media: ${error.message}`
        : 'Could not import visual media. Try another supported file.');
    } finally {
      visualImportRef.current = false;
      setIsImportingVisuals(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateClip = (id: string, patch: Partial<TimelineClip>) => {
    const target = clips.find((clip) => clip.id === id);
    if (!target || tracks.find((track) => track.id === target.trackId)?.locked) return;
    const nextClips = clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip);
    if (nextClips.every((clip, index) => clip === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips }));
  };
  const updateTransform = (id: string, patch: Partial<VisualTransform>) => {
    const target = clips.find((clip) => clip.id === id);
    if (!target || tracks.find((track) => track.id === target.trackId)?.locked) return;
    const nextClips = clips.map((clip) => clip.id === id
      ? { ...clip, transform: { ...clip.transform, ...patch } }
      : clip);
    if (nextClips.every((clip, index) => clip === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips }));
  };
  const removeClip = (id: string) => {
    const nextClips = clips.filter((clip) => clip.id !== id);
    if (nextClips.length === clips.length) return;
    const removed = assets.find((asset) => asset.id === clips.find((clip) => clip.id === id)?.assetId);
    const nextAssets = removed && !nextClips.some((clip) => clip.assetId === removed.id)
      ? assets.filter((asset) => asset.id !== removed.id)
      : assets;
    setClips(nextClips);
    if (removed && nextAssets !== assets) {
      setAssets(nextAssets);
      revokeUrl(removed.url);
    }
    recordEdit(makeEditSnapshot({
      assets: nextAssets.map(({ id: assetId, file, kind, duration }) => ({ id: assetId, file, kind, duration })),
      tracks,
      clips: nextClips,
    }));
    setSelectedClipId(nextClips[0]?.id ?? '');
    setStatusMessage('Clip removed from this project. The original source file on your device was not deleted.');
  };

  const removeVisualAsset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    const nextAssets = assets.filter((item) => item.id !== assetId);
    const nextClips = clips.filter((clip) => clip.assetId !== assetId);
    setAssets(nextAssets);
    setClips(nextClips);
    if (selectedClipId && !nextClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(nextClips[0]?.id ?? '');
    }
    revokeUrl(asset.url);
    recordEdit(makeEditSnapshot({
      assets: nextAssets.map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
      tracks,
      clips: nextClips,
    }));
    setStatusMessage(`Removed "${asset.file.name}" and its clips from this project. The original source file on your device was not deleted.`);
  };

  const handleSplit = (id: string) => {
    const clip = clips.find((item) => item.id === id);
    if (!clip || tracks.find((track) => track.id === clip.trackId)?.locked) return;
    const next = splitClipAtTimelineTime(clips, id, currentTime);
    setClips(next);
    if (next.length > clips.length) recordEdit(makeEditSnapshot({ clips: next, tracks }));
    if (next.length > clips.length) setSelectedClipId(next[next.findIndex((item) => item.id === id) + 1].id);
  };

  const moveClipToTrack = (id: string, trackId: string, timelinePosition: number) => {
    const clip = clips.find((item) => item.id === id);
    const targetTrack = tracks.find((track) => track.id === trackId);
    if (!clip || !targetTrack || targetTrack.locked || tracks.find((track) => track.id === clip.trackId)?.locked) return;
    const position = snapTimelinePosition(timelinePosition, false);
    const nextClips = clips.map((item) => item.id === id ? { ...item, trackId, timelinePosition: position } : item);
    if (nextClips.every((item, index) => item === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips, tracks }));
  };

  const duplicateClip = (id: string) => {
    const source = clips.find((clip) => clip.id === id);
    if (!source || tracks.find((track) => track.id === source.trackId)?.locked) return;
    const nextClips = duplicateTimelineClip(clips, id);
    if (nextClips.length === clips.length) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips, tracks }));
    setSelectedClipId(nextClips[clips.indexOf(source) + 1]?.id ?? id);
  };

  const addTrack = () => {
    const order = Math.max(-1, ...tracks.map((track) => track.order)) + 1;
    const track: TimelineTrack = { id: newId(), name: `Video ${tracks.length + 1}`, order, visible: true, locked: false };
    const nextTracks = [...tracks, track];
    setTracks(nextTracks);
    recordEdit(makeEditSnapshot({ tracks: nextTracks, clips }));
  };
  const updateTrack = (id: string, patch: Partial<Pick<TimelineTrack, 'name' | 'visible' | 'locked'>>) => {
    const nextTracks = tracks.map((track) => track.id === id ? { ...track, ...patch } : track);
    if (nextTracks.every((track, index) => track === tracks[index])) return;
    setTracks(nextTracks);
    recordEdit(makeEditSnapshot({ tracks: nextTracks, clips }));
  };

  const updateOutputSettings = (patch: Partial<EditSnapshot['outputSettings']>) => {
    const outputSettings = {
      presetId,
      customWidth,
      customHeight,
      frameRate,
      format,
      ...patch,
    };

    if (
      outputSettings.presetId === presetId
      && outputSettings.customWidth === customWidth
      && outputSettings.customHeight === customHeight
      && outputSettings.frameRate === frameRate
      && outputSettings.format === format
    ) return;
    setPresetId(outputSettings.presetId);
    setCustomWidth(outputSettings.customWidth);
    setCustomHeight(outputSettings.customHeight);
    setFrameRate(outputSettings.frameRate);
    setFormat(outputSettings.format);
    recordEdit(makeEditSnapshot({ outputSettings }));
  };

  const addTitle = () => {
    const title = createDefaultTitle(newId(), currentTime);
    const nextTitles = [...titles, title];
    setTitles(nextTitles);
    setSelectedTitleId(title.id);
    recordEdit(makeEditSnapshot({ titles: nextTitles }));
  };

  const updateTitle = (id: string, patch: Partial<TitleOverlay>) => {
    const nextTitles = titles.map((title) => {
      if (title.id !== id) return title;
      const updated = { ...title, ...patch };
      updated.start = Math.max(0, Math.min(86_400 - updated.duration, updated.start));
      updated.duration = Math.max(0.1, Math.min(86_400 - updated.start, updated.duration));
      updated.x = Math.max(0, Math.min(100, updated.x));
      updated.y = Math.max(0, Math.min(100, updated.y));
      updated.fontSize = Math.max(2, Math.min(20, updated.fontSize));
      return updated;
    });
    if (nextTitles.every((title, index) => title === titles[index])) return;
    setTitles(nextTitles);
    recordEdit(makeEditSnapshot({ titles: nextTitles }));
  };

  const removeTitle = (id: string) => {
    const nextTitles = titles.filter((title) => title.id !== id);
    if (nextTitles.length === titles.length) return;
    setTitles(nextTitles);
    if (selectedTitleId === id) setSelectedTitleId(nextTitles[0]?.id ?? '');
    recordEdit(makeEditSnapshot({ titles: nextTitles }));
  };

  const addMarker = () => {
    const marker = createTimelineMarker(markers, currentTime, newId);
    const nextMarkers = [...markers, marker];
    setMarkers(nextMarkers);
    recordEdit(makeEditSnapshot({ markers: nextMarkers }));
  };

  const renameMarker = (id: string, label: string) => {
    const nextMarkers = markers.map((marker) => marker.id === id ? { ...marker, label } : marker);
    if (nextMarkers.every((marker, index) => marker === markers[index])) return;
    setMarkers(nextMarkers);
    recordEdit(makeEditSnapshot({ markers: nextMarkers }));
  };

  const removeMarker = (id: string) => {
    const nextMarkers = markers.filter((marker) => marker.id !== id);
    if (nextMarkers.length === markers.length) return;
    setMarkers(nextMarkers);
    recordEdit(makeEditSnapshot({ markers: nextMarkers }));
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (isExporting || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.matches('input, textarea, select') || target.isContentEditable)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      if (isUndo && historyRef.current?.canUndo()) {
        event.preventDefault();
        undoEdit();
      } else if (isRedo && historyRef.current?.canRedo()) {
        event.preventDefault();
        redoEdit();
      }
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [isExporting]);

  const resetProjectState = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    urlsRef.current.clear();
    setProjectId(newId());
    setProjectName('Untitled project');
    setProjectCreatedAt(new Date().toISOString());
    setStep(1);
    setAudioFile(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setAssets([]);
    setTracks([defaultVideoTrack()]);
    setClips([]);
    setTitles([]);
    setMarkers([]);
    setSelectedClipId('');
    setSelectedTitleId('');
    setCurrentTime(0);
    setIsPlaying(false);
    setPresetId('youtube');
    setCustomWidth(1920);
    setCustomHeight(1080);
    setFrameRate(30);
    setFormat('MP4');
    resetEditHistory({
      audioFile: null,
      audioDuration: 0,
      assets: [],
      tracks: [defaultVideoTrack()],
      clips: [],
      titles: [],
      markers: [],
      outputSettings: { presetId: 'youtube', customWidth: 1920, customHeight: 1080, frameRate: 30, format: 'MP4' },
    });
    setStatusMessage('');
    setExportProgress(0);
    setExportComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startNewVideo = async () => {
    try {
      if (audioFile || assets.length || clips.length) await saveCurrentProject();
      resetProjectState();
      setProjectStorageStatus('New project. It will autosave here after you add media.');
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not save this project. Your current edits are still open.');
    }
  };

  const handleSaveProject = async () => {
    try {
      await saveCurrentProject();
      setProjectStorageStatus(`Saved “${projectName.trim() || 'Untitled project'}” in this browser.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not save. Your current edits are still open; retry when storage is available.');
    }
  };

  const handleSaveAs = async () => {
    const name = projectName.trim();
    if (!name) {
      setProjectStorageStatus('Enter a project name before using Save as.');
      return;
    }
    const id = newId();
    const createdAt = new Date().toISOString();
    try {
      await projectStorage.saveProject(makeProjectDocument(id, name, createdAt), makeProjectMedia());
      setProjectId(id);
      setProjectName(name);
      setProjectCreatedAt(createdAt);
      resetEditHistory(makeEditSnapshot());
      await refreshProjectList(id);
      setProjectStorageStatus(`Saved a separate copy named “${name}”.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not save a copy. Your current edits are still open.');
    }
  };

  const handleOpenProject = async () => {
    if (!projectToOpen) return;
    try {
      if (audioFile || assets.length || clips.length) await saveCurrentProject();
      const stored = await projectStorage.loadProject(projectToOpen);
      await applyStoredProject(stored);
      setProjectStorageStatus(`Opened “${stored.document.name}”.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not open this project. Your current edits are still open.');
    }
  };

  const handleDeleteProject = async () => {
    const target = projectList.find((project) => project.id === projectToOpen);
    if (!target) return;
    if (!window.confirm(`Delete the saved project “${target.name}” and its browser-stored media? Original files on your device will not be deleted.`)) return;
    try {
      await projectStorage.deleteProject(target.id);
      if (target.id === projectId) resetProjectState();
      await refreshProjectList();
      setProjectStorageStatus(`Deleted saved project “${target.name}”. Source files on your device were not deleted.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not delete the saved project. Your current edits are still open.');
    }
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
        tracks,
        clips,
        titles,
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
      link.download = buildOutputFileName(audioFile.name, format.toLowerCase());
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

  const mediaLibrary = (
    <section aria-labelledby="asset-library-heading" className="border border-neutral-200 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="asset-library-heading" className="text-sm font-semibold">Media library</h3>
          <p className="mt-1 text-xs text-neutral-500">Project references only; removing media here does not delete original files.</p>
        </div>
        <span className="text-xs text-neutral-500">{libraryItems.length} item{libraryItems.length === 1 ? '' : 's'}</span>
      </div>
      <label htmlFor="asset-library-search" className="mt-3 block text-xs font-medium text-neutral-600">
        Search media
        <input
          id="asset-library-search"
          type="search"
          value={assetSearch}
          onChange={(event) => setAssetSearch(event.target.value)}
          placeholder="Search name or type"
          className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm text-ink"
        />
      </label>
      <p className="mt-1 text-[11px] text-neutral-500">Search filters this list only.</p>
      {isImportingVisuals && <p role="status" className="mt-3 text-xs text-neutral-600">Importing visual media…</p>}
      {!libraryItems.length ? (
        <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-500">No media in this project yet.</p>
      ) : !filteredLibraryItems.length ? (
        <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-500">No media matches “{assetSearch}”.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 border-t border-neutral-200">
          {filteredLibraryItems.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-3 py-3">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center bg-lime/40 text-sm font-semibold text-moss">
                {item.kind === 'audio' ? '♫' : item.kind === 'video' ? '▶' : '▧'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name || 'Unnamed media file'}</p>
                <p className="mt-1 break-all text-[11px] text-neutral-500">
                  {item.kind === 'audio' ? 'Soundtrack' : item.kind === 'image' ? 'Image' : 'Video'}
                  {' · '}{getMediaTypeLabel(item.file)}{' · '}{formatFileSize(item.file.size)}
                  {item.kind === 'image'
                    ? ' · source duration N/A (still image)'
                    : item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => item.kind === 'audio' ? removeAudio() : removeVisualAsset(item.id)}
                disabled={isExporting || isImportingVisuals}
                aria-label={`Remove ${item.kind === 'audio' ? 'soundtrack' : 'visual asset'} ${item.file.name} from project`}
                className="shrink-0 border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-red-300 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-neutral-200 px-5 py-4 md:px-10">
        <a className="flex items-center gap-3 text-sm font-bold tracking-wide text-ink no-underline" href="#" aria-label="Stillwave home">
          <span className="grid h-8 w-8 place-items-center bg-moss text-lime" aria-hidden="true">S</span> STILLWAVE
        </a>
        <span className="text-xs text-neutral-500">SOCIAL VIDEO STUDIO</span>
      </header>
      <section aria-label="Project management" className="mx-auto grid max-w-[1500px] gap-3 border-b border-neutral-200 bg-white/60 px-5 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end md:px-10">
        <label className="block text-xs font-medium text-neutral-600">
          Project name
          <input
            className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm text-ink"
            aria-label="Project name"
            maxLength={100}
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            disabled={isExporting || isImportingVisuals}
          />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Saved projects
          <select
            className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm text-ink"
            aria-label="Saved projects"
            value={projectToOpen}
            onChange={(event) => setProjectToOpen(event.target.value)}
            disabled={!projectList.length || isExporting || isImportingVisuals}
          >
            {!projectList.length && <option value="">No saved projects yet</option>}
            {projectList.map((project) => <option key={project.id} value={project.id}>{project.name}{project.problem ? ' · needs attention' : ''}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSaveProject()} disabled={isExporting || isImportingVisuals || !isProjectStorageReady} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40">Save</button>
          <button type="button" onClick={() => void handleSaveAs()} disabled={isExporting || isImportingVisuals || !isProjectStorageReady} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40">Save as</button>
          <button type="button" onClick={() => void startNewVideo()} disabled={isExporting || isImportingVisuals || !isProjectStorageReady} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40">New</button>
          <button type="button" onClick={() => void handleOpenProject()} disabled={!projectToOpen || isExporting || isImportingVisuals} className="bg-moss px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Open</button>
          <button type="button" onClick={() => void handleDeleteProject()} disabled={!projectToOpen || isExporting || isImportingVisuals} className="border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-40">Delete</button>
          <button type="button" onClick={undoEdit} disabled={!canUndo || isExporting || isImportingVisuals} aria-label="Undo last edit" aria-keyshortcuts="Control+Z Meta+Z" className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
          <button type="button" onClick={redoEdit} disabled={!canRedo || isExporting || isImportingVisuals} aria-label="Redo last edit" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">Redo</button>
        </div>
        <div className="md:col-span-3">
          <p role="status" aria-live="polite" className="text-xs text-neutral-600">{projectStorageStatus}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Projects and source media stay in this browser only. Browser storage can be limited or evicted; there is no cloud sync. Keep your original files backed up.</p>
          <p className="mt-1 text-[11px] text-neutral-500">Undo: Ctrl/⌘+Z · Redo: Ctrl/⌘+Shift+Z or Ctrl/⌘+Y. Editing shortcuts are inactive in text fields.</p>
        </div>
      </section>
      <main ref={mainRef} className="mx-auto max-w-[1500px] px-5 pb-12 pt-6 md:px-10 md:pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-moss">Create a video</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Your story, in motion.</h1>
          </div>
          <nav aria-label="Creation steps" className="flex items-center gap-2">
            {steps.map((label, index) => {
              const number = index + 1;
              return <button key={label} type="button" onClick={() => number < step && setStep(number)} disabled={number > step || isImportingVisuals} aria-label={`Step ${number}: ${label}`} aria-current={number === step ? 'step' : undefined} className={`flex items-center gap-2 border-b-2 px-2 py-3 text-xs ${number === step ? 'border-moss font-semibold text-ink' : 'border-transparent text-neutral-400'} disabled:cursor-default`}>
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
          <p className="mt-2 text-xs text-neutral-500">A listed filename extension does not guarantee that this browser can decode the file.</p>
          {audioFile && <div className="mt-5 flex items-center justify-between border-b border-neutral-200 py-4 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{audioFile.name}</p><p className="mt-1 text-xs text-neutral-500">{formatDuration(audioDuration)} · {audioMeta.fileSize}</p></div>
            <button type="button" className="text-xs font-medium text-moss underline underline-offset-4" onClick={() => document.getElementById('audio-upload')?.click()}>Replace audio</button>
          </div>}
          {statusMessage && <p className="mt-4 text-sm text-neutral-600" role="status">{statusMessage}</p>}
          <div className="mt-8 flex justify-end"><button type="button" onClick={() => setStep(2)} disabled={!canContinue} className="bg-moss px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue to visuals <span aria-hidden="true">→</span></button></div>
        </section>}

        {step === 2 && <section className="mx-auto max-w-3xl border-t border-neutral-200 py-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div><h2 className="text-xl font-semibold">Add visual media</h2><p className="mt-2 text-sm text-neutral-500">Add images and video clips. Video source audio is automatically excluded.</p></div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImportingVisuals} className="shrink-0 bg-moss px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{isImportingVisuals ? 'Importing…' : '+ Add media'}</button>
          </div>
          <input ref={fileInputRef} className="sr-only" type="file" multiple accept={visualAccept} onChange={(event) => void handleAddVisuals(event.target.files)} />
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleAddVisuals(event.dataTransfer.files); }} className="border border-dashed border-neutral-300 bg-white/70 p-6 text-center text-sm text-neutral-500">
            <p>Drop image or video files here, or choose Add media above.</p>
            <p className="mt-2 text-xs">Supported filename extensions: {getSupportedFormatsLabel('visual')}</p>
          </div>
          <div className="mt-5">{mediaLibrary}</div>
          <div className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
            {clips.map((clip) => {
              const asset = assets.find((item) => item.id === clip.assetId);
              return <div key={clip.id} className="flex items-center gap-3 py-3">
                {asset?.kind === 'image' ? <img src={asset.url} className="h-14 w-20 object-cover" alt="" /> : <video src={asset?.url} muted className="h-14 w-20 object-cover" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{asset?.file.name}</p><p className="mt-1 text-xs text-neutral-500">{asset?.kind === 'image' ? 'Still image' : 'Video clip'} · {getClipDuration(clip).toFixed(1)} sec</p></div>
                <button type="button" title="Remove clip" aria-label="Remove clip" onClick={() => removeClip(clip.id)} disabled={isImportingVisuals} className="px-2 py-2 text-neutral-500 disabled:cursor-not-allowed disabled:opacity-40">×</button>
              </div>;
            })}
            {!clips.length && <p className="py-10 text-center text-sm text-neutral-500">Your sequence is empty.</p>}
          </div>
          {statusMessage && <p role="status" className="mt-4 text-sm text-neutral-600">{statusMessage}</p>}
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(1)} disabled={isImportingVisuals} className="px-1 py-3 text-sm text-neutral-600 disabled:opacity-40">← Back</button><button type="button" onClick={() => setStep(3)} disabled={!canContinue || isImportingVisuals} className="bg-moss px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue to editor <span aria-hidden="true">→</span></button></div>
        </section>}

        {step === 3 && <section className="space-y-7 border-t border-neutral-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-xl font-semibold">Preview and edit</h2><p className="mt-1 text-sm text-neutral-500">{audioFile?.name} · {formatDuration(audioDuration)} soundtrack</p></div>
            <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="h-2 w-2 rounded-full bg-lime-500" />{projectStorageStatus.startsWith('Saved') ? 'Autosaved locally' : 'Local autosave enabled'}</div>
          </div>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(390px,0.9fr)]">
            <div className="space-y-4">
              <CompositionPreview assets={assets} tracks={tracks} clips={clips} titles={titles} currentTime={currentTime} isPlaying={isPlaying} seekRevision={previewSeekRevision} width={width} height={height} />
              <div className="flex items-center gap-4 border-b border-neutral-200 pb-4">
                <button type="button" onClick={playPause} className="grid h-10 w-10 shrink-0 place-items-center bg-ink text-white" aria-label={isPlaying ? 'Pause preview' : 'Play preview'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
                <div className="min-w-0 flex-1"><input aria-label="Preview position" type="range" min="0" max={Math.max(audioDuration, 0.1)} step="0.1" value={clampTimelineTime(currentTime, audioDuration)} onChange={(event) => { const time = clampTimelineTime(Number(event.target.value), audioDuration); setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(time); if (audioRef.current) audioRef.current.currentTime = time; }} className="w-full accent-moss" /><div className="flex justify-between text-[11px] tabular-nums text-neutral-500"><span>{formatDuration(clampTimelineTime(currentTime, audioDuration))}</span><span>{formatDuration(audioDuration)}</span></div></div>
              </div>
            </div>
            <aside className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="text-xs font-semibold text-neutral-600">Platform and placement
                  <select className="mt-2 w-full border border-neutral-200 bg-white px-3 py-3 text-sm font-normal text-ink" value={presetId} onChange={(event) => updateOutputSettings({ presetId: event.target.value })}>
                    {platformPresets.map((item) => <option key={item.id} value={item.id}>{item.platform} · {item.placement} ({item.width} × {item.height})</option>)}
                  </select>
                </label>
                {presetId === 'custom' && <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-neutral-600">Width<input className="mt-2 w-full border border-neutral-200 px-3 py-3 text-sm font-normal" type="number" min="144" max="3840" step="2" value={customWidth} onChange={(event) => updateOutputSettings({ customWidth: Math.max(144, Number(event.target.value)) })} /></label>
                  <label className="text-xs font-semibold text-neutral-600">Height<input className="mt-2 w-full border border-neutral-200 px-3 py-3 text-sm font-normal" type="number" min="144" max="3840" step="2" value={customHeight} onChange={(event) => updateOutputSettings({ customHeight: Math.max(144, Number(event.target.value)) })} /></label>
                </div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-neutral-600">File format<select className="mt-2 w-full border border-neutral-200 bg-white px-3 py-3 text-sm font-normal text-ink" value={format} onChange={(event) => updateOutputSettings({ format: event.target.value })}><option>MP4</option><option>WebM</option></select></label>
                <label className="text-xs font-semibold text-neutral-600">Frame rate<select className="mt-2 w-full border border-neutral-200 bg-white px-3 py-3 text-sm font-normal text-ink" value={frameRate} onChange={(event) => updateOutputSettings({ frameRate: Number(event.target.value) })}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
              </div>
              <div className="border-t border-neutral-200 pt-4"><div className="flex justify-between text-xs text-neutral-500"><span>Canvas</span><span className="font-medium text-ink">{width} × {height}</span></div><div className="mt-2 flex justify-between text-xs text-neutral-500"><span>Sequence</span><span className="font-medium text-ink">{formatDuration(Math.min(audioDuration, timelineDuration))} of {formatDuration(audioDuration)}</span></div><p className="mt-3 text-[11px] leading-relaxed text-neutral-500">Platform dimensions are starting presets. Check current platform requirements before publishing.</p></div>
              <TimelineEditor
                assets={assets}
                tracks={tracks}
                clips={clips}
                titles={titles}
                markers={markers}
                selectedTitleId={selectedTitleId}
                selectedClipId={selectedClipId}
                currentTime={currentTime}
                soundtrackDuration={audioDuration}
                onSeek={(time) => { const playableTime = clampTimelineTime(time, audioDuration); setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(playableTime); if (audioRef.current) audioRef.current.currentTime = playableTime; }}
                onAddTrack={addTrack}
                onTrackChange={updateTrack}
                onMoveClip={moveClipToTrack}
                onSelect={setSelectedClipId}
                onChange={updateClip}
                onTransform={updateTransform}
                onRemove={removeClip}
                onSplit={handleSplit}
                onDuplicate={duplicateClip}
                onSelectTitle={setSelectedTitleId}
                onSeekTitle={(time) => { const playableTime = clampTimelineTime(time, audioDuration); setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(playableTime); if (audioRef.current) audioRef.current.currentTime = playableTime; }}
                onAddMarker={addMarker}
                onRenameMarker={renameMarker}
                onRemoveMarker={removeMarker}
              />
              <TitleOverlayEditor
                titles={titles}
                selectedTitleId={selectedTitleId}
                onAdd={addTitle}
                onSelect={setSelectedTitleId}
                onChange={updateTitle}
                onRemove={removeTitle}
              />
              {mediaLibrary}
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
        <audio className="sr-only" ref={audioRef} src={audioUrl ?? undefined} onTimeUpdate={(event) => setCurrentTime(clampTimelineTime(event.currentTarget.currentTime, audioDuration))} onEnded={() => { setCurrentTime(audioDuration); setIsPlaying(false); }} />
      </main>
      {isExporting && <ExportProgress progress={exportProgress} isExporting statusMessage={statusMessage} />}
    </div>
  );
}

export default App;
