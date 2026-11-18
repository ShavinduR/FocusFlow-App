/** Tiny event bus: repositories announce local writes; useCloudSync debounces them into a sync. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyLocalChange() {
  listeners.forEach((l) => l());
}

export function subscribeLocalChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
