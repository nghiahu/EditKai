import React from 'react';

const paths: Record<string, React.ReactNode> = {
  video: <><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></>,
  skill: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  chat: <path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  clock: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  check: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
  typography: <text x="2" y="17" fontSize="14" fontWeight="700" fill="currentColor" fontFamily="serif">Aa</text>,
  graphic: <><circle cx="9" cy="9" r="5" fill="currentColor" /><rect x="11" y="11" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  motion: <path d="M3 18c5 0 4-12 9-12s4 12 9 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  audio: <path d="M5 10v4 M9 6v12 M13 9v6 M17 4v16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />,
};

export const iconNames = Object.keys(paths);

/** Unknown names fall back to the `check` icon. */
export const Icon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, flexShrink: 0 }}>{paths[name] ?? paths.check}</svg>
);
