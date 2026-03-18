export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString('en-IL')
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '₪0'
  return `₪${n.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return '0%'
  return `${n.toFixed(1)}%`
}

export function formatChange(current: number, previous: number): { value: string; positive: boolean } {
  if (previous === 0) return { value: '+∞', positive: true }
  const change = ((current - previous) / previous) * 100
  return {
    value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
    positive: change >= 0,
  }
}
