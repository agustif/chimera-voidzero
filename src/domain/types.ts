export type FontFamilyMode = 'serif' | 'sans' | 'mono';
export type HeroCase = 'upper' | 'title' | 'sentence';
export type ButtonMode = 'solid' | 'outline' | 'tint';
export type DensityMode = 'airy' | 'balanced' | 'dense';

export type DiscreteTheme = {
  fontFamily: FontFamilyMode;
  heroCase: HeroCase;
  buttonStyle: ButtonMode;
  density: DensityMode;
};

export type ThemeTokens = {
  background: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accent2: string;
  heroGradientA: string;
  heroGradientB: string;
  heroSize: number;
  titleSize: number;
  bodySize: number;
  heroWeight: number;
  titleWeight: number;
  bodyWeight: number;
  tracking: number;
  radius: number;
  borderWidth: number;
  shadowY: number;
  shadowBlur: number;
  shadowAlpha: number;
  pageWidth: number;
  gap: number;
  pad: number;
  cardPad: number;
  lineHeight: number;
};

export type BlendPoint = {
  x: number;
  y: number;
};

export type InspirationFingerprint = {
  editorial: number;
  product: number;
  warmth: number;
  energy: number;
  precision: number;
  density: number;
};

export type InspirationTarget = {
  id: string;
  name: string;
  blurb: string;
  swatches: [string, string];
  discrete: DiscreteTheme;
  tokens: ThemeTokens;
  fingerprint: InspirationFingerprint;
  position: BlendPoint;
};

export type BlendControls = {
  contrastGuard: boolean;
  blendSharpness: number;
  snapStrength: number;
  activeCount: number;
};

export type DerivedTheme = {
  tokens: ThemeTokens;
  discrete: DiscreteTheme;
  dominantTargetId: string;
  contrast: number;
  weights: Array<{ id: string; name: string; weight: number }>;
};

export type SavedBlendState = {
  id: string;
  label: string;
  seed: string;
  activeIds: string[];
  point: BlendPoint;
  savedAt: string;
  derived: ThemeTokens;
};

export type AppState = {
  seed: string;
  activeIds: string[];
  pinnedIds: string[];
  point: BlendPoint;
  controls: BlendControls;
  selectedTargetId: string | null;
  savedStates: SavedBlendState[];
  status: string;
};
