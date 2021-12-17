function formatDuration(durationMsec: number | null): string {
  if (durationMsec === null) {
    return '-';
  } else if (durationMsec < 1000) {
    return `${durationMsec} msec`;
  } else if (durationMsec < 1000 * 60) {
    return `${Math.round(durationMsec / 1000)} s`;
  } else if (durationMsec < 1000 * 60 * 60) {
    return `${Math.round(durationMsec / (1000 * 60))} m`;
  }

  const durationHours = durationMsec / (1000 * 60 * 60);
  if (durationHours < 10) {
    return `${durationHours.toFixed(1)} h`;
  } else if (durationHours < 72) {
    return `${Math.round(durationHours)} h`;
  }

  return `${Math.round(durationHours / 24)} d`;
}

function formatRatio(ratio: number): string {
  return !Number.isFinite(ratio) ? '-' : ratio.toFixed(2);
}

const Format = {
  duration: formatDuration,
  ratio: formatRatio,
};

export default Format;
