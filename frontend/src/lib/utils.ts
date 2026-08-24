import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.join(' ') || 'User';
}

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const a = firstName?.trim()?.[0] || '';
  const b = lastName?.trim()?.[0] || '';
  return (a + b).toUpperCase() || 'U';
}

export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
