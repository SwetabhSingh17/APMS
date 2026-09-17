import React from 'react';

interface IPhaseProgress {
  label: string;
  percentage: number;
  color: string;
  /** Tailwind gradient classes for the subtle background glow */
  glowClass: string;
}

/**
 * An individual SVG progress ring.
 * Uses stroke-dasharray + stroke-dashoffset for the arc,
 * and a CSS animation for a smooth draw-in on mount.
 */
function ProgressRing({ label, percentage, color, glowClass }: IPhaseProgress) {
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 group">
      {/* Ring container */}
      <div className={`relative w-36 h-36 rounded-full ${glowClass} p-1 transition-transform duration-300 group-hover:scale-105`}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 128 128"
          aria-label={`${label}: ${Math.round(percentage)}%`}
          role="img"
        >
          {/* Background track */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground/10"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="progress-ring-circle"
            style={{
              /* CSS custom property drives the draw-in animation */
              '--ring-offset': offset,
              '--ring-circumference': circumference,
              filter: `drop-shadow(0 0 6px ${color}40)`,
            } as React.CSSProperties}
          />
        </svg>
        {/* Center percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      {/* Label */}
      <span className="text-sm font-medium text-muted-foreground text-center">
        {label}
      </span>
    </div>
  );
}

interface IProgress3DProps {
  stats?: {
    topicSelection: number;
    research: number;
    implementation: number;
    testing: number;
  };
}

/**
 * Lightweight SVG-based progress visualization.
 * Replaces the previous Three.js 3D canvas to reduce bundle size by ~700 KB.
 */
export default function Progress3D({ stats }: IProgress3DProps) {
  const defaultStats = {
    topicSelection: 0,
    research: 0,
    implementation: 0,
    testing: 0,
    ...stats,
  };

  const phases: IPhaseProgress[] = [
    {
      label: 'Topic Selection',
      percentage: defaultStats.topicSelection,
      color: '#3b82f6',
      glowClass: 'bg-blue-500/5',
    },
    {
      label: 'Research',
      percentage: defaultStats.research,
      color: '#10b981',
      glowClass: 'bg-emerald-500/5',
    },
    {
      label: 'Implementation',
      percentage: defaultStats.implementation,
      color: '#8b5cf6',
      glowClass: 'bg-violet-500/5',
    },
    {
      label: 'Testing',
      percentage: defaultStats.testing,
      color: '#ef4444',
      glowClass: 'bg-red-500/5',
    },
  ];

  return (
    <div className="w-full rounded-xl overflow-hidden bg-background/40 backdrop-blur-xl border border-white/20 dark:border-white/10 relative p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Project Progress Overview
        </h3>
        <p className="text-sm text-muted-foreground">
          Current completion status across all active projects.
        </p>
      </div>

      {/* Ring grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center py-4">
        {phases.map((phase) => (
          <ProgressRing key={phase.label} {...phase} />
        ))}
      </div>
    </div>
  );
}
