import { cn } from '../../utils/helpers';
import { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col">
      <header className="bg-white border-b border-secondary-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-secondary-900">ماریناسان</h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
                <a href="/dashboard" className="px-3 py-2 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 transition-colors">
                  داشبورد
                </a>
                <a href="/requests" className="px-3 py-2 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 transition-colors">
                  درخواست‌ها
                </a>
                <a href="/requests/new" className="px-3 py-2 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 transition-colors">
                  درخواست جدید
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-secondary-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-secondary-500">
          © 1403 ماریناسان. تمامی حقوق محفوظ است.
        </div>
      </footer>
    </div>
  );
}