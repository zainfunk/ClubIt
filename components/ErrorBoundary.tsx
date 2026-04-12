'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(239,68,68,0.08)' }}>
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#191c1d] mb-2"
            style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
            Something went wrong
          </h2>
          <p className="text-sm text-[#727785] mb-6 max-w-md">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors hover:bg-[#0047a0]"
            style={{ background: '#0058be' }}>
            Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-6 text-left text-xs text-red-600 bg-red-50 rounded-xl p-4 max-w-lg overflow-auto max-h-48">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
