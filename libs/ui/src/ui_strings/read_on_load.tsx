import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAudioContext } from './audio_context';

export interface ReadOnLoadProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Returns the react-router location state if a react-router context exists,
 * without failing if there isn't one available.
 *
 * Allows us to conditionally use router-aware logic in {@link ReadOnLoad}
 * without requiring a react-router context.
 */
function useLocationIfAvailable() {
  try {
    return useLocation();
  } catch {
    return undefined;
  }
}

/**
 * On initial render, this triggers an audio read-out of any descendant
 * `UiString` elements rendered within (in order of appearance in the DOM), if
 * audio playback is enabled.
 *
 * Re-triggers a read-out on subsequent route changes, if applicable, or whenever
 * audio playback is newly enabled.
 *
 * NOTE: Intended for use as a single instance on any given app screen. If
 * multiple instances are present on screen, audio will be played only for
 * content within the last `ReadOnLoad` instance.
 */
export function ReadOnLoad(props: ReadOnLoadProps): JSX.Element {
  const { children, className } = props;

  const location = useLocationIfAvailable();
  const currentUrl = location?.pathname;

  const audioContext = useAudioContext();
  const isAudioEnabled = audioContext?.isEnabled;

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current || !isAudioEnabled) {
      return;
    }

    containerRef.current.focus();
    containerRef.current.click();
  }, [currentUrl, isAudioEnabled]);

  return (
    <div className={className} ref={containerRef}>
      {children}
    </div>
  );
}
