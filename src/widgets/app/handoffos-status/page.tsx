'use client';

import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface HandoffOSStatus {
  name: string;
  tagline: string;
  phase: number;
  status: string;
  nextStep: string;
}

export default function HandoffOSStatusWidget() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<HandoffOSStatus>();
  const isDark = theme === 'dark';

  if (!data) {
    return <main style={{ padding: 24 }}>Loading HandoffOS status...</main>;
  }

  return (
    <main style={{
      background: isDark ? '#11201d' : '#e6f4ed',
      border: `1px solid ${isDark ? '#315c51' : '#9ac9b5'}`,
      borderRadius: 16,
      color: isDark ? '#ecf9f2' : '#153d31',
      fontFamily: 'Georgia, serif',
      maxWidth: 560,
      padding: 28,
    }}>
      <p style={{ fontFamily: 'monospace', letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>
        Phase {data.phase} foundation
      </p>
      <h1 style={{ fontSize: 34, margin: '12px 0 8px' }}>{data.name}</h1>
      <p style={{ fontSize: 18, margin: 0 }}>{data.tagline}</p>
      <p style={{ fontWeight: 700, margin: '24px 0 8px' }}>Status: {data.status}</p>
      <p style={{ margin: 0 }}>{data.nextStep}</p>
    </main>
  );
}
