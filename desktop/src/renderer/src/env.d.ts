/// <reference types="vite/client" />

import type { SetupProgress } from '../preload/index'

declare global {
  interface Window {
    api: any
  }
  // Standard JSX global mapping for modern React / TS environment
  namespace JSX {
    type Element = React.JSX.Element
  }
}

export {}
