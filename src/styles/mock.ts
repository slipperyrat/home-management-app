declare global {
  interface ServiceWorkerRegistration {
    /**
     * Marker property so this interface is not empty while still permitting any real implementation.
     */
    readonly __mockRegistration?: never
  }
}

export {}
