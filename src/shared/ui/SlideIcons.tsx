import React from 'react';

export interface CustomIconProps {
    className?: string;
    size?: number;
}

/** Custom Timeline icon (slides track + audio track + playhead) matching the app's 1.5px vector stroke style. */
export const CustomTimelineIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Playhead */}
        <line x1="8.75" y1="2.25" x2="8.75" y2="15.75" />
        <path d="M7 2.25h3.5" strokeWidth="1.8" />
        {/* Top track: slide clips */}
        <rect x="2" y="5" width="4.75" height="3.5" rx="1" fill="currentColor" fillOpacity="0.22" />
        <rect x="10.75" y="5" width="5.25" height="3.5" rx="1" fill="currentColor" fillOpacity="0.22" />
        {/* Bottom track: audio clip */}
        <rect x="4" y="10.75" width="10.5" height="3.25" rx="1" fill="currentColor" fillOpacity="0.16" />
    </svg>
);

/** Custom 16:9 presentation slide icon (clean centered slide lines). */
export const CustomSlideIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <rect x="1.25" y="1.5" width="15.5" height="11" rx="2.4" />
        <line x1="5" y1="5.75" x2="13" y2="5.75" />
        <line x1="6.75" y1="8.75" x2="11.25" y2="8.75" opacity="0.7" />
    </svg>
);

/** Custom rounded slide-stack icon (stacked rounded 16:9 slides) matching the app's 1.6px vector stroke style. */
export const CustomSlideStackIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Front rounded 16:9 slide */}
        <rect x="2" y="2.25" width="14" height="8.5" rx="2.4" />
        {/* Middle stacked slide edge with soft rounded shoulders */}
        <path d="M3.5 13.35c.45.32 1 .5 1.65.5h7.7c.65 0 1.2-.18 1.65-.5" />
        {/* Bottom stacked slide edge */}
        <path d="M5.25 16.05c.38.22.82.35 1.35.35h4.8c.53 0 .97-.13 1.35-.35" />
    </svg>
);

/** Custom Service / Order-of-Service folder icon matching the app's 1.6px rounded vector style. */
export const CustomServiceIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Rounded folder silhouette */}
        <path d="M2.25 5.4c0-1.15.93-2.05 2.05-2.05h2.55c.6 0 1.16.28 1.52.76l.48.64c.22.3.57.48.94.48h3.91c1.13 0 2.05.92 2.05 2.05v5.57c0 1.3-1.05 2.35-2.35 2.35H4.6c-1.3 0-2.35-1.05-2.35-2.35V5.4Z" />
        {/* Order-of-service lines inside */}
        <line x1="5.75" y1="9.25" x2="12.25" y2="9.25" strokeWidth="1.4" opacity="0.8" />
        <line x1="5.75" y1="12" x2="9.75" y2="12" strokeWidth="1.4" opacity="0.55" />
    </svg>
);

/** Custom Hymnal book icon (closed book with a musical note on the cover) matching the app's 1.6px rounded style. */
export const CustomHymnalIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Closed book cover with spine */}
        <path d="M3.5 14.5v-11A1.75 1.75 0 0 1 5.25 1.75h8.25c.69 0 1.25.56 1.25 1.25v10.25a.75.75 0 0 1-.75.75H5.25a1.75 1.75 0 0 0-1.75 1.75Z" />
        {/* Bottom page edge */}
        <path d="M3.5 14.5a1.75 1.75 0 0 0 1.75 1.75H14.5" />
        {/* Musical note centered on the book cover */}
        <circle cx="8.35" cy="9.25" r="1.15" fill="currentColor" stroke="none" />
        <path d="M9.45 9.25V5.35l2.45.6" strokeWidth="1.4" />
    </svg>
);

/** Custom Hymns slide-stack icon (stacked rounded 16:9 slides with a musical note inside). */
export const CustomHymnStackIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Front rounded 16:9 slide */}
        <rect x="2" y="2.25" width="14" height="8.5" rx="2.4" />
        {/* Musical note centered inside the slide */}
        <circle cx="8.15" cy="7.9" r="1.05" fill="currentColor" stroke="none" />
        <path d="M9.15 7.9V4.55l2.25.55" strokeWidth="1.35" />
        {/* Middle stacked slide edge */}
        <path d="M3.5 13.35c.45.32 1 .5 1.65.5h7.7c.65 0 1.2-.18 1.65-.5" />
        {/* Bottom stacked slide edge */}
        <path d="M5.25 16.05c.38.22.82.35 1.35.35h4.8c.53 0 .97-.13 1.35-.35" />
    </svg>
);

/** Custom Scripture slide-stack icon (stacked rounded 16:9 slides with the Cross of Christ inside). */
export const CustomScriptureStackIcon: React.FC<CustomIconProps> = ({ className, size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Front rounded 16:9 slide */}
        <rect x="2" y="2.25" width="14" height="8.5" rx="2.4" />
        {/* Cross of Christ centered inside the slide */}
        <line x1="9" y1="4.15" x2="9" y2="8.85" strokeWidth="1.4" />
        <line x1="7.25" y1="5.7" x2="10.75" y2="5.7" strokeWidth="1.4" />
        {/* Middle stacked slide edge */}
        <path d="M3.5 13.35c.45.32 1 .5 1.65.5h7.7c.65 0 1.2-.18 1.65-.5" />
        {/* Bottom stacked slide edge */}
        <path d="M5.25 16.05c.38.22.82.35 1.35.35h4.8c.53 0 .97-.13 1.35-.35" />
    </svg>
);
