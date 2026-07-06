export const formatDateTime = (isoString, options = {}) => {
  if (!isoString) return 'TBA';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: options.dateStyle ?? 'medium',
    timeStyle: options.timeStyle ?? 'short',
    hour12: false,
    timeZone: options.timeZone,
  }).format(new Date(isoString));
};

export const formatUtcDateTime = (isoString) => {
  if (!isoString) return 'TBA';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(isoString));
};

export const formatGmtOffset = (gmtOffset) => {
  if (!gmtOffset) return 'UTC';

  const sign = gmtOffset.startsWith('-') ? '-' : '+';
  const clean = gmtOffset.replace('-', '').replace('+', '');
  const [hours = '00', minutes = '00'] = clean.split(':');

  return `UTC${sign}${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

export const getDurationParts = (durationMs) => {
  const safeMs = Math.max(0, durationMs);
  const totalSeconds = Math.floor(safeMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds };
};

export const padTime = (value) => String(value).padStart(2, '0');

export const formatReplayClock = (ms) => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${padTime(minutes)}:${padTime(seconds)}`;
};
