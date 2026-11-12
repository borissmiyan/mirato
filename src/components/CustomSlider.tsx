import React from 'react';
import { Slider, SliderProps } from '@/shared/ui/Slider';

export interface CustomSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    label?: string;
    unit?: string;
    className?: string;
    formatValue?: (value: number) => string;
    defaultValue?: number;
}

/**
 * Standardized CustomSlider proxying to Slider (mode="block", 48px canon height)
 */
export const CustomSlider: React.FC<CustomSliderProps> = (props) => {
    return <Slider mode="block" {...props} />;
};

export default CustomSlider;
