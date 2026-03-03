const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicNumber(num: number): string {
  return String(num)
    .split('')
    .map(digit => arabicNumerals[parseInt(digit)])
    .join('');
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getRevelationTypeIcon(type: string): string {
  return type === 'Meccan' ? '🕋' : '🕌';
}
