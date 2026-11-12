import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { AudioTimelinePlayback } from './components/AudioTimelinePlayback';
import { CompositionPreview } from './components/CompositionPreview';
import { ExportProgress } from './components/ExportProgress';
import { approvedProductionLinks } from './config/production';
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
import {
  buildProjectPackage,
  parseProjectPackage,
  sanitizeProjectPackageFilename,
} from './services/projectPackage';
import { MediaUrlRegistry } from './services/mediaUrlRegistry';
import { waitForVideoMetadata } from './services/videoMetadata';
import { waitForAudioMetadata } from './services/audioMetadata';
import { waitForImageDecode } from './services/imageMetadata';
import { APPROVED_MEDIA_LIMITS, getProjectMediaBytes, validateApprovedExportDuration, validateApprovedMediaFile } from './services/mediaLimits';
import { PORTABLE_PACKAGE_SAFETY_LIMITS } from './services/mediaSafetyLimits.js';
import { createHistory, type History } from './services/history';
import { getSupportedMimeType, renderVideo } from './services/videoExport';
import { createDefaultTitle, type TitleOverlay } from './services/titleOverlay';
import {
  clampTimelineTime,
  defaultTransform,
  getClipDuration,
  getTimelineDuration,
  getVisualCoverage,
  defaultVideoTrack,
  getAudioTimelineDuration,
  getAudioClipDuration,
  getVideoTimelineDuration,
  duplicateTimelineClip,
  platformPresets,
  snapTimelinePosition,
  splitClipAtTimelineTime,
  createTimelineMarker,
  MAX_TIMELINE_DURATION,
  MIN_STILL_DURATION,
  normalizeStillDuration,
  setStillDurationMode,
  updateMatchedStillDurations,
  type TimelineTrack,
  type TimelineAsset,
  type TimelineClip,
  type TimelineMarker,
  type AudioAsset,
  type AudioClip,
  type AudioTrack,
  type VisualTransform,
} from './services/timeline';

const steps = ['Audio', 'Visuals', 'Edit & export'];
const HISTORY_LIMIT = 50;

