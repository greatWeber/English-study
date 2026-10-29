import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '英语默写练习 · Dictation Fun',
  description: '卡通趣味英语默写，按等级与场景分类填空/整句默写，本地记录错题复习',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-cartoon-yellow/10 min-h-screen font-sans antialiased selection:bg-cartoon-orange selection:text-white">
        {children}
      </body>
    </html>
  );
}