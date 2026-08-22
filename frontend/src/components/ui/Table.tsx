import { forwardRef, type TableHTMLAttributes } from 'react';
import { cn } from '../../utils/helpers';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
  rowClassName?: (row: T, index: number) => string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'هیچ داده‌ای یافت نشد',
  striped = true,
  hoverable = true,
  className,
  rowClassName,
}: TableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-secondary-200 bg-white', className)}>
      <table className="w-full text-sm text-right">
        <thead>
          <tr className="bg-secondary-50 border-b border-secondary-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-4 py-3 text-secondary-500 font-medium uppercase tracking-wider',
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-secondary-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  hoverable && 'hover:bg-secondary-50 transition-colors',
                  striped && rowIndex % 2 === 1 && 'bg-secondary-50/50',
                  rowClassName?.(row, rowIndex)
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-secondary-900',
                      column.className
                    )}
                  >
                    {column.render 
                      ? column.render(row, rowIndex) 
                      : String((row as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}