type EditSnapshot = {
  audioAssets: Array<Pick<AudioAsset, 'id' | 'file' | 'duration'>>;
  audioTracks: AudioTrack[];
  audioClips: AudioClip[];
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

function getProjectStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('checking')) return 'Checking…';
  if (/saving|preparing|validating|importing|exporting/.test(normalized)) return 'Working…';
  if (/could not|failed|error|unavailable|corrupt|malform|timed out|quota|blocked|needs attention/.test(normalized)) {
    return 'Needs attention';
  }
  if (normalized.includes('cancelled')) return 'Unchanged';
  if (normalized.includes('new project')) return 'New project';
  if (normalized.includes('storage is ready')) return 'Ready';
  if (/saved|recovered|opened|deleted|imported|exported/.test(normalized)) {
    return 'All changes saved';
  }
  return 'Unsaved changes';
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
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const audioFile = audioAssets[0]?.file ?? null;
  const audioDuration = getAudioTimelineDuration(audioClips);
  const [assets, setAssets] = useState<TimelineAsset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([defaultVideoTrack()]);
  const [titles, setTitles] = useState<TitleOverlay[]>([]);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [selectedAudioClipId, setSelectedAudioClipId] = useState('');
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [previewSeekRevision, setPreviewSeekRevision] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presetId, setPresetId] = useState('youtube');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [frameRate, setFrameRate] = useState(30);
  const [format, setFormat] = useState('MP4');
  const availableExportFormats = useMemo(
    () => ['MP4', 'WebM'].filter((candidate) => getSupportedMimeType(candidate) !== null),
    [],
  );
  const sequenceDuration = Math.max(audioDuration, getTimelineDuration(clips), ...titles.map((title) => title.start + title.duration), 0);
  const videoDuration = getVideoTimelineDuration(clips, assets, tracks);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [timelinePixelsPerSecond, setTimelinePixelsPerSecond] = useState(48);
  const [snapTimelineEnabled, setSnapTimelineEnabled] = useState(true);
  const [previewVolume, setPreviewVolume] = useState(1);
  const [statusMessage, setStatusMessage] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [isImportingVisuals, setIsImportingVisuals] = useState(false);
  const [isProjectPackageBusy, setIsProjectPackageBusy] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const visualCoverage = useMemo(
    () => getVisualCoverage(clips, assets, sequenceDuration, tracks),
    [clips, assets, sequenceDuration, tracks],
  );
  const playbackTimeRef = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const wasExportingRef = useRef(false);
  const visualImportRef = useRef(false);
  const urlsRef = useRef(new MediaUrlRegistry());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectPackageInputRef = useRef<HTMLInputElement | null>(null);
  const startupRef = useRef(false);
  const historyRef = useRef<History<EditSnapshot> | null>(null);
  const projectListRef = useRef(projectList);
  projectListRef.current = projectList;

  const makeEditSnapshot = (overrides: Partial<EditSnapshot> = {}): EditSnapshot => ({
    audioAssets: audioAssets.map(({ id, file, duration }) => ({ id, file, duration })),
    audioTracks,
    audioClips,
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

  const recordEdit = (snapshot: EditSnapshot, coalescingKey?: string) => {
    historyRef.current?.push(snapshot, coalescingKey);
    syncHistoryButtons();
  };

  const endEditCoalescing = () => {
    historyRef.current?.endCoalescing();
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
    const restoredAudioAssets: AudioAsset[] = snapshot.audioAssets.map((asset) => {
      const url = urlsRef.current.create(asset.file);
      newUrls.push(url);
      return { ...asset, url };
    });
    urlsRef.current.replace(newUrls);

    setAudioAssets(restoredAudioAssets);
    setAudioTracks(snapshot.audioTracks);
    setAudioClips(snapshot.audioClips);
    setAssets(restoredAssets);
    setTracks(snapshot.tracks);
    setClips(snapshot.clips);
    setSelectedAudioClipId((current) => snapshot.audioClips.some((clip) => clip.id === current)
      ? current
      : (snapshot.audioClips[0]?.id ?? ''));
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
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedAudioClip = audioClips.find((clip) => clip.id === selectedAudioClipId);
  const selectedTrack = tracks.find((track) => track.id === selectedClip?.trackId);
  const primaryAudio = audioAssets[0];
  const audioMeta = {
    fileName: primaryAudio?.file.name ?? 'No audio selected',
    fileSize: primaryAudio ? formatFileSize(primaryAudio.file.size) : '0 KB',
    detectedType: primaryAudio?.file.type || 'audio',
  };
  const libraryItems: MediaLibraryItem[] = [
    ...audioAssets.map((asset) => ({ id: asset.id, file: asset.file, kind: 'audio' as const, duration: asset.duration })),
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
    mainRef.current?.toggleAttribute('inert', isExporting || isProjectPackageBusy);
  }, [isExporting, isProjectPackageBusy]);
  useEffect(() => {
    if (wasExportingRef.current && !isExporting) exportButtonRef.current?.focus();
    wasExportingRef.current = isExporting;
  }, [isExporting]);
  useEffect(() => {
    playbackTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const next = playbackTimeRef.current + Math.max(0, now - previous) / 1000;
      previous = now;
      if (next >= sequenceDuration) {
        playbackTimeRef.current = sequenceDuration;
        setCurrentTime(sequenceDuration);
        setIsPlaying(false);
        return;
      }
      playbackTimeRef.current = next;
      setCurrentTime(next);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isPlaying, sequenceDuration]);
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
    schemaVersion: 6,
    audioAssets: audioAssets.map((asset) => ({
      id: asset.id,
      fileName: asset.file.name,
      mimeType: asset.file.type,
      size: asset.file.size,
      duration: asset.duration,
    })),
    audioTracks,
    audioClips,
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
    audioAssets: Object.fromEntries(audioAssets.map((asset) => [asset.id, asset.file])),
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

  const applyStoredProject = async (stored: StoredProject, mediaAlreadyDecoded = false) => {
    const createdUrls: string[] = [];
    try {
      const restoredAssets = await Promise.all(stored.document.assets.map(async (asset): Promise<TimelineAsset> => {
        const blob = stored.media.assets[asset.id];
        const file = new File([blob], asset.fileName, { type: asset.mimeType });
        const url = urlsRef.current.create(file);
        createdUrls.push(url);
        if (!mediaAlreadyDecoded && asset.kind === 'image') {
          const image = new Image();
          try {
            await waitForImageDecode(image, url);
          } catch {
            throw new Error(`Could not read "${asset.fileName}". Re-import the original media file.`);
          }
        } else if (!mediaAlreadyDecoded) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          try {
            await waitForVideoMetadata(video, url);
          } catch (error) {
            const reason = error instanceof Error ? ` ${error.message}` : '';
            throw new Error(`Could not read "${asset.fileName}".${reason} Re-import the original media file.`);
          }
        }
        return { id: asset.id, file, url, kind: asset.kind, duration: asset.duration };
      }));

      const restoredAudioAssets = await Promise.all(stored.document.audioAssets.map(async (asset): Promise<AudioAsset> => {
        const blob = stored.media.audioAssets[asset.id];
        const file = new File([blob], asset.fileName, { type: asset.mimeType });
        const url = urlsRef.current.create(file);
        createdUrls.push(url);
        if (!mediaAlreadyDecoded) {
          const audio = new Audio();
          audio.preload = 'metadata';
          try {
            await waitForAudioMetadata(audio, url);
          } catch (error) {
            const reason = error instanceof Error ? ` ${error.message}` : '';
            throw new Error(`Could not read "${asset.fileName}".${reason} Re-import the original media file.`);
          }
        }
        return { id: asset.id, file, url, duration: asset.duration };
      }));

      urlsRef.current.replace(createdUrls);

      const documentValue = stored.document;
      const restoredAudioDuration = getAudioTimelineDuration(documentValue.audioClips);
      const restoredClips = updateMatchedStillDurations(
        documentValue.clips,
        restoredAudioDuration,
        getTimelineDuration(documentValue.clips),
      );
      setProjectId(documentValue.id);
      setProjectName(documentValue.name);
      setProjectCreatedAt(documentValue.createdAt);
      setAudioAssets(restoredAudioAssets);
      setAudioTracks(documentValue.audioTracks);
      setAudioClips(documentValue.audioClips);
      setAssets(restoredAssets);
      setTracks(documentValue.tracks);
      setClips(restoredClips);
      setTitles(documentValue.titleOverlays);
      setMarkers(documentValue.markers);
      setSelectedClipId(restoredClips[0]?.id ?? '');
      setSelectedAudioClipId(documentValue.audioClips[0]?.id ?? '');
      setSelectedTitleId(documentValue.titleOverlays[0]?.id ?? '');
      setStep(documentValue.audioAssets.length ? (documentValue.clips.length ? 3 : 2) : 1);
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
        audioAssets: restoredAudioAssets.map(({ id, file, duration }) => ({ id, file, duration })),
        audioTracks: documentValue.audioTracks,
        audioClips: documentValue.audioClips,
        assets: restoredAssets.map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
        tracks: documentValue.tracks,
        clips: restoredClips,
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
        setIsProjectStorageReady(true);
      } catch (error) {
        setIsProjectStorageReady(true);
        setProjectStorageStatus(error instanceof Error ? error.message : 'Local project recovery failed. Your current project is still open.');
      }
    })();
  }, []);

  useEffect(() => {
    const hasProjectContent = Boolean(audioAssets.length || assets.length || clips.length || titles.length || markers.length);
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
    isProjectStorageReady, projectId, projectName, projectCreatedAt, audioAssets, audioTracks, audioClips, audioDuration,
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

  const handleAudioSelect = async (files: File[]) => {
    const addedAssets: AudioAsset[] = [];
    const addedTracks: AudioTrack[] = [];
    const addedClips: AudioClip[] = [];
    const rejected: string[] = [];
    let projectMediaBytes = getProjectMediaBytes(audioAssets.map((asset) => asset.file), assets);

    for (const file of files) {
      const validation = validateMediaImport(file, 'audio');
      if (!validation.valid) {
        rejected.push(validation.message);
        continue;
      }
      const mediaLimitError = validateApprovedMediaFile(file, projectMediaBytes, 'audio');
      if (mediaLimitError) {
        rejected.push(mediaLimitError);
        continue;
      }
      let duration: number;
      try {
        duration = await readAudioDuration(file);
      } catch (error) {
        const reason = error instanceof Error ? ` ${error.message}` : '';
        rejected.push(`Could not read "${file.name}".${reason}`);
        continue;
      }
      if (duration <= 0) {
        rejected.push(`Could not read the duration of "${file.name}". This browser may not be able to decode this file.`);
        continue;
      }

      const id = newId();
      const url = urlsRef.current.create(file);
      const track: AudioTrack = {
        id: newId(),
        name: `Audio ${audioTracks.length + addedTracks.length + 1}`,
        order: audioTracks.length + addedTracks.length,
        visible: true,
        locked: false,
      };
      addedAssets.push({ id, file, url, duration });
      addedTracks.push(track);
      addedClips.push({
        id: newId(),
        assetId: id,
        trackId: track.id,
        timelinePosition: 0,
        start: 0,
        end: duration,
        volume: 1,
      });
      projectMediaBytes += file.size;
    }

    if (addedAssets.length) {
      const nextAssets = [...audioAssets, ...addedAssets];
      const nextTracks = [...audioTracks, ...addedTracks];
      const nextAudioClips = [...audioClips, ...addedClips];
      const nextStillClips = updateMatchedStillDurations(
        clips,
        getAudioTimelineDuration(nextAudioClips),
        getTimelineDuration(clips),
      );
      setAudioAssets(nextAssets);
      setAudioTracks(nextTracks);
      setAudioClips(nextAudioClips);
      setClips(nextStillClips);
      setSelectedAudioClipId(addedClips[0].id);
      recordEdit(makeEditSnapshot({
        audioAssets: nextAssets.map(({ id: assetId, file: audioSource, duration: audioSourceDuration }) => ({
          id: assetId,
          file: audioSource,
          duration: audioSourceDuration,
        })),
        audioTracks: nextTracks,
        audioClips: nextAudioClips,
        clips: nextStillClips,
      }));
      setStatusMessage(`Added ${addedAssets.length} audio file${addedAssets.length === 1 ? '' : 's'} as timeline track${addedAssets.length === 1 ? '' : 's'}.${rejected.length ? ` ${rejected.join(' ')}` : ''}`);
    } else {
      setStatusMessage(rejected.join(' ') || 'Choose a supported, decodable audio file.');
    }
  };

  const removeAudio = (assetId: string) => {
    const asset = audioAssets.find((item) => item.id === assetId);
    if (!asset) return;
    const nextAudioAssets = audioAssets.filter((item) => item.id !== assetId);
    const nextAudioClips = audioClips.filter((clip) => clip.assetId !== assetId);
    const usedTrackIds = new Set(nextAudioClips.map((clip) => clip.trackId));
    const nextAudioTracks = audioTracks.filter((track) => usedTrackIds.has(track.id));
    setAudioAssets(nextAudioAssets);
    setAudioClips(nextAudioClips);
    setAudioTracks(nextAudioTracks);
    if (selectedAudioClipId && !nextAudioClips.some((clip) => clip.id === selectedAudioClipId)) {
      setSelectedAudioClipId(nextAudioClips[0]?.id ?? '');
    }
    revokeUrl(asset.url);
    recordEdit(makeEditSnapshot({
      audioAssets: nextAudioAssets.map(({ id: assetId, file, duration }) => ({ id: assetId, file, duration })),
      audioTracks: nextAudioTracks,
      audioClips: nextAudioClips,
    }));
    setStatusMessage(`Removed "${asset.file.name}" and its audio clips from this project. The original source file was not deleted.`);
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
      let projectMediaBytes = getProjectMediaBytes(audioAssets.map((asset) => asset.file), assets);
      const eligibleFiles = files.filter((file) => {
        const validation = validateMediaImport(file, 'visual');
        if (!validation.valid) rejected.push(validation.message);
        if (!validation.valid) return false;
        const mediaLimitError = validateApprovedMediaFile(file, projectMediaBytes, 'visual');
        if (mediaLimitError) {
          rejected.push(mediaLimitError);
          return false;
        }
        projectMediaBytes += file.size;
        return true;
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
            await waitForImageDecode(image, url);
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
        const timelinePosition = asset.kind === 'image'
          ? Math.min(appendAt, MAX_TIMELINE_DURATION - MIN_STILL_DURATION)
          : appendAt;
        const clip: TimelineClip = {
          id: newId(),
          assetId: asset.id,
          trackId: appendTrackId,
          timelinePosition,
          start: 0,
          end: asset.kind === 'video' ? asset.duration : 0,
          stillDuration: asset.kind === 'image' ? normalizeStillDuration(5, timelinePosition) : 5,
          stillDurationMode: 'custom',
          transition: 'none',
          transform: { ...defaultTransform },
        };
        appendAt += getClipDuration(clip);
        return clip;
      });
      const allAssets = [...assets, ...validAssets];
      const allClips = updateMatchedStillDurations(
        [...clips, ...newClips],
        audioDuration,
        getVideoTimelineDuration([...clips, ...newClips], allAssets, tracks),
      );
      setAssets((current) => [...current, ...validAssets]);
      setClips(allClips);
      if (newClips.length) {
        recordEdit(makeEditSnapshot({
          assets: allAssets.map(({ id, file, kind, duration }) => ({ id, file, kind, duration })),
          tracks,
          clips: allClips,
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
    const asset = assets.find((item) => item.id === target.assetId);
    const isStill = asset?.kind === 'image';
    const normalizedPatch = { ...patch };
    if (isStill && typeof normalizedPatch.timelinePosition === 'number') {
      normalizedPatch.timelinePosition = Math.max(
        0,
        Math.min(normalizedPatch.timelinePosition, MAX_TIMELINE_DURATION - MIN_STILL_DURATION),
      );
    }
    let updated = { ...target, ...normalizedPatch };
    const videoDuration = getVideoTimelineDuration(clips, assets, tracks);
    if (isStill && patch.stillDurationMode === 'match-audio' && audioDuration <= 0) return;
    if (isStill && patch.stillDurationMode === 'match-video' && videoDuration <= 0) return;
    if (isStill && patch.stillDurationMode === 'custom') {
      const longestTimelineDuration = Math.max(audioDuration, videoDuration);
      updated = {
        ...updated,
        stillDuration: normalizeStillDuration(longestTimelineDuration > 0
          ? longestTimelineDuration - updated.timelinePosition
          : target.stillDuration, updated.timelinePosition),
      };
    } else if (isStill && (
      patch.stillDurationMode === 'match-audio'
      || (typeof patch.timelinePosition === 'number' && updated.stillDurationMode === 'match-audio')
    )) {
      updated = setStillDurationMode(updated, 'match-audio', audioDuration, videoDuration);
    } else if (isStill && (
      patch.stillDurationMode === 'match-video'
      || (typeof patch.timelinePosition === 'number' && updated.stillDurationMode === 'match-video')
    )) {
      updated = setStillDurationMode(updated, 'match-video', audioDuration, videoDuration);
    }
    if (isStill && (typeof patch.stillDuration === 'number' || typeof patch.timelinePosition === 'number')) {
      updated = {
        ...updated,
        stillDuration: normalizeStillDuration(updated.stillDuration, updated.timelinePosition),
      };
    }
    const nextClips = updateMatchedStillDurations(
      clips.map((clip) => clip.id === id ? updated : clip),
      audioDuration,
      getVideoTimelineDuration(clips.map((clip) => clip.id === id ? updated : clip), assets, tracks),
    );
    if (nextClips.every((clip, index) => clip === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips }));
  };
  const updateTransform = (id: string, patch: Partial<VisualTransform>, coalescingKey?: string) => {
    const target = clips.find((clip) => clip.id === id);
    if (!target || tracks.find((track) => track.id === target.trackId)?.locked) return;
    const nextClips = clips.map((clip) => clip.id === id
      ? { ...clip, transform: { ...clip.transform, ...patch } }
      : clip);
    if (nextClips.every((clip, index) => clip === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips }), coalescingKey);
  };
  const removeClip = (id: string) => {
    const remainingClips = clips.filter((clip) => clip.id !== id);
    const nextClips = updateMatchedStillDurations(
      remainingClips,
      audioDuration,
      getVideoTimelineDuration(remainingClips, assets, tracks),
    );
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
    const remainingClips = clips.filter((clip) => clip.assetId !== assetId);
    const nextClips = updateMatchedStillDurations(
      remainingClips,
      audioDuration,
      getVideoTimelineDuration(remainingClips, nextAssets, tracks),
    );
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
    const isStill = assets.find((asset) => asset.id === clip.assetId)?.kind === 'image';
    const position = Math.min(
      snapTimelinePosition(timelinePosition, false),
      MAX_TIMELINE_DURATION - (isStill ? MIN_STILL_DURATION : 0),
    );
    let updated = { ...clip, trackId, timelinePosition: position };
    if (isStill && clip.stillDurationMode === 'match-audio') {
      updated = setStillDurationMode(updated, 'match-audio', audioDuration, getVideoTimelineDuration(clips, assets, tracks));
    } else if (isStill && clip.stillDurationMode === 'match-video') {
      updated = setStillDurationMode(updated, 'match-video', audioDuration, getVideoTimelineDuration(clips, assets, tracks));
    } else if (isStill) {
      updated = { ...updated, stillDuration: normalizeStillDuration(updated.stillDuration, position) };
    }
    const movedClips = clips.map((item) => item.id === id ? updated : item);
    const nextClips = updateMatchedStillDurations(
      movedClips,
      audioDuration,
      getVideoTimelineDuration(movedClips, assets, tracks),
    );
    if (nextClips.every((item, index) => item === clips[index])) return;
    setClips(nextClips);
    recordEdit(makeEditSnapshot({ clips: nextClips, tracks }));
  };

  const duplicateClip = (id: string) => {
    const source = clips.find((clip) => clip.id === id);
    if (!source || tracks.find((track) => track.id === source.trackId)?.locked) return;
    const duplicatedClips = duplicateTimelineClip(clips, id);
    const nextClips = updateMatchedStillDurations(
      duplicatedClips,
      audioDuration,
      getVideoTimelineDuration(duplicatedClips, assets, tracks),
    );
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

  const addAudioTrack = () => {
    const order = Math.max(-1, ...audioTracks.map((track) => track.order)) + 1;
    const track: AudioTrack = {
      id: newId(),
      name: `Audio ${audioTracks.length + 1}`,
      order,
      visible: true,
      locked: false,
    };
    const nextTracks = [...audioTracks, track];
    setAudioTracks(nextTracks);
    recordEdit(makeEditSnapshot({ audioTracks: nextTracks }));
  };

  const duplicateAudioTrack = (id: string) => {
    const source = audioTracks.find((track) => track.id === id);
    if (!source) return;
    const duplicateId = newId();
    const order = Math.max(-1, ...audioTracks.map((track) => track.order)) + 1;
    const duplicate: AudioTrack = {
      ...source,
      id: duplicateId,
      name: `${source.name} copy`,
      order,
      locked: false,
    };
    const duplicatedClips = audioClips
      .filter((clip) => clip.trackId === source.id)
      .map((clip) => ({ ...clip, id: newId(), trackId: duplicateId }));
    const nextTracks = [...audioTracks, duplicate];
    const nextClips = [...audioClips, ...duplicatedClips];
    setAudioTracks(nextTracks);
    setAudioClips(nextClips);
    setSelectedAudioClipId(duplicatedClips[0]?.id ?? '');
    recordEdit(makeEditSnapshot({ audioTracks: nextTracks, audioClips: nextClips }));
  };

  const removeAudioTrack = (id: string) => {
    const track = audioTracks.find((item) => item.id === id);
    if (!track) return;
    const nextTracks = audioTracks.filter((item) => item.id !== id);
    const nextClips = audioClips.filter((clip) => clip.trackId !== id);
    setAudioTracks(nextTracks);
    setAudioClips(nextClips);
    if (selectedAudioClipId && !nextClips.some((clip) => clip.id === selectedAudioClipId)) {
      setSelectedAudioClipId(nextClips[0]?.id ?? '');
    }
    recordEdit(makeEditSnapshot({ audioTracks: nextTracks, audioClips: nextClips }));
    setStatusMessage(`Removed "${track.name}" and its clips. Source audio files remain in the media library.`);
  };

  const addAudioClip = (assetId: string) => {
    const asset = audioAssets.find((item) => item.id === assetId);
    if (!asset || asset.duration <= 0) return;
    let track = audioTracks.find((item) => item.id === audioClips.find((clip) => clip.id === selectedAudioClipId)?.trackId && !item.locked)
      ?? audioTracks.find((item) => !item.locked);
    let nextTracks = audioTracks;
    if (!track) {
      track = {
        id: newId(),
        name: `Audio ${audioTracks.length + 1}`,
        order: Math.max(-1, ...audioTracks.map((item) => item.order)) + 1,
        visible: true,
        locked: false,
      };
      nextTracks = [...audioTracks, track];
      setAudioTracks(nextTracks);
    }
    const clipEnd = Math.min(asset.duration, MAX_TIMELINE_DURATION);
    const clip: AudioClip = {
      id: newId(),
      assetId,
      trackId: track.id,
      timelinePosition: Math.min(currentTime, Math.max(0, MAX_TIMELINE_DURATION - clipEnd)),
      start: 0,
      end: clipEnd,
      volume: 1,
    };
    const nextClips = [...audioClips, clip];
    setAudioClips(nextClips);
    setSelectedAudioClipId(clip.id);
    recordEdit(makeEditSnapshot({ audioTracks: nextTracks, audioClips: nextClips }));
  };

  const duplicateAudioClip = (id: string) => {
    const source = audioClips.find((clip) => clip.id === id);
    const track = audioTracks.find((item) => item.id === source?.trackId);
    if (!source || track?.locked) return;
    const clipDuration = getAudioClipDuration(source);
    const duplicate = {
      ...source,
      id: newId(),
      timelinePosition: Math.min(
        MAX_TIMELINE_DURATION - clipDuration,
        source.timelinePosition + clipDuration,
      ),
    };
    const nextClips = [...audioClips, duplicate];
    setAudioClips(nextClips);
    setSelectedAudioClipId(duplicate.id);
    recordEdit(makeEditSnapshot({ audioClips: nextClips }));
  };

  const removeAudioClip = (id: string) => {
    const nextClips = audioClips.filter((clip) => clip.id !== id);
    if (nextClips.length === audioClips.length) return;
    setAudioClips(nextClips);
    setSelectedAudioClipId(nextClips[0]?.id ?? '');
    recordEdit(makeEditSnapshot({ audioClips: nextClips }));
  };

  const updateAudioClip = (id: string, patch: Partial<Pick<AudioClip, 'start' | 'end' | 'timelinePosition' | 'volume'>>) => {
    const target = audioClips.find((clip) => clip.id === id);
    const asset = audioAssets.find((item) => item.id === target?.assetId);
    const track = audioTracks.find((item) => item.id === target?.trackId);
    if (!target || !asset || asset.duration <= 0 || track?.locked) return;
    const updated = { ...target, ...patch };
    const minimumSourceDuration = Math.min(0.1, asset.duration);
    updated.start = Math.max(0, Math.min(asset.duration - minimumSourceDuration, updated.start));
    updated.end = Math.max(updated.start + minimumSourceDuration, Math.min(asset.duration, updated.end));
    updated.timelinePosition = Math.max(0, Math.min(MAX_TIMELINE_DURATION - getAudioClipDuration(updated), updated.timelinePosition));
    updated.volume = Math.max(0, Math.min(2, updated.volume));
    const nextClips = audioClips.map((clip) => clip.id === id ? updated : clip);
    setAudioClips(nextClips);
    recordEdit(makeEditSnapshot({ audioClips: nextClips }));
  };

  const updateAudioTrack = (id: string, patch: Partial<Pick<AudioTrack, 'name' | 'visible' | 'locked'>>) => {
    const nextTracks = audioTracks.map((track) => track.id === id ? { ...track, ...patch } : track);
    if (nextTracks.every((track, index) => track === audioTracks[index])) return;
    setAudioTracks(nextTracks);
    recordEdit(makeEditSnapshot({ audioTracks: nextTracks }));
  };

  const moveAudioClip = (clipId: string, trackId: string, timelinePosition: number) => {
    const clip = audioClips.find((item) => item.id === clipId);
    const targetTrack = audioTracks.find((track) => track.id === trackId);
    const sourceTrack = audioTracks.find((track) => track.id === clip?.trackId);
    if (!clip || !targetTrack || targetTrack.locked || sourceTrack?.locked) return;
    const maximumPosition = Math.max(0, MAX_TIMELINE_DURATION - getAudioClipDuration(clip));
    const updated = {
      ...clip,
      trackId,
      timelinePosition: Math.min(maximumPosition, Math.max(0, snapTimelinePosition(timelinePosition, snapTimelineEnabled))),
    };
    const nextClips = audioClips.map((item) => item.id === clipId ? updated : item);
    setAudioClips(nextClips);
    recordEdit(makeEditSnapshot({ audioClips: nextClips }));
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

  const updateTitle = (id: string, patch: Partial<TitleOverlay>, coalescingKey?: string) => {
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
    recordEdit(makeEditSnapshot({ titles: nextTitles }), coalescingKey);
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

  useEffect(() => {
    if (!isProjectMenuOpen) return;
    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const clickedInsideMenu = projectMenuRef.current?.contains(target);
      const clickedMenuButton = projectMenuButtonRef.current?.contains(target);
      if (!clickedInsideMenu && !clickedMenuButton) {
        setIsProjectMenuOpen(false);
      }
    };
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsProjectMenuOpen(false);
      projectMenuButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isProjectMenuOpen]);

  const resetProjectState = () => {
    urlsRef.current.clear();
    setProjectId(newId());
    setProjectName('Untitled project');
    setProjectCreatedAt(new Date().toISOString());
    setStep(1);
    setAudioAssets([]);
    setAudioTracks([]);
    setAudioClips([]);
    setAssets([]);
    setTracks([defaultVideoTrack()]);
    setClips([]);
    setTitles([]);
    setMarkers([]);
    setSelectedClipId('');
    setSelectedAudioClipId('');
    setSelectedTitleId('');
    setCurrentTime(0);
    setIsPlaying(false);
    setPresetId('youtube');
    setCustomWidth(1920);
    setCustomHeight(1080);
    setFrameRate(30);
    setFormat('MP4');
    resetEditHistory({
      audioAssets: [],
      audioTracks: [],
      audioClips: [],
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
    const hasUnsavedChanges = Boolean(audioAssets.length || assets.length || clips.length || titles.length || markers.length);
    if (hasUnsavedChanges && !window.confirm('Create a new project? The current project will be saved in this browser before starting fresh.')) {
      return;
    }
    try {
      if (hasUnsavedChanges) await saveCurrentProject();
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
      if (audioAssets.length || assets.length || clips.length) await saveCurrentProject();
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

  const verifyPackageMediaDecodes = async (stored: StoredProject) => {
    const temporaryUrls: string[] = [];
    try {
      for (const asset of stored.document.audioAssets) {
        const file = new File([stored.media.audioAssets[asset.id]], asset.fileName, { type: asset.mimeType });
        const url = urlsRef.current.create(file);
        temporaryUrls.push(url);
        const audio = document.createElement('audio');
        await waitForAudioMetadata(audio, url);
      }
      for (const asset of stored.document.assets) {
        const file = new File([stored.media.assets[asset.id]], asset.fileName, { type: asset.mimeType });
        const url = urlsRef.current.create(file);
        temporaryUrls.push(url);
        if (asset.kind === 'image') {
          const image = new Image();
          try {
            await waitForImageDecode(image, url);
          } catch {
            throw new Error(`Could not decode "${asset.fileName}". Choose a readable original media file.`);
          }
        } else {
          const video = document.createElement('video');
          video.preload = 'metadata';
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error(`Timed out while reading "${asset.fileName}".`)), 12_000);
            video.onloadedmetadata = () => {
              window.clearTimeout(timeout);
              Number.isFinite(video.duration) && video.duration > 0
                ? resolve()
                : reject(new Error(`Could not decode "${asset.fileName}". Choose a readable original media file.`));
            };
            video.onerror = () => {
              window.clearTimeout(timeout);
              reject(new Error(`Could not decode "${asset.fileName}". Choose a readable original media file.`));
            };
            video.src = url;
          });
        }
      }
    } finally {
      temporaryUrls.forEach((url) => urlsRef.current.revoke(url));
    }
  };

  const handleExportProjectFile = async () => {
    setIsProjectPackageBusy(true);
    setProjectStorageStatus('Preparing portable project file…');
    let downloadUrl: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const json = await buildProjectPackage(makeProjectDocument(), makeProjectMedia(), globalThis.crypto, APPROVED_MEDIA_LIMITS);
      downloadUrl = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
      link = document.createElement('a');
      link.href = downloadUrl;
      link.download = sanitizeProjectPackageFilename(projectName);
      link.click();
      setProjectStorageStatus(`Exported “${link.download}”. Keep this file and your original media backed up.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error ? error.message : 'Could not export this project file. Your edits are still open.');
    } finally {
      link?.remove();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setIsProjectPackageBusy(false);
    }
  };

  const handleImportProjectFile = async (file?: File) => {
    if (!file) return;
    setIsProjectPackageBusy(true);
    setProjectStorageStatus('Validating project package and media integrity…');
    try {
      if (file.size > PORTABLE_PACKAGE_SAFETY_LIMITS.maxProjectPackageFileBytes) {
        throw new Error('Project package exceeds this build’s import safety guard. Your current project is unchanged; try a smaller package.');
      }
      const imported = await parseProjectPackage(await file.text(), globalThis.crypto, APPROVED_MEDIA_LIMITS);
      setProjectStorageStatus('Checking that imported media can be decoded…');
      await verifyPackageMediaDecodes(imported);
      const hasActiveWork = Boolean(
        audioAssets.length || assets.length || clips.length || titles.length || markers.length
        || projectName !== 'Untitled project' || presetId !== 'youtube'
        || customWidth !== 1920 || customHeight !== 1080 || frameRate !== 30 || format !== 'MP4',
      );
      if (hasActiveWork && !window.confirm(
        'Import this project into the editor? Your current unsaved edits will be replaced. The imported project will be saved as a separate project; cancel to keep editing.',
      )) {
        setProjectStorageStatus('Import cancelled. Your current project and edits are unchanged.');
        return;
      }

      const importedId = newId();
      const importedDocument: ProjectDocument = {
        ...imported.document,
        id: importedId,
      };
      setProjectStorageStatus('Saving imported project as a separate local project…');
      await projectStorage.saveProjectAsNew(importedDocument, imported.media);
      await applyStoredProject({
        ...imported,
        document: importedDocument,
      }, true);
      try {
        await refreshProjectList(importedId);
      } catch {
        setProjectList((current) => [{
          id: importedId,
          name: importedDocument.name,
          createdAt: importedDocument.createdAt,
          updatedAt: importedDocument.updatedAt,
        }, ...current]);
        setProjectToOpen(importedId);
      }
      setProjectStorageStatus(`Imported “${importedDocument.name}” as a separate project. It is stored in this browser; storage quota/eviction may apply, so keep the exported file backed up.`);
    } catch (error) {
      setProjectStorageStatus(error instanceof Error
        ? `${error.message} Your current edits remain open.`
        : 'Could not import this project. Your current edits remain open.');
    } finally {
      if (projectPackageInputRef.current) projectPackageInputRef.current.value = '';
      setIsProjectPackageBusy(false);
    }
  };

  const handleExport = async () => {
    if (isExporting || exportAbortControllerRef.current) return;
    setExportComplete(false);
    if (!clips.length) {
      setStatusMessage('Add at least one visual clip before exporting.');
      return;
    }
    const renderDuration = sequenceDuration;
    const durationLimitError = validateApprovedExportDuration(renderDuration);
    if (durationLimitError) {
      setStatusMessage(durationLimitError);
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
    const abortController = new AbortController();
    exportAbortControllerRef.current = abortController;
    setStatusMessage('Preparing your video…');
    try {
      const blob = await renderVideo({
        audioAssets,
        audioTracks,
        audioClips,
        assets,
        tracks,
        clips,
        titles,
        duration: renderDuration,
        width,
        height,
        frameRate,
        mimeType,
        signal: abortController.signal,
        onStatus: (message) => {
          if (!abortController.signal.aborted) setStatusMessage(message);
        },
        onProgress: (progress) => {
          if (abortController.signal.aborted) return;
          setExportProgress(progress);
          setStatusMessage(`Rendering your video · ${Math.round(progress)}%`);
        },
      });
      if (abortController.signal.aborted) throw new DOMException('Render canceled.', 'AbortError');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildOutputFileName(audioFile?.name ?? projectName, format.toLowerCase());
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportProgress(100);
      setExportComplete(true);
      setStatusMessage('Render complete. Video download requested. You can keep editing and render again.');
    } catch (error) {
      setExportComplete(false);
      setStatusMessage(abortController.signal.aborted
        ? 'Export canceled. Your project is unchanged.'
        : `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (exportAbortControllerRef.current === abortController) exportAbortControllerRef.current = null;
      setIsExporting(false);
    }
  };

  const canContinue = step === 1 ? Boolean(audioAssets.length && audioDuration > 0) : clips.length > 0;
  const stepsComplete = [Boolean(audioAssets.length), clips.length > 0, false];
  const playPause = () => {
    if (currentTime >= sequenceDuration) {
      playbackTimeRef.current = 0;
      setCurrentTime(0);
      setPreviewSeekRevision((revision) => revision + 1);
    }
    setIsPlaying((playing) => !playing);
  };
  const togglePreviewFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await previewContainerRef.current?.requestFullscreen();
    } catch (error) {
      setStatusMessage(error instanceof Error
        ? `Could not change preview fullscreen mode: ${error.message}`
        : 'Could not change preview fullscreen mode.');
    }
  };

  const projectStatusLabel = getProjectStatusLabel(projectStorageStatus);

  const menuGroups = [
    {
      label: 'PROJECT',
      items: [
        { label: 'New project', icon: '✦', onClick: () => void startNewVideo(), disabled: isExporting || isImportingVisuals || isProjectPackageBusy || !isProjectStorageReady },
        { label: 'Open project', icon: '↗', onClick: () => void handleOpenProject(), disabled: !projectToOpen || isExporting || isImportingVisuals || isProjectPackageBusy },
        { label: 'Save as…', icon: '⎘', onClick: () => void handleSaveAs(), disabled: isExporting || isImportingVisuals || isProjectPackageBusy || !isProjectStorageReady },
        { label: 'Delete project', icon: '⌫', onClick: () => void handleDeleteProject(), disabled: !projectToOpen || isExporting || isImportingVisuals || isProjectPackageBusy },
      ],
    },
    {
      label: 'EDIT',
      items: [
        { label: 'Undo', icon: '↶', onClick: undoEdit, disabled: !canUndo || isExporting || isImportingVisuals },
        { label: 'Redo', icon: '↷', onClick: redoEdit, disabled: !canRedo || isExporting || isImportingVisuals },
      ],
    },
    {
      label: 'FILE',
      items: [
        { label: 'Import project', icon: '⇩', onClick: () => projectPackageInputRef.current?.click(), disabled: isExporting || isImportingVisuals || isProjectPackageBusy || !isProjectStorageReady },
        { label: 'Export project file', icon: '⇪', onClick: () => void handleExportProjectFile(), disabled: isExporting || isImportingVisuals || isProjectPackageBusy },
      ],
    },
  ];

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
                  {item.kind === 'audio' ? 'Audio' : item.kind === 'image' ? 'Image' : 'Video'}
                  {' · '}{getMediaTypeLabel(item.file)}{' · '}{formatFileSize(item.file.size)}
                  {item.kind === 'image'
                    ? ' · source duration N/A (still image)'
                    : item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}
                </p>
              </div>
              {item.kind === 'audio' && (
                <button
                  type="button"
                  onClick={() => addAudioClip(item.id)}
                  disabled={isExporting || isImportingVisuals || isProjectPackageBusy}
                  aria-label={`Add ${item.file.name} to the audio timeline`}
                  className="shrink-0 border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to timeline
                </button>
              )}
              <button
                type="button"
                onClick={() => item.kind === 'audio' ? removeAudio(item.id) : removeVisualAsset(item.id)}
                disabled={isExporting || isImportingVisuals || isProjectPackageBusy}
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
        {approvedProductionLinks
          ? <a className="flex items-center gap-3 text-sm font-bold tracking-wide text-ink no-underline" href={approvedProductionLinks.home} aria-label="Stillwave home">
            <span className="grid h-8 w-8 place-items-center bg-moss text-lime" aria-hidden="true">S</span> STILLWAVE
          </a>
          : <span className="flex items-center gap-3 text-sm font-bold tracking-wide text-ink" aria-label="Stillwave">
          <span className="grid h-8 w-8 place-items-center bg-moss text-lime" aria-hidden="true">S</span> STILLWAVE
          </span>}
        <span className="text-xs text-neutral-500">SOCIAL VIDEO STUDIO</span>
        {approvedProductionLinks && <a className="bg-moss px-3 py-2 text-xs font-semibold text-white no-underline" href={approvedProductionLinks.cta.destination}>{approvedProductionLinks.cta.label}</a>}
      </header>
      <section aria-label="Project management" className="mx-auto border-b border-neutral-200 bg-white/60 px-5 py-4 md:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-3">
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
            <div className="flex flex-wrap items-center gap-3">
              <label className="block min-w-0 flex-1 text-xs font-medium text-neutral-600">
                Saved projects
                <select
                  className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm text-ink"
                  aria-label="Saved projects"
                  value={projectToOpen}
                  onChange={(event) => setProjectToOpen(event.target.value)}
                  disabled={!projectList.length || isExporting || isImportingVisuals || isProjectPackageBusy}
                >
                  {!projectList.length && <option value="">No saved projects yet</option>}
                  {projectList.map((project) => <option key={project.id} value={project.id}>{project.name}{project.problem ? ' · needs attention' : ''}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleOpenProject()}
                disabled={!projectToOpen || isExporting || isImportingVisuals || isProjectPackageBusy}
                className="self-end border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open selected
              </button>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                {projectStatusLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end">
            <button type="button" onClick={() => void handleSaveProject()} disabled={isExporting || isImportingVisuals || isProjectPackageBusy || !isProjectStorageReady} className="bg-moss px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40">Save</button>
            <div className="relative">
              <button
                ref={projectMenuButtonRef}
                type="button"
                aria-label="Open project menu"
                aria-haspopup="true"
                aria-controls="project-actions-menu"
                aria-expanded={isProjectMenuOpen}
                onClick={() => setIsProjectMenuOpen((open) => !open)}
                className="grid h-10 w-10 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                  <circle cx="12" cy="5.5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18.5" r="1.5" />
                </svg>
              </button>
              {isProjectMenuOpen && (
                <div id="project-actions-menu" ref={projectMenuRef} className="project-menu-enter absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
                  {menuGroups.map((group, index) => (
                    <div key={group.label}>
                      <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{group.label}</div>
                      <div className="px-1 pb-1">
                        {group.items.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              if (!item.disabled) {
                                item.onClick();
                                setIsProjectMenuOpen(false);
                              }
                            }}
                            disabled={item.disabled}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
                          >
                            <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-xs text-neutral-500">{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                      {index < menuGroups.length - 1 && <div className="mx-2 h-px bg-neutral-200" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-[1500px]">
          <p role="status" aria-live="polite" className="text-xs text-neutral-600">{projectStorageStatus}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Your projects are saved in this browser.</p>
        </div>
        <input
          ref={projectPackageInputRef}
          className="sr-only"
          type="file"
          accept=".stillwave.json,.json,application/json"
          aria-label="Choose a portable project file"
          onChange={(event) => void handleImportProjectFile(event.target.files?.[0])}
        />
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
          <p className="w-full text-xs font-medium text-neutral-500 sm:hidden">Step {step} of 3 · {steps[step - 1]}</p>
        </div>

        {step === 1 && <section className="mx-auto max-w-2xl border-t border-neutral-200 py-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold">Add audio tracks</h2>
            <p className="mt-2 text-sm text-neutral-500">Add one or more soundtrack, music, or voice tracks. You can arrange and mix them independently in the editor.</p>
          </div>
          <AudioUploader onFilesSelect={(files) => void handleAudioSelect(files)} fileName={audioMeta.fileName} fileSize={audioMeta.fileSize} detectedType={audioMeta.detectedType} duration={primaryAudio?.duration ?? 0} />
          <p className="mt-2 text-xs text-neutral-500">A listed filename extension does not guarantee that this browser can decode the file.</p>
          {audioAssets.map((asset) => <div key={asset.id} className="mt-3 flex items-center justify-between gap-3 border-b border-neutral-200 py-3 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{asset.file.name}</p><p className="mt-1 text-xs text-neutral-500">{formatDuration(asset.duration)} · {formatFileSize(asset.file.size)} · {audioClips.filter((clip) => clip.assetId === asset.id).length} clip{audioClips.filter((clip) => clip.assetId === asset.id).length === 1 ? '' : 's'}</p></div>
            <button type="button" className="shrink-0 text-xs font-medium text-red-800 underline underline-offset-4" onClick={() => removeAudio(asset.id)}>Remove</button>
          </div>)}
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

        {step === 3 && <section className="space-y-6 border-t border-neutral-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 ref={editorHeadingRef} tabIndex={-1} className="text-xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss">Edit &amp; export</h2><p className="mt-1 text-sm text-neutral-500">{audioTracks.length} audio track{audioTracks.length === 1 ? '' : 's'} · {formatDuration(sequenceDuration)} sequence</p></div>
            <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="h-2 w-2 rounded-full bg-lime-500" />{projectStorageStatus.startsWith('Saved') ? 'Autosaved locally' : 'Local autosave enabled'}</div>
          </div>
          <aside className="border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700" aria-label="Quick start editing guide">
            <span className="font-semibold">Quick start:</span> Select a clip in the timeline to adjust its timing and framing. Add titles in the Inspector, preview your sequence, then render your video.
          </aside>
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
            <div ref={previewContainerRef} className="preview-workspace min-w-0">
              <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-neutral-800 bg-[#101613] p-3 sm:min-h-[340px] sm:p-5 xl:min-h-[420px]">
                <CompositionPreview
                  assets={assets}
                  tracks={tracks}
                  clips={clips}
                  titles={titles}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  seekRevision={previewSeekRevision}
                  width={width}
                  height={height}
                  className="preview-frame"
                  style={{ width: `min(100%, ${(58 * width) / height}vh)`, aspectRatio: `${width} / ${height}` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                <button type="button" onClick={playPause} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm text-white transition hover:bg-moss" aria-label={isPlaying ? 'Pause preview' : 'Play preview'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
                <div className="flex min-w-[180px] flex-1 items-center gap-2 text-[11px] tabular-nums text-neutral-500">
                  <span className="shrink-0">{formatDuration(clampTimelineTime(currentTime, sequenceDuration))}</span>
                  <input aria-label="Preview playback position" type="range" min="0" max={Math.max(sequenceDuration, 0.1)} step="0.1" value={clampTimelineTime(currentTime, sequenceDuration)} onChange={(event) => { const time = clampTimelineTime(Number(event.target.value), sequenceDuration); playbackTimeRef.current = time; setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(time); }} className="min-w-0 flex-1 accent-moss" />
                  <span className="shrink-0">{formatDuration(sequenceDuration)}</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-500" aria-label="Preview volume">
                  <span aria-hidden="true">◖</span>
                  <input aria-label="Preview volume" type="range" min="0" max="1" step="0.05" value={previewVolume} onChange={(event) => setPreviewVolume(Number(event.target.value))} className="w-20 accent-moss" />
                </label>
                <button type="button" onClick={() => void togglePreviewFullscreen()} className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-ink" aria-label="Toggle preview fullscreen" title="Toggle fullscreen">⛶</button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-moss/30 bg-lime/20 p-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!selectedClip || selectedTrack?.locked || currentTime <= (selectedClip?.timelinePosition ?? 0) || currentTime >= (selectedClip ? selectedClip.timelinePosition + getClipDuration(selectedClip) : 0)}
                  onClick={() => selectedClip && handleSplit(selectedClip.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-lime/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 7.5 12 12M8 16.5l5-5m3-3 4-4" /></svg>
                  Split at playhead
                </button>
                <button
                  type="button"
                  disabled={!selectedClip || selectedTrack?.locked}
                  onClick={() => selectedClip && duplicateClip(selectedClip.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-lime/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
                  Duplicate clip
                </button>
                <button
                  type="button"
                  disabled={!selectedClip || selectedTrack?.locked}
                  onClick={() => selectedClip && removeClip(selectedClip.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
                  Remove clip
                </button>
              </div>
            </div>
            <aside className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-semibold">Inspector</h3>
                <p className="mt-1 truncate text-xs text-neutral-500">{platformPresets.find((item) => item.id === presetId)?.platform ?? 'Custom'} · {width} × {height}</p>
              </div>
              <div className="divide-y divide-neutral-200 px-4">
                <details open className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">Title properties</summary>
                  <div className="mt-3">
                    <TitleOverlayEditor titles={titles} selectedTitleId={selectedTitleId} onAdd={addTitle} onSelect={setSelectedTitleId} onChange={updateTitle} onEndEditCoalescing={endEditCoalescing} onRemove={removeTitle} />
                  </div>
                </details>
                <details className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">Platform &amp; placement</summary>
                  <label className="mt-2 block text-[11px] font-medium text-neutral-500">Aspect ratio and resolution
                    <select className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs text-ink" value={presetId} onChange={(event) => updateOutputSettings({ presetId: event.target.value })}>
                      {platformPresets.map((item) => <option key={item.id} value={item.id}>{item.platform} · {item.placement} ({item.width} × {item.height})</option>)}
                    </select>
                  </label>
                  {presetId === 'custom' && <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-medium text-neutral-500">Width<input className="mt-1 w-full rounded-md border border-neutral-200 px-2.5 py-2 text-xs font-normal text-ink" type="number" min="144" max="3840" step="2" value={customWidth} onChange={(event) => updateOutputSettings({ customWidth: Math.max(144, Number(event.target.value)) })} /></label>
                    <label className="text-[11px] font-medium text-neutral-500">Height<input className="mt-1 w-full rounded-md border border-neutral-200 px-2.5 py-2 text-xs font-normal text-ink" type="number" min="144" max="3840" step="2" value={customHeight} onChange={(event) => updateOutputSettings({ customHeight: Math.max(144, Number(event.target.value)) })} /></label>
                  </div>}
                </details>
                <details className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">Export settings</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-medium text-neutral-500">File format<select className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal text-ink" value={format} onChange={(event) => updateOutputSettings({ format: event.target.value })}><option disabled={!availableExportFormats.includes('MP4')}>MP4{availableExportFormats.includes('MP4') ? '' : ' — unavailable in this browser'}</option><option disabled={!availableExportFormats.includes('WebM')}>WebM{availableExportFormats.includes('WebM') ? '' : ' — unavailable in this browser'}</option></select></label>
                    <label className="text-[11px] font-medium text-neutral-500">Frame rate<select className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal text-ink" value={frameRate} onChange={(event) => updateOutputSettings({ frameRate: Number(event.target.value) })}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                    Browser-reported recording formats: {availableExportFormats.length ? availableExportFormats.join(', ') : 'none'}.
                    {' '}Media decoding or rendering may still fail when you create the video.
                  </p>
                </details>
                <details className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">
                    <span>Canvas &amp; sequence</span>
                    <span className="ml-auto mr-2 text-[10px] font-normal tabular-nums text-neutral-400">{width} × {height} · {formatDuration(sequenceDuration)}</span>
                  </summary>
                  <dl className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Canvas dimensions</dt><dd className="font-medium tabular-nums text-ink">{width} × {height}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Sequence duration</dt><dd className="font-medium tabular-nums text-ink">{formatDuration(sequenceDuration)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Audio tracks</dt><dd className="font-medium tabular-nums text-ink">{audioTracks.length}</dd></div>
                  </dl>
                  <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">Platform dimensions are starting presets. Check current platform requirements before publishing.</p>
                </details>
                <details className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">
                    <span>Timeline tools</span>
                    <span className="ml-auto mr-2 text-[10px] font-normal text-neutral-400">{timelinePixelsPerSecond}px/s · Snap {snapTimelineEnabled ? 'on' : 'off'} · {tracks.length} track{tracks.length === 1 ? '' : 's'}</span>
                  </summary>
                  <div className="mt-2 space-y-3">
                    <label className="block text-[11px] font-medium text-neutral-500" htmlFor="timeline-zoom">Timeline zoom <span className="ml-1 tabular-nums text-neutral-400">{timelinePixelsPerSecond}px/s</span></label>
                    <input id="timeline-zoom" type="range" min="24" max="120" step="4" value={timelinePixelsPerSecond} onChange={(event) => setTimelinePixelsPerSecond(Number(event.target.value))} className="w-full accent-moss" />
                    <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-600">
                      <span>Snap clip positions to 0.1s</span>
                      <input type="checkbox" checked={snapTimelineEnabled} onChange={(event) => setSnapTimelineEnabled(event.target.checked)} aria-label="Snap clip drag positions to 0.1-second increments" />
                    </label>
                    <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
                      <span className="text-[11px] text-neutral-500">{tracks.length} video · {audioTracks.length} audio tracks</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={addTrack} className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50">+ Video track</button>
                        <button type="button" onClick={addAudioTrack} className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-950 transition hover:bg-sky-100">+ Audio track</button>
                      </div>
                    </div>
                  </div>
                </details>
                <details className="inspector-section py-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-700 marker:hidden">Media library <span className="ml-1 font-normal text-neutral-400">{libraryItems.length}</span></summary>
                  <div className="mt-3">{mediaLibrary}</div>
                </details>
              </div>
            </aside>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3 sm:p-4">
            <TimelineEditor
              assets={assets}
              tracks={tracks}
              clips={clips}
              titles={titles}
              markers={markers}
              selectedTitleId={selectedTitleId}
              selectedClipId={selectedClipId}
              selectedAudioClipId={selectedAudioClip?.id ?? ''}
              audioAssets={audioAssets}
              audioTracks={audioTracks}
              audioClips={audioClips}
              currentTime={currentTime}
              soundtrackDuration={audioDuration}
              pixelsPerSecond={timelinePixelsPerSecond}
              snapEnabled={snapTimelineEnabled}
              onSeek={(time) => { const playableTime = clampTimelineTime(time, sequenceDuration); playbackTimeRef.current = playableTime; setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(playableTime); }}
              onTrackChange={updateTrack}
              onAudioTrackChange={updateAudioTrack}
              onAddAudioTrack={addAudioTrack}
              onDuplicateAudioTrack={duplicateAudioTrack}
              onRemoveAudioTrack={removeAudioTrack}
              onMoveClip={moveClipToTrack}
              onMoveAudioClip={moveAudioClip}
              onSelectAudioClip={setSelectedAudioClipId}
              onAudioClipChange={updateAudioClip}
              onDuplicateAudioClip={duplicateAudioClip}
              onRemoveAudioClip={removeAudioClip}
              onSelect={setSelectedClipId}
              onChange={updateClip}
              onTransform={updateTransform}
              onEndEditCoalescing={endEditCoalescing}
              onRemove={removeClip}
              onSplit={handleSplit}
              onDuplicate={duplicateClip}
              onSelectTitle={setSelectedTitleId}
              onTitleChange={updateTitle}
              onSeekTitle={(time) => { const playableTime = clampTimelineTime(time, sequenceDuration); playbackTimeRef.current = playableTime; setPreviewSeekRevision((revision) => revision + 1); setCurrentTime(playableTime); }}
              onAddMarker={addMarker}
              onRenameMarker={renameMarker}
              onRemoveMarker={removeMarker}
            />
          </div>
          {visualCoverage.uncoveredIntervals.length > 0 && <p id="visual-coverage-warning" role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-neutral-700">
            Visual coverage warning: {visualCoverage.uncoveredDuration.toFixed(2)} seconds of soundtrack have no visible clips across {visualCoverage.uncoveredIntervals.length} {visualCoverage.uncoveredIntervals.length === 1 ? 'gap' : 'gaps'}.
            {' '}Preview the full soundtrack and move, add, or extend visible clips to fill gaps before rendering. Timing is not changed automatically.
          </p>}
          {exportComplete && <section aria-label="Render complete" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-moss/30 bg-lime/20 p-4">
            <div>
              <p role="status" className="text-sm font-semibold text-ink">Last render completed. Any further edits need a new render.</p>
              <p className="mt-1 text-xs text-neutral-600">Enjoyed creating your video? You can support the creator with a coffee. Completely optional.</p>
            </div>
            <a
              href="https://buymeacoffee.com/alexmano12"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-moss bg-white px-4 py-2 text-sm font-semibold text-moss transition hover:bg-lime/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 0h2a3 3 0 0 1 0 6h-2M3 22h15M7 2v3m5-3v3" /></svg>
              Buy me a coffee
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </section>}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-5">
            <button type="button" onClick={() => setStep(2)} className="px-1 py-3 text-sm text-neutral-600">← Back to visuals</button>
            <div className="flex flex-wrap items-center gap-4">
              {statusMessage && !isExporting && <p role="status" className="max-w-sm text-right text-xs text-neutral-600">{statusMessage}</p>}
              {exportComplete && <>
                <button type="button" onClick={() => {
                  setExportComplete(false);
                  setStatusMessage('');
                  editorHeadingRef.current?.focus();
                }} className="border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700">Continue editing</button>
                <button type="button" onClick={() => void startNewVideo()} className="border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700">Start new project</button>
              </>}
              <button
                ref={exportButtonRef}
                type="button"
                onClick={() => void handleExport()}
                disabled={!clips.length || isExporting || isImportingVisuals || isProjectPackageBusy}
                aria-describedby={[
                  visualCoverage.uncoveredIntervals.length > 0 ? 'visual-coverage-warning' : '',
                ].filter(Boolean).join(' ') || undefined}
                className="bg-moss px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exportComplete ? 'Render revised video' : 'Render video'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>}
      </main>
      <AudioTimelinePlayback
        assets={audioAssets}
        tracks={audioTracks}
        clips={audioClips}
        currentTime={currentTime}
        isPlaying={isPlaying}
        seekRevision={previewSeekRevision}
        volume={previewVolume}
        onPlaybackError={(message) => {
          setIsPlaying(false);
          setStatusMessage(message);
        }}
      />
      {isExporting && <ExportProgress
        progress={exportProgress}
        isExporting
        statusMessage={statusMessage}
        onCancel={() => {
          setStatusMessage('Canceling export…');
          exportAbortControllerRef.current?.abort();
        }}
      />}
    </div>
  );
}

export default App;
