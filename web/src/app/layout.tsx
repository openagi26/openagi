import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import TopNavWrapper from '@/components/TopNavWrapper';

export const metadata: Metadata = {
  title: 'OpenAGI',
  description: '多核AI协作平台，面向100万用户',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>
          <div className="flex flex-col h-screen overflow-hidden" id="app-root">
            <TopNavWrapper />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
