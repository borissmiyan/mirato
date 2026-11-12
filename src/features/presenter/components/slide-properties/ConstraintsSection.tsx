import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import { PropertySection } from './PropertySection';
import { ICanvasItem, ICanvasConstraints } from '@/core/types';
import { cn } from '@/core/utils/cn';

interface ConstraintsSectionProps {
  baseItem: ICanvasItem;
  onChange: (patch: Partial<ICanvasItem>) => void;
}

export const ConstraintsSection: React.FC<ConstraintsSectionProps> = ({
  baseItem,
  onChange,
}) => {
  const { t } = useTranslation();

  const constraints: ICanvasConstraints = useMemo(() => {
    return baseItem.constraints || {
      horizontal: 'left',
      vertical: 'top',
    };
  }, [baseItem.constraints]);

  const updateHorizontal = useCallback((val: ICanvasConstraints['horizontal']) => {
    onChange({
      constraints: {
        ...constraints,
        horizontal: val,
      },
    });
  }, [constraints, onChange]);

  const updateVertical = useCallback((val: ICanvasConstraints['vertical']) => {
    onChange({
      constraints: {
        ...constraints,
        vertical: val,
      },
    });
  }, [constraints, onChange]);

  return (
    <PropertySection
      title={t('constraints', 'Constraints')}
      icon={Pin}
    >
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-3">
          {/* Visual 2-Axis Figma Pinning Widget */}
          <div className="relative w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            {/* Top Pin */}
            <button
              type="button"
              onClick={() => updateVertical(constraints.vertical === 'top' ? 'scale' : 'top')}
              className={cn(
                "absolute top-1 inset-x-4 h-1.5 rounded-full transition-all cursor-pointer",
                (constraints.vertical === 'top' || constraints.vertical === 'top-bottom')
                  ? "bg-accent shadow-xs"
                  : "bg-white/10 hover:bg-white/20"
              )}
              title="Pin Top"
            />
            {/* Bottom Pin */}
            <button
              type="button"
              onClick={() => updateVertical(constraints.vertical === 'bottom' ? 'scale' : 'bottom')}
              className={cn(
                "absolute bottom-1 inset-x-4 h-1.5 rounded-full transition-all cursor-pointer",
                (constraints.vertical === 'bottom' || constraints.vertical === 'top-bottom')
                  ? "bg-accent shadow-xs"
                  : "bg-white/10 hover:bg-white/20"
              )}
              title="Pin Bottom"
            />
            {/* Left Pin */}
            <button
              type="button"
              onClick={() => updateHorizontal(constraints.horizontal === 'left' ? 'scale' : 'left')}
              className={cn(
                "absolute left-1 inset-y-4 w-1.5 rounded-full transition-all cursor-pointer",
                (constraints.horizontal === 'left' || constraints.horizontal === 'left-right')
                  ? "bg-accent shadow-xs"
                  : "bg-white/10 hover:bg-white/20"
              )}
              title="Pin Left"
            />
            {/* Right Pin */}
            <button
              type="button"
              onClick={() => updateHorizontal(constraints.horizontal === 'right' ? 'scale' : 'right')}
              className={cn(
                "absolute right-1 inset-y-4 w-1.5 rounded-full transition-all cursor-pointer",
                (constraints.horizontal === 'right' || constraints.horizontal === 'left-right')
                  ? "bg-accent shadow-xs"
                  : "bg-white/10 hover:bg-white/20"
              )}
              title="Pin Right"
            />
            {/* Center Box */}
            <div className="w-6 h-6 rounded bg-white/15 border border-white/20 flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          </div>

          {/* Horizontal & Vertical Selectors */}
          <div className="flex-1 space-y-2">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-400 block mb-1">
                {t('horizontal', 'Горизонталь')}
              </span>
              <select
                value={constraints.horizontal}
                onChange={(e) => updateHorizontal(e.target.value as ICanvasConstraints['horizontal'])}
                className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-stone-200 outline-none focus:border-accent/50 cursor-pointer"
              >
                <option value="left" className="bg-stone-900 text-stone-200">Left (Слева)</option>
                <option value="right" className="bg-stone-900 text-stone-200">Right (Справа)</option>
                <option value="left-right" className="bg-stone-900 text-stone-200">Left & Right (Растягивать)</option>
                <option value="center" className="bg-stone-900 text-stone-200">Center (По центру)</option>
                <option value="scale" className="bg-stone-900 text-stone-200">Scale (Масштабировать)</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-400 block mb-1">
                {t('vertical', 'Вертикаль')}
              </span>
              <select
                value={constraints.vertical}
                onChange={(e) => updateVertical(e.target.value as ICanvasConstraints['vertical'])}
                className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-stone-200 outline-none focus:border-accent/50 cursor-pointer"
              >
                <option value="top" className="bg-stone-900 text-stone-200">Top (Сверху)</option>
                <option value="bottom" className="bg-stone-900 text-stone-200">Bottom (Снизу)</option>
                <option value="top-bottom" className="bg-stone-900 text-stone-200">Top & Bottom (Растягивать)</option>
                <option value="center" className="bg-stone-900 text-stone-200">Center (По центру)</option>
                <option value="scale" className="bg-stone-900 text-stone-200">Scale (Масштабировать)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </PropertySection>
  );
};

