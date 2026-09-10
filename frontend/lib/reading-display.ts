export function formatBirthdate(dateISO: string): string {
  const parsed = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateISO;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLongBirthdate(dateISO: string): string {
  const parsed = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateISO;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function shortAddress(address: string): string {
  if (address.length < 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function readingSnippet(reading: string, maxLength = 110): string {
  const compact = reading.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trim()}...`;
}

export function luckyColorSwatch(label: string): string {
  const value = label.trim().toLowerCase();
  if (value.startsWith('#') && /^#[0-9a-f]{3,8}$/i.test(value)) {
    return value;
  }
  if (value.includes('violet') || value.includes('purple')) {
    return '#7C5CFF';
  }
  if (value.includes('gold') || value.includes('yellow')) {
    return '#E8C56A';
  }
  if (value.includes('blue')) {
    return '#6EA8FF';
  }
  if (value.includes('green')) {
    return '#4ADE80';
  }
  if (value.includes('red') || value.includes('crimson')) {
    return '#F87171';
  }
  if (value.includes('orange')) {
    return '#FB923C';
  }
  if (value.includes('pink')) {
    return '#F9A8D4';
  }
  if (value.includes('silver') || value.includes('white')) {
    return '#E4E4E7';
  }
  return '#7C5CFF';
}
