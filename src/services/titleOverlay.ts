export const TITLE_FONT_FAMILIES = ['sans-serif', 'serif', 'monospace'] as const;
export type TitleFontFamily = typeof TITLE_FONT_FAMILIES[number];
export type TitleAlignment = 'left' | 'center' | 'right';

/**
 * A static title rendered over the composition for an absolute timeline range.
 * Position is the center anchor in percentages of the output frame. Font size
 * is a percentage of output height, so it scales consistently in preview/export.
 */
export type TitleOverlay = {
  id: string;
  text: string;
  start: number;
  duration: number;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 400 | 700;
  fontFamily: TitleFontFamily;
  color: string;
  align: TitleAlignment;
  background: string | null;
  shadow: boolean;
};

export type MappedTitle = {
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
};

const SYSTEM_FONT_STACKS: Record<TitleFontFamily, string> = {
  'sans-serif': 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: '"Courier New", Courier, monospace',
};

export function getActiveTitles(titles: TitleOverlay[], time: number): TitleOverlay[] {
  if (!Number.isFinite(time)) return [];
  return titles.filter((title) => time >= title.start && time < title.start + title.duration);
}

/** Map output-relative title values into export pixel coordinates. */
export function mapTitleToOutput(title: TitleOverlay, width: number, height: number): MappedTitle {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  return {
    x: (title.x / 100) * safeWidth,
    y: (title.y / 100) * safeHeight,
    fontSize: (title.fontSize / 100) * safeHeight,
    fontFamily: SYSTEM_FONT_STACKS[title.fontFamily],
  };
}

export function createDefaultTitle(id: string, start = 0): TitleOverlay {
  const safeStart = Number.isFinite(start) ? Math.max(0, Math.min(86_397, start)) : 0;
  return {
    id,
    text: 'Your title',
    start: safeStart,
    duration: 3,
    x: 50,
    y: 80,
    fontSize: 5,
    fontWeight: 700,
    fontFamily: 'sans-serif',
    color: '#FFFFFF',
    align: 'center',
    background: null,
    shadow: true,
  };
}
