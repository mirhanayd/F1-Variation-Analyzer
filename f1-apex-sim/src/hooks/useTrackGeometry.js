import { useEffect, useState } from 'react';
import { buildSvgGeometry } from '../utils/trackGeometry';

const initialState = {
  status: 'idle',
  geometry: null,
  error: null,
};

export const useTrackGeometry = (track, geometryOverride = null) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (geometryOverride?.points?.length) {
      setState({
        status: 'ready',
        geometry: geometryOverride,
        error: null,
      });
      return undefined;
    }

    if (!track?.svgPath) {
      setState({
        status: 'error',
        geometry: null,
        error: new Error('Track SVG path is missing'),
      });
      return undefined;
    }

    const controller = new AbortController();

    const loadGeometry = async () => {
      setState({ status: 'loading', geometry: null, error: null });

      try {
        const response = await fetch(track.svgPath, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Could not load track SVG (${response.status})`);
        }

        const svgText = await response.text();
        const geometry = buildSvgGeometry(svgText);

        if (!controller.signal.aborted) {
          setState({ status: 'ready', geometry, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: 'error', geometry: null, error });
        }
      }
    };

    loadGeometry();

    return () => controller.abort();
  }, [geometryOverride, track?.svgPath]);

  return state;
};
