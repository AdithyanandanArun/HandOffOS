'use client';

import { WidgetLayout } from '@nitrostack/widgets';


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: '"Avenir Next", "Segoe UI", sans-serif' }}>
        <WidgetLayout>{children}</WidgetLayout>
      </body>
    </html>
  );
}
