import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import relativeTime from 'dayjs/plugin/relativeTime'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isBetween from 'dayjs/plugin/isBetween'

dayjs.extend(relativeTime)
dayjs.extend(isSameOrBefore)
dayjs.extend(isBetween)
dayjs.locale('pt-br')

export function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  return dayjs(date).format('DD/MM/YYYY')
}

export function formatDateShort(date: string | Date | null): string {
  if (!date) return '—'
  return dayjs(date).format('DD/MM/YY')
}

export function formatMonthYear(date: string | Date): string {
  return dayjs(date).format('MMM/YYYY')
}

export function isOverdue(dateStr: string): boolean {
  return dayjs(dateStr).isBefore(dayjs(), 'day')
}

export function daysOverdue(dateStr: string): number {
  return dayjs().diff(dayjs(dateStr), 'day')
}

export function daysUntil(dateStr: string): number {
  return dayjs(dateStr).diff(dayjs(), 'day')
}

export function addMonths(date: string | Date, months: number): string {
  return dayjs(date).add(months, 'month').format('YYYY-MM-DD')
}

export function monthsBetween(start: string | Date, end: string | Date): number {
  return dayjs(end).diff(dayjs(start), 'month')
}

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  return dayjs(a).isSame(dayjs(b), 'day')
}

export function startOfMonth(date?: string | Date): string {
  return dayjs(date).startOf('month').format('YYYY-MM-DD')
}

export function endOfMonth(date?: string | Date): string {
  return dayjs(date).endOf('month').format('YYYY-MM-DD')
}
