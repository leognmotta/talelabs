import type { ErrorInfo, ReactNode } from 'react'

import { Component } from 'react'

export interface ErrorBoundaryFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (props: ErrorBoundaryFallbackProps) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React error boundary caught an error.', {
      componentStack: info.componentStack,
      error,
    })
  }

  resetErrorBoundary = () => {
    this.setState({ error: null })
  }

  render() {
    const { children, fallback } = this.props
    const { error } = this.state

    return error
      ? fallback({ error, resetErrorBoundary: this.resetErrorBoundary })
      : children
  }
}
