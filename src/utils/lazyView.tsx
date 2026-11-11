import React, { Suspense, lazy } from 'react';

// Loads a heavy, tab-only view the first time it is shown instead of with the main bundle.
// Each view carries its own Suspense and error box, so switching tabs never blanks the nav, and a failed chunk
// download (offline, or a new deploy replaced the file) shows a retry message instead of a white screen.
class LoadError extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  declare state: { failed: boolean };
  declare props: { children?: React.ReactNode };
  constructor(props: any) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="py-16 text-center text-sm text-gray-400">
        This view could not load.{' '}
        <button type="button" className="underline" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}

export function lazyView<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>): T {
  const View = lazy(loader);
  const Wrapped = (props: any) => (
    <LoadError>
      <Suspense fallback={<div role="status" className="py-16 text-center text-sm text-gray-400">Loading…</div>}>
        <View {...props} />
      </Suspense>
    </LoadError>
  );
  return Wrapped as unknown as T;
}
