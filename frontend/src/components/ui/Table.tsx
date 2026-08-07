import React from 'react';
import { cn } from '@/lib/utils';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, className, ...props }) => (
  <div className="w-full overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 border border-surface-200 rounded-crm bg-white shadow-card touch-pan-x">
    <table className={cn('w-full min-w-[540px] text-left text-sm text-surface-900 border-collapse', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className, ...props }) => (
  <thead className={cn('bg-surface-50 border-b border-surface-200 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-surface-500', className)} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className, ...props }) => (
  <tbody className={cn('divide-y divide-surface-100 bg-white', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className, ...props }) => (
  <tr className={cn('hover:bg-surface-50/70 transition-colors duration-150', className)} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className, ...props }) => (
  <th className={cn('px-2.5 sm:px-4 py-2.5 sm:py-3 font-semibold text-surface-600 select-none whitespace-nowrap', className)} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className, ...props }) => (
  <td className={cn('px-2.5 sm:px-4 py-2.5 sm:py-3.5 align-middle text-surface-800 text-xs font-normal', className)} {...props}>
    {children}
  </td>
);
