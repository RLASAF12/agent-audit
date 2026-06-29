import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentAudit — EU AI Act Article 12 Dashboard',
  description: 'Real-time compliance audit trail for AI agent decisions. EU AI Act Article 12 ready.',
  openGraph: {
    title: 'AgentAudit',
    description: 'Live EU AI Act Article 12 compliance dashboard for AI agents.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
