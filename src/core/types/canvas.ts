export type CanvasItemType = 'text' | 'image' | 'video' | 'shape' | 'stroke' | 'effect' | 'path';
export type ShapeType = 'rect' | 'circle' | 'triangle' | 'star' | 'diamond' | 'polygon';
export type EffectType = 'glow' | 'shadow' | 'blur' | 'vignette';
export type CanvasEffectType = 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'background-blur' | 'noise';

export type TextResizingMode = 'auto-width' | 'auto-height' | 'fixed' | 'shrink-to-fit';
export type TextAlignHorizontal = 'left' | 'center' | 'right' | 'justify';
export type TextAlignVertical = 'top' | 'middle' | 'bottom';
export type TextCaseStyle = 'none' | 'uppercase' | 'lowercase' | 'titlecase';
export type UnderlineStyle = 'straight' | 'wavy';
export type UnderlineDecorationSkip = 'none' | 'ink';

export type ListType = 'none' | 'disc' | 'circle' | 'square' | 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

import { IStyleLayer } from './style';

export interface ICanvasItemText {
  content: string;

  // Base Typography
  fontFamily: string;
  fontWeight: string | number;
  fontSize: number; // px relative to slide (base size before shrink-to-fit)
  color?: string; // Legacy/fallback color, should use textFills ideally

  resizingMode: TextResizingMode;

  // Formatting
  isBold?: boolean;
  isItalic?: boolean;
  isStrikethrough?: boolean;
  textCase?: TextCaseStyle;

  // Sub/Super script
  scriptStyle?: 'none' | 'subscript' | 'superscript';

  // Underline
  isUnderline?: boolean;
  underlineStyle?: UnderlineStyle;
  underlineSkipInk?: UnderlineDecorationSkip;

  // Spacing & Layout
  lineHeight?: number | string;
  letterSpacing?: number | string;
  paragraphSpacing?: number;

  // Alignment
  alignHorizontal: TextAlignHorizontal;
  alignVertical: TextAlignVertical;
  textAlign?: 'left' | 'center' | 'right'; // Legacy fallback

  listType?: ListType;

  // Fills & Strokes applying specifically to the text characters
  textFills?: IStyleLayer[];
  textStrokes?: IStyleLayer[];
}

export type LineCapType = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond';

export interface ICanvasItemShape {
  shapeType: ShapeType;
  // Star geometry
  starPoints?: number; // 3..60, default 5
  starRatio?: number; // 0.05..0.95, default 0.382
  starInnerRadius?: number; // inner corner fillet (0..50)
  starOuterRadius?: number; // global outer fillet (0..50)
  starOuterRadii?: number[]; // per-ray outer fillets
  // Polygon geometry
  polygonSides?: number; // 3..60, default 3 for triangle, 5 or 6 for polygon
  polygonCornerRadius?: number; // global corner fillet (0..50)
  polygonCornerRadii?: number[]; // per-vertex corner fillets
  // Arc / Donut / Sector geometry
  innerRadius?: number; // 0..0.99 (0 = solid/pie, >0 = donut/ring)
  arcStart?: number; // 0..360 degrees, default 0
  arcSweep?: number; // 0..360 degrees, default 360
  sectorCount?: number; // 1..60, default 1
  sectorGap?: number; // gap between sectors in degrees (0..30)
  sectorWeights?: number[]; // optional relative sector weights
  cornerSmoothing?: number; // 0..1 (0 = standard circle, 0.6 = Apple squircle, 1 = maximum G2)
}

export interface ICanvasItemStroke {
  x2: number;  // end x %
  y2: number;  // end y %
  color: string;
  width: number;
  dashArray?: string;
  startCap?: LineCapType;
  endCap?: LineCapType;
}

export interface ICanvasItemEffect {
  effectType: EffectType;
  color: string;
  intensity: number;
}

export interface IVectorPoint {
  x: number; // 0-100% relative to bounding box
  y: number; // 0-100% relative to bounding box
}

export interface IVectorNode {
  id: string;
  x: number; // 0-100%
  y: number; // 0-100%
  handleIn?: IVectorPoint;
  handleOut?: IVectorPoint;
  isCorner?: boolean; // false = smooth with handles, true = sharp corner
}

