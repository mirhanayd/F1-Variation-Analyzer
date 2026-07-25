export const SOURCE_LABELS = {
  'openf1-live': 'OpenF1 Live',
  'openf1-historical-replay': 'OpenF1 Historical Replay',
  'fastf1-generated-replay': 'FastF1 Generated Replay',
  'offline-demo': 'Offline / Unavailable',
};

export const sourceLabel = (source) => SOURCE_LABELS[source] ?? 'Offline / Unavailable';

