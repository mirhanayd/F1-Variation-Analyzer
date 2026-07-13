import { useEffect, useState } from 'react';
import { buildSvgGeometry } from '../utils/trackGeometry';

const initialState = {
  status: 'idle',
  geometry: null,
  error: null,
};

export const useTrackGeometry = (track, geometryOverride = null) => {
  const [state, setState] = useState(initialState);
  const hasOverride = Boolean(geometryOverride?.points?.length);
  const embeddedGeometry = track?.geometry
    ?? track?.normalizedDisplayGeometry
    ?? track?.circuitGeometry
    ?? null;
  const hasEmbeddedGeometry = Boolean(embeddedGeometry?.points?.length);
  const svgPath = track?.svgPath ?? null;

  useEffect(() => {
    if (hasOverride || hasEmbeddedGeometry || !svgPath) return undefined;

    const controller = new AbortController();

    const loadGeometry = async () => {
      setState({ status: 'loading', geometry: null, error: null });

      try {
        const response = await fetch(svgPath, { signal: controller.signal });
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
  }, [hasEmbeddedGeometry, hasOverride, svgPath]);

  // Live geometry (e.g. an OpenF1 outline) wins over anything fetched.
  if (hasOverride) {
    return { status: 'ready', geometry: geometryOverride, error: null };
  }

  if (hasEmbeddedGeometry) {
    return { status: 'ready', geometry: embeddedGeometry, error: null };
  }

  if (!svgPath) {
    return {
      status: 'error',
      geometry: null,
      error: new Error('Track geometry is not available'),
    };
  }

  return state;
};
