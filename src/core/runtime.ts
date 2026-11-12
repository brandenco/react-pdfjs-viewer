/**
 * Globals that aren't available everywhere at runtime: `scheduler` is missing in
 * Safari, `location` is missing during SSR. The DOM lib types both as always present
 * (and only recent TypeScript versions declare `Scheduler` at all), so we describe
 * just the parts we use instead of depending on a particular lib.dom version.
 */
interface SchedulerLike {
  postTask?: (callback: () => void, options?: { priority?: "background" }) => Promise<void>;
  yield?: () => Promise<void>;
}

export const runtime: {
  readonly scheduler?: SchedulerLike;
  readonly location?: { readonly href: string };
} = globalThis;