export interface ICanvasItemPath {
  nodes: IVectorNode[];
  isClosed: boolean;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface ICanvasEffect {
  id: string;
  type: CanvasEffectType;
  visible: boolean;
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  noiseScale?: number;
  noiseSoftness?: number;
}

export interface IAutoLayoutConfig {
  enabled: boolean;
  direction: 'horizontal' | 'vertical';
  gap: number; // in pixels
  padding: number; // uniform padding fallback in pixels
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  align: 'start' | 'center' | 'end';
  counterAlign?: 'start' | 'center' | 'end';
  wrap?: boolean;
  isSpaceBetween?: boolean;
  hugContents?: boolean;
}

export interface ICanvasConstraints {
  horizontal: 'left' | 'right' | 'left-right' | 'center' | 'scale';
  vertical: 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';
}

export interface ICanvasItem {
  id: string;
  type: CanvasItemType;
  name?: string;
  // Position & size as percentages (0–100) of slide dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale?: number;
  opacity?: number;
  borderRadius?: number;
  borderRadiusTL?: number;
  borderRadiusTR?: number;
  borderRadiusBL?: number;
  borderRadiusBR?: number;
  lockBorderRadius?: boolean;
  fills: IStyleLayer[];
  borderColor?: string;
  borderWidth?: number;
  strokeAlign?: 'inside' | 'center' | 'outside';
  strokeJoin?: 'round' | 'bevel' | 'miter';
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeDashArray?: string;
  strokes: IStyleLayer[];
  zIndex: number;
  locked: boolean;
  visible: boolean;
  groupId?: string; // Grouping ID for multi-item Figma-style groups
  isMask?: boolean; // When true, acts as a stencil/mask for higher zIndex layers in the group
  booleanOperation?: 'union' | 'subtract' | 'intersect' | 'exclude'; // Live non-destructive Boolean groups
  booleanRole?: 'base' | 'operator'; // Role inside live Boolean group
  autoLayout?: IAutoLayoutConfig; // Figma-style Auto Layout flex configuration
  isAbsoluteInLayout?: boolean; // When inside Auto Layout group, bypasses flex layout flow (Figma absolute positioning)
  constraints?: ICanvasConstraints; // Figma adaptive constraints: pin to left/right/both/center/scale
  isMasterComponent?: boolean; // Figma Master Symbol ❖
  masterComponentId?: string; // Instance link to Master Symbol
  componentOverrides?: Partial<ICanvasItem>; // Per-instance visual/textual overrides
  lockAspectRatio?: boolean;
  pivotX?: number; // 0-100%, default 50
  pivotY?: number; // 0-100%, default 50
  backdropBlur?: number;
  dropShadow?: { x: number; y: number; blur: number; color: string };
  effects?: ICanvasEffect[];
  // Type-specific data
  text?: ICanvasItemText;
  shape?: ICanvasItemShape;
  stroke?: ICanvasItemStroke;
  effect?: ICanvasItemEffect;
  path?: ICanvasItemPath;
  // Media references for image/video canvas items
  image?: { id: string; url?: string; name?: string; isFromDb?: boolean };
  video?: { id: string; url?: string; name?: string; isFromDb?: boolean };
}

export type ICanvasStyleSnapshot = Partial<Pick<
  ICanvasItem,
  | 'fills'
  | 'strokes'
  | 'borderColor'
  | 'borderWidth'
  | 'strokeAlign'
  | 'strokeJoin'
  | 'strokeLinecap'
  | 'strokeDashArray'
  | 'opacity'
  | 'borderRadius'
  | 'borderRadiusTL'
  | 'borderRadiusTR'
  | 'borderRadiusBL'
  | 'borderRadiusBR'
  | 'lockBorderRadius'
  | 'backdropBlur'
  | 'dropShadow'
  | 'effects'
  | 'text'
  | 'shape'
>>;

export interface ICustomGuide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  positionPct: number;
}

export interface ShapePresetBakedFlags {
  geometry: boolean;
  radii: boolean;
  fills: boolean;
  strokes: boolean;
  effects: boolean;
  dimensions: boolean;
  position: boolean;
}

export interface IShapePreset {
  id: string;
  name: string;
  shapeType: ShapeType;
  category: 'factory' | 'user';
  previewPath?: string;
  shapeData: Partial<ICanvasItemShape>;
  bakedFlags: ShapePresetBakedFlags;
  fills?: ICanvasItem['fills'];
  strokes?: ICanvasItem['strokes'];
  effects?: ICanvasItem['effects'];
  borderWidth?: number;
  borderColor?: string;
  strokeAlign?: ICanvasItem['strokeAlign'];
  strokeJoin?: ICanvasItem['strokeJoin'];
  strokeDashArray?: string;
  opacity?: number;
  borderRadius?: number;
  borderRadiusTL?: number;
  borderRadiusTR?: number;
  borderRadiusBR?: number;
  borderRadiusBL?: number;
  lockBorderRadius?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  pivotX?: number;
  pivotY?: number;
  createdAt?: number;
}
