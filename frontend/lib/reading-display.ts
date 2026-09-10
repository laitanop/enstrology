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
  const named = formatLuckyColorName(label).toLowerCase();
  if (named.includes('violet') || named.includes('purple')) {
    return '#7C5CFF';
  }
  if (named.includes('gold') || named.includes('yellow')) {
    return '#E8C56A';
  }
  if (named.includes('blue') || named.includes('cyan') || named.includes('teal')) {
    return '#6EA8FF';
  }
  if (named.includes('green')) {
    return '#4ADE80';
  }
  if (named.includes('red') || named.includes('crimson') || named.includes('scarlet')) {
    return '#F87171';
  }
  if (named.includes('orange')) {
    return '#FB923C';
  }
  if (named.includes('pink') || named.includes('rose') || named.includes('magenta')) {
    return '#F9A8D4';
  }
  if (named.includes('silver') || named.includes('white') || named.includes('ivory')) {
    return '#E4E4E7';
  }
  if (named.includes('black') || named.includes('obsidian')) {
    return '#52525B';
  }
  const hex = parseHexColor(label);
  return hex || '#7C5CFF';
}

export function formatLuckyColorName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return 'Cosmic violet';
  }

  const hex = parseHexColor(trimmed);
  if (hex) {
    return nearestColorName(hex);
  }

  if (/^\d+$/.test(trimmed)) {
    return 'Cosmic violet';
  }

  return trimmed
    .replace(/^#/, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function parseHexColor(value: string): string | null {
  const compact = value.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(compact);
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }
  return `#${hex.toUpperCase()}`;
}

function nearestColorName(hex: string): string {
  const palette: Array<{ name: string; hex: string }> = [
    { name: 'Red', hex: '#EF4444' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Gold', hex: '#E8C56A' },
    { name: 'Yellow', hex: '#FACC15' },
    { name: 'Green', hex: '#22C55E' },
    { name: 'Teal', hex: '#14B8A6' },
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Violet', hex: '#7C5CFF' },
    { name: 'Purple', hex: '#A855F7' },
    { name: 'Pink', hex: '#F9A8D4' },
    { name: 'Rose', hex: '#FB7185' },
    { name: 'Silver', hex: '#E4E4E7' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Black', hex: '#18181B' },
  ];

  const target = hexToRgb(hex);
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = colorDistance(target, hexToRgb(color.hex));
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return best.name;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function colorDistance(
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number },
): number {
  return (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2;
}
