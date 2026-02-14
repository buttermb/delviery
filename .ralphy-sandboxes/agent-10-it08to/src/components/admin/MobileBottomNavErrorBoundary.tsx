import { logger } from '@/lib/logger';
/**
 * Error Boundary for Mobile Bottom Nav Sidebar
 * Catches and handles errors in the sidebar rendering
 */

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    logger.error('MobileBottomNav Sidebar Error:', error);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null; // Error UI is handled by parent
    }
    return this.props.children;
  }
}
