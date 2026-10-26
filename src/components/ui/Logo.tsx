import React, { useId } from 'react';
import { ZAD_PATH, ZAD_TRANSFORM } from './logoPath';

/** App mark: the "زد" wordmark on an amber tile. Vector only, so it needs no font and looks identical everywhere. */
export const Logo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => {
  const gid = `logo-g-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="زد" fill="none">
      <defs>
        <linearGradient id={gid} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d97706" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${gid})`} />
      <path transform={ZAD_TRANSFORM} d={ZAD_PATH} fill="#0f172a" />
    </svg>
  );
};
