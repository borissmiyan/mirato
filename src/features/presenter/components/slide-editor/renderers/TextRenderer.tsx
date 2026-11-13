import React from 'react';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';
import { getComputedColor } from '@/core/utils/blendEngine';
import { needsFauxBold } from '@/core/services/fontService';
import { useRichTextBackground } from '../hooks/useRichTextBackground';

interface TextRendererProps {
  item: ICanvasItem;
  containerRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLDivElement | null>;
  fittedFontSize: number;
  activeFontFamily: string;
  activeFontWeight: string | number;
  isEditing: boolean;
  idPrefix: string;
}

interface TextRendererContentProps extends TextRendererProps {
  textData: NonNullable<ICanvasItem['text']>;
}

const TextRendererContent: React.FC<TextRendererContentProps> = ({
  item,
  textData,
  containerRef,
  textRef,
  fittedFontSize,
  activeFontFamily,
  activeFontWeight,
  isEditing,
  idPrefix,
}) => {
  const isAutoWidthText = textData.resizingMode === 'auto-width';
  const isAutoHeightText = textData.resizingMode === 'auto-height';
  const isFlowText = isAutoWidthText || isAutoHeightText;

  const fills = React.useMemo(() => {
    const rawFills = textData.textFills || [];
    if (rawFills.length > 0) return rawFills;
    if (textData.color) {
      return [{
        id: `legacy-color-${item.id}`,
        type: 'color',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        color: textData.color,
        adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
      } as IStyleLayer];
    }
    return [];
  }, [textData.textFills, textData.color, item.id]);

  const textStrokes = React.useMemo(() => {
    return textData.textStrokes?.filter(s => s.visible !== false) || [];
  }, [textData.textStrokes]);

  const hasRichMedia = React.useMemo(() => fills.some(f => f.type !== 'color'), [fills]);
  const isRichTextFill = fills.length > 0 && hasRichMedia;
  const hasTextStrokes = textStrokes.length > 0;

  const finalColor = React.useMemo(() => {
    if (isRichTextFill || fills.length === 0) return 'transparent';
    return getComputedColor(fills, 'transparent');
  }, [fills, isRichTextFill]);

  // Robust Async CSS Mapping for Webkit clipping via hook
  const dynamicCSS = useRichTextBackground(fills);

  const hAlign = textData.alignHorizontal || textData.textAlign || 'center';
  const textAlignCss = hAlign === 'justify' ? 'justify' : hAlign;
  const vAlign = textData.alignVertical || 'middle';
  const alignItemsCss = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center';

  const commonTextStyle: React.CSSProperties = {
    fontFamily: activeFontFamily,
    fontSize: `${fittedFontSize}px`,
    fontWeight: activeFontWeight,
    lineHeight: textData.lineHeight || 1.3,
    letterSpacing: typeof textData.letterSpacing === 'number' ? `${textData.letterSpacing}px` : (parseFloat(textData.letterSpacing as string) || 0) + 'px',
    fontStyle: textData.isItalic ? 'italic' : 'normal',
    textDecorationLine: [
      textData.isStrikethrough ? 'line-through' : '',
      textData.isUnderline ? 'underline' : ''
    ].filter(Boolean).join(' ') || 'none',
    textTransform: (textData.textCase === 'titlecase' ? 'capitalize' : textData.textCase || 'none') as React.CSSProperties['textTransform'],
    textAlign: textAlignCss as React.CSSProperties['textAlign'],
    whiteSpace: isAutoWidthText ? 'pre' : 'pre-wrap',
    wordBreak: isAutoWidthText ? 'normal' : 'break-word',
    minWidth: isAutoWidthText ? '1ch' : undefined,
  };

  // Faux bold support matching InlineTextEditor
  const isFauxBold = needsFauxBold(textData.isBold, activeFontWeight);
  if (isFauxBold) {
    const shadowSize = Math.max(0.3, fittedFontSize * 0.015);
    commonTextStyle.textShadow = `0 0 ${shadowSize}px currentColor`;
    commonTextStyle.WebkitTextFillColor = 'currentColor'; // Ensure shadow color matches
    commonTextStyle.paintOrder = 'stroke fill';
  }

  const listClasses = cn(
    '[&_ul]:list-inside [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2',
    textData.listType === 'circle' ? '[&_ul]:list-[circle]' :
    textData.listType === 'square' ? '[&_ul]:list-[square]' :
    '[&_ul]:list-disc',
    textData.listType === 'lower-alpha' ? '[&_ol]:list-[lower-alpha]' :
    textData.listType === 'upper-alpha' ? '[&_ol]:list-[upper-alpha]' :
    textData.listType === 'lower-roman' ? '[&_ol]:list-[lower-roman]' :
    textData.listType === 'upper-roman' ? '[&_ol]:list-[upper-roman]' :
    '[&_ol]:list-decimal'
  );
  const sanitizedContent = sanitizeHtml(textData.content);
  const filteredStrokes = textStrokes.filter(s => s.visible !== false);

  let computedTextStyles: React.CSSProperties & Record<string, string | number | undefined> = { 
    ...commonTextStyle,
    '--list-style': textData.listType === 'circle' ? 'circle' :
                  textData.listType === 'square' ? 'square' :
                  textData.listType === 'lower-alpha' ? 'lower-alpha' :
                  textData.listType === 'upper-alpha' ? 'upper-alpha' :
                  textData.listType === 'lower-roman' ? 'lower-roman' :
                  textData.listType === 'upper-roman' ? 'upper-roman' :
                  textData.listType === 'decimal' ? 'decimal' : 'disc'
  };
  
  if (isRichTextFill && dynamicCSS) {
     computedTextStyles = { ...computedTextStyles, ...dynamicCSS };
  } else {
     computedTextStyles.color = finalColor;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative flex flex-col", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}
      style={{
        justifyContent: alignItemsCss,
        height: isFlowText ? undefined : '100%',
        minHeight: '1em',
        opacity: isEditing ? 0 : 1,
        isolation: 'isolate',
        overflow: 'visible',
      }}
    >
      <div className={cn("relative", isAutoWidthText ? "w-max" : "w-full")} style={{ overflow: 'visible' }}>
        {/* Stroke Layers pinned exactly to the text bounding height */}
        {hasTextStrokes && filteredStrokes.slice().reverse().map((stroke, idx) => {
          const baseWidth = stroke.width || item.borderWidth || 2;
          
          return (
             <div 
                key={stroke.id || idx}
                className={cn(isAutoWidthText ? '' : 'w-full', 'absolute inset-0 pointer-events-none stroke-layer-content')}
                style={{
                  ...computedTextStyles,
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                  WebkitTextStroke: `${baseWidth}px ${stroke.color || '#000000'}`,
                  paintOrder: 'fill stroke',
                  opacity: stroke.opacity ?? 1,
                  mixBlendMode: (stroke.blendMode || 'normal') as React.CSSProperties['mixBlendMode'],
                  zIndex: 0
                }}
                // audit-ignore: sanitized with DOMPurify
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
             />
          );
        })}

        {/* Main Text Layer */}
        <div
          className={cn(isAutoWidthText ? '' : 'w-full', 'relative z-10', isRichTextFill ? 'rich-media-text-fill' : '')}
          style={computedTextStyles}
          // audit-ignore: sanitized with DOMPurify
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

        {/* Strict override to force all dangerouslySet innerHTML spans to respect standard webkit transparency rendering */}
        {/* audit-ignore: Static CSS styling rule */}
        <style dangerouslySetInnerHTML={{ __html: `
          .stroke-layer-content * { 
            color: transparent !important; 
            -webkit-text-fill-color: transparent !important; 
            text-decoration: none !important; /* Hide underlines on stroke layers to prevent duplicate wavy lines */
          }
          .stroke-layer-content *::marker {
            color: transparent !important; /* Hide markers on stroke layers to prevent duplicate bullets */
          }
          ${isRichTextFill ? '.rich-media-text-fill * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' : ''}
          ul, ol { 
            margin-top: 0.5em !important; 
            margin-bottom: 0.5em !important; 
            padding-left: 1.5em !important; 
            list-style-position: outside !important;
            display: block !important;
          }
          ul { list-style-type: var(--list-style, disc) !important; }
          ol { list-style-type: var(--list-style, decimal) !important; }
          li { margin-bottom: 0.2em !important; display: list-item !important; }
          li::marker { 
            /* Ensure list markers are visible even when using background-clip: text */
            color: ${isRichTextFill ? 'white' : 'inherit'} !important; 
            -webkit-text-fill-color: ${isRichTextFill ? 'white' : 'inherit'} !important;
          }
        ` }} />
      </div>
    </div>
  );
};

export const TextRenderer: React.FC<TextRendererProps> = (props) => {
  if (!props.item.text) return null;
  return <TextRendererContent {...props} textData={props.item.text} />;
};
