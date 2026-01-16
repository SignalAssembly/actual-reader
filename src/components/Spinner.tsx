/**
 * Spinner Component
 *
 * A simple loading spinner for indicating async operations in progress.
 */

import type { CSSProperties } from 'react';

// =============================================================================
// Props Interface
// =============================================================================

export interface SpinnerProps {
  /** Size of the spinner in pixels */
  size?: number;
  /** Color of the spinner */
  color?: string;
  /** Optional additional styles */
  style?: CSSProperties;
}

// =============================================================================
// Component
// =============================================================================

export function Spinner({ size = 20, color = 'currentColor', style }: SpinnerProps) {
  const spinnerStyle: CSSProperties = {
    display: 'inline-block',
    width: size,
    height: size,
    border: `2px solid transparent`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    ...style,
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <span style={spinnerStyle} role="status" aria-label="Loading" />
    </>
  );
}

export default Spinner;
