import { voteDiscreteTheme } from './discreteVoting';
import type { BlendPoint, DerivedTheme, InspirationTarget, ThemeTokens } from './types';

const colorKeys: (keyof ThemeTokens)[] = [
  'background',
  'surface',
  'surface2',
  'text',
  'muted',
  'border',
  'accent',
  'accent2',
  'heroGradientA',
  'heroGradientB',
];

const numericKeys: (keyof ThemeTokens)[] = [
  'heroSize',
  'titleSize',
  'bodySize',
  'heroWeight',
  'titleWeight',
  'bodyWeight',
  'tracking',
  'radius',
  'borderWidth',
  'shadowY',
  'shadowBlur',
  'shadowAlpha',
  'pageWidth',
  'gap',
  'pad',
  'cardPad',
  'lineHeight',
];

const tokenShaping: Partial<Record<keyof ThemeTokens, number>> = {
  accent: 1.5,
  accent2: 1.35,
  heroGradientA: 1.15,
  heroGradientB: 1.1,
  radius: 1.6,
  shadowBlur: 1.8,
  shadowAlpha: 1.8,
  heroSize: 1.35,
  tracking: 1.6,
  gap: 1.4,
  cardPad: 1.25,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const compact = hex.replace('#', '');
  const expanded = compact.length === 3 ? compact.split('').map((char) => `${char}${char}`).join('') : compact;
  const value = Number.parseInt(expanded, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b]
  .map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0'))
  .join('')}`;

const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

export const contrastRatio = (foreground: string, background: string) => {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
};

const nearestTextColor = (background: string) =>
  contrastRatio('#111111', background) >= contrastRatio('#ffffff', background) ? '#111111' : '#ffffff';

const normalizeMap = (weights: Map<string, number>) => {
  const total = [...weights.values()].reduce((sum, value) => sum + value, 0) || 1;
  return new Map([...weights.entries()].map(([id, value]) => [id, value / total]));
};

const shapeWeights = (weights: Map<string, number>, exponent: number) =>
  normalizeMap(new Map([...weights.entries()].map(([id, value]) => [id, Math.pow(value, exponent)])));

const blendWeightMaps = (left: Map<string, number>, right: Map<string, number>, ratio: number) =>
  normalizeMap(new Map([...left.entries()].map(([id, value]) => [id, value * (1 - ratio) + (right.get(id) ?? 0) * ratio])));

const getDistanceWeights = (targets: InspirationTarget[], point: BlendPoint) => {
  const epsilon = 0.025;
  return normalizeMap(new Map(targets.map((target) => {
    const dx = point.x - target.position.x;
    const dy = point.y - target.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return [target.id, 1 / Math.max(distance, epsilon)];
  })));
};

const getSnappedWeights = (weights: Map<string, number>) => {
  const [winner] = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  return new Map([...weights.keys()].map((id) => [id, id === winner[0] ? 1 : 0]));
};

const weightedValue = <T extends number | string>(
  targets: InspirationTarget[],
  weights: Map<string, number>,
  key: keyof ThemeTokens,
) => {
  if (typeof targets[0].tokens[key] === 'number') {
    return targets.reduce((sum, target) => sum + (target.tokens[key] as number) * (weights.get(target.id) ?? 0), 0);
  }

  const mixed = targets.reduce((acc, target) => {
    const { r, g, b } = hexToRgb(target.tokens[key] as string);
    const weight = weights.get(target.id) ?? 0;
    return {
      r: acc.r + r * weight,
      g: acc.g + g * weight,
      b: acc.b + b * weight,
    };
  }, { r: 0, g: 0, b: 0 });

  return rgbToHex(mixed.r, mixed.g, mixed.b) as T;
};

const applyContrastGuard = (tokens: ThemeTokens) => {
  const next = { ...tokens };
  next.text = contrastRatio(next.text, next.background) >= 5.4 ? next.text : nearestTextColor(next.background);
  if (contrastRatio(next.text, next.surface) < 4.8) {
    next.text = nearestTextColor(next.surface);
  }
  if (contrastRatio(next.muted, next.background) < 3.3) {
    next.muted = next.text === '#111111' ? '#4d4d4d' : '#d7d7d7';
  }
  if (contrastRatio(next.accent, next.surface) < 2.5) {
    next.accent = contrastRatio('#111111', next.surface) > contrastRatio('#ffffff', next.surface) ? '#111111' : '#ffffff';
  }
  return next;
};

export const blendTheme = (input: {
  targets: InspirationTarget[];
  point: BlendPoint;
  blendSharpness: number;
  snapStrength: number;
  contrastGuard: boolean;
}): DerivedTheme => {
  const baseWeights = getDistanceWeights(input.targets, input.point);
  const sharpWeights = shapeWeights(baseWeights, input.blendSharpness);
  const effectiveWeights = blendWeightMaps(sharpWeights, getSnappedWeights(sharpWeights), input.snapStrength);
  const tokens = {} as ThemeTokens;

  for (const key of numericKeys) {
    const shaped = shapeWeights(effectiveWeights, tokenShaping[key] ?? 1);
    tokens[key] = weightedValue<number>(input.targets, shaped, key);
  }

  for (const key of colorKeys) {
    const shaped = shapeWeights(effectiveWeights, tokenShaping[key] ?? 1);
    tokens[key] = weightedValue<string>(input.targets, shaped, key);
  }

  const discrete = voteDiscreteTheme(effectiveWeights, input.targets, 0.58 - input.snapStrength * 0.3);
  const guarded = input.contrastGuard ? applyContrastGuard(tokens) : tokens;
  const [dominantTargetId] = [...effectiveWeights.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    tokens: guarded,
    discrete,
    dominantTargetId,
    contrast: contrastRatio(guarded.text, guarded.background),
    weights: input.targets
      .map((target) => ({ id: target.id, name: target.name, weight: effectiveWeights.get(target.id) ?? 0 }))
      .sort((a, b) => b.weight - a.weight),
  };
};
