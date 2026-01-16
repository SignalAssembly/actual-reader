/**
 * Spinner Component (Solid)
 */

import type { JSX } from 'solid-js';

export interface SpinnerProps {
  size?: number;
  color?: string;
  style?: JSX.CSSProperties;
}

export function Spinner(props: SpinnerProps) {
  const size = () => props.size ?? 20;
  const color = () => props.color ?? 'currentColor';

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
      <span
        style={{
          display: 'inline-block',
          width: `${size()}px`,
          height: `${size()}px`,
          border: '2px solid transparent',
          'border-top-color': color(),
          'border-radius': '50%',
          animation: 'spin 0.8s linear infinite',
          ...props.style,
        }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
}

export default Spinner;
