'use client';

import { Component } from 'react';

export default class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err) {
    return {
      hasError: true,
      message: err?.message || 'Terjadi kesalahan tampilan pada bagian ini.',
    };
  }

  componentDidCatch(err, info) {
    console.error('UI section boundary caught error:', {
      message: err?.message,
      componentStack: info?.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="clean-card rounded-xl p-5 border border-rose-900/60 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-rose-200">
              {this.props.title || 'Komponen gagal dimuat'}
            </div>
            <p className="text-rose-300/80">{this.state.message}</p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium transition-colors"
          >
            Muat Ulang Bagian
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

