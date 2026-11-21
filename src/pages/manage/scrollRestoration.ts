import { ChecklistFilterType } from './pdfExport';
import { SortDirection } from './boothSort';

export interface EventViewSavedState {
  scrollY: number;
  searchQuery: string;
  checklistFilter: ChecklistFilterType;
  sortDirection: SortDirection;
  lastOpenedBoothId: string | null;
  needsRestoration: boolean;
  timestamp: number;
}

export interface BoothsViewSavedState {
  scrollY: number;
  searchQuery: string;
  checklistFilter: ChecklistFilterType;
  sortDirection: SortDirection;
  selectedEventId: string;
  structureFilter: string;
  activeTab?: 'confirmed' | 'discussions';
  lastOpenedBoothId: string | null;
  needsRestoration: boolean;
  timestamp: number;
}

export interface EventsViewSavedState {
  scrollY: number;
  search: string;
  statusFilter: string;
  lastOpenedEventId: string | null;
  needsRestoration: boolean;
  timestamp: number;
}

export interface BoothOriginInfo {
  route: string;
  title: string;
  timestamp: number;
}

const STORAGE_KEY_EVENT_PREFIX = 'rwz_sr_event_';
const STORAGE_KEY_BOOTHS = 'rwz_sr_booths';
const STORAGE_KEY_EVENTS = 'rwz_sr_events';
const STORAGE_KEY_ORIGIN = 'rwz_sr_booth_origin';

// Fallback in-memory map in case sessionStorage is restricted in iframe/incognito
const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return memoryStore.get(key) || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function safeRemoveItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

// ==========================================
// 1. Event Details View State
// ==========================================

export function saveEventViewState(eventId: string, state: Partial<EventViewSavedState>): void {
  if (!eventId) return;
  const key = `${STORAGE_KEY_EVENT_PREFIX}${eventId}`;
  const existing = getEventViewState(eventId);
  const updated: EventViewSavedState = {
    scrollY: state.scrollY ?? existing?.scrollY ?? window.scrollY,
    searchQuery: state.searchQuery ?? existing?.searchQuery ?? '',
    checklistFilter: state.checklistFilter ?? existing?.checklistFilter ?? 'all',
    sortDirection: state.sortDirection ?? existing?.sortDirection ?? 'asc',
    lastOpenedBoothId: state.lastOpenedBoothId ?? existing?.lastOpenedBoothId ?? null,
    needsRestoration: state.needsRestoration ?? true,
    timestamp: Date.now(),
  };
  safeSetItem(key, JSON.stringify(updated));
}

export function getEventViewState(eventId: string): EventViewSavedState | null {
  if (!eventId) return null;
  const key = `${STORAGE_KEY_EVENT_PREFIX}${eventId}`;
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EventViewSavedState;
  } catch {
    return null;
  }
}

export function consumeEventRestoration(eventId: string): EventViewSavedState | null {
  const state = getEventViewState(eventId);
  if (!state) return null;
  if (state.needsRestoration) {
    saveEventViewState(eventId, { ...state, needsRestoration: false });
  }
  return state;
}

export function clearEventViewState(eventId: string): void {
  safeRemoveItem(`${STORAGE_KEY_EVENT_PREFIX}${eventId}`);
}

export function hasPendingEventRestoration(eventId: string): boolean {
  const state = getEventViewState(eventId);
  return !!state?.needsRestoration;
}

// ==========================================
// 2. Booths Directory View State
// ==========================================

export function saveBoothsViewState(state: Partial<BoothsViewSavedState>): void {
  const existing = getBoothsViewState();
  const updated: BoothsViewSavedState = {
    scrollY: state.scrollY ?? existing?.scrollY ?? window.scrollY,
    searchQuery: state.searchQuery ?? existing?.searchQuery ?? '',
    checklistFilter: state.checklistFilter ?? existing?.checklistFilter ?? 'all',
    sortDirection: state.sortDirection ?? existing?.sortDirection ?? 'asc',
    selectedEventId: state.selectedEventId ?? existing?.selectedEventId ?? '',
    structureFilter: state.structureFilter ?? existing?.structureFilter ?? 'all',
    activeTab: state.activeTab ?? existing?.activeTab ?? 'confirmed',
    lastOpenedBoothId: state.lastOpenedBoothId ?? existing?.lastOpenedBoothId ?? null,
    needsRestoration: state.needsRestoration ?? true,
    timestamp: Date.now(),
  };
  safeSetItem(STORAGE_KEY_BOOTHS, JSON.stringify(updated));
}

export function getBoothsViewState(): BoothsViewSavedState | null {
  const raw = safeGetItem(STORAGE_KEY_BOOTHS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BoothsViewSavedState;
  } catch {
    return null;
  }
}

export function consumeBoothsRestoration(): BoothsViewSavedState | null {
  const state = getBoothsViewState();
  if (!state) return null;
  if (state.needsRestoration) {
    saveBoothsViewState({ ...state, needsRestoration: false });
  }
  return state;
}

export function clearBoothsViewState(): void {
  safeRemoveItem(STORAGE_KEY_BOOTHS);
}

export function hasPendingBoothsRestoration(): boolean {
  const state = getBoothsViewState();
  return !!state?.needsRestoration;
}

// ==========================================
// 3. Events Directory View State
// ==========================================

export function saveEventsViewState(state: Partial<EventsViewSavedState>): void {
  const existing = getEventsViewState();
  const updated: EventsViewSavedState = {
    scrollY: state.scrollY ?? existing?.scrollY ?? window.scrollY,
    search: state.search ?? existing?.search ?? '',
    statusFilter: state.statusFilter ?? existing?.statusFilter ?? 'all',
    lastOpenedEventId: state.lastOpenedEventId ?? existing?.lastOpenedEventId ?? null,
    needsRestoration: state.needsRestoration ?? true,
    timestamp: Date.now(),
  };
  safeSetItem(STORAGE_KEY_EVENTS, JSON.stringify(updated));
}

export function getEventsViewState(): EventsViewSavedState | null {
  const raw = safeGetItem(STORAGE_KEY_EVENTS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EventsViewSavedState;
  } catch {
    return null;
  }
}

export function consumeEventsRestoration(): EventsViewSavedState | null {
  const state = getEventsViewState();
  if (!state) return null;
  if (state.needsRestoration) {
    saveEventsViewState({ ...state, needsRestoration: false });
  }
  return state;
}

export function hasPendingEventsRestoration(): boolean {
  const state = getEventsViewState();
  return !!state?.needsRestoration;
}

// ==========================================
// 4. Booth Origin Tracking (Where did user come from?)
// ==========================================

export function setBoothOrigin(origin: BoothOriginInfo): void {
  safeSetItem(STORAGE_KEY_ORIGIN, JSON.stringify(origin));
}

export function getBoothOrigin(): BoothOriginInfo | null {
  const raw = safeGetItem(STORAGE_KEY_ORIGIN);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BoothOriginInfo;
  } catch {
    return null;
  }
}

export function clearBoothOrigin(): void {
  safeRemoveItem(STORAGE_KEY_ORIGIN);
}

// ==========================================
// 5. Global Router Check
// ==========================================

export function hasPendingRestoration(route: string): boolean {
  if (route.startsWith('event:')) {
    const evtId = route.replace('event:', '');
    return hasPendingEventRestoration(evtId);
  }
  if (route === 'booths' || route === 'booths:discussions') {
    return hasPendingBoothsRestoration();
  }
  if (route === 'events') {
    return hasPendingEventsRestoration();
  }
  return false;
}

// ==========================================
// 6. Smart Scroll & Highlight Executor
// ==========================================

export interface RestoreOptions {
  dataAttr?: string;
  highlightDurationMs?: number;
}

export function restoreScrollAndHighlight(
  targetId: string | null,
  savedScrollY: number,
  options: RestoreOptions = {}
): void {
  const {
    dataAttr = 'data-booth-id',
    highlightDurationMs = 2500,
  } = options;

  // Execute in the next animation frame after React layout settles
  requestAnimationFrame(() => {
    // 1. Temporarily disable smooth scrolling so scroll position restores immediately without jitter
    const htmlEl = document.documentElement;
    const prevScrollBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = 'auto';

    // 2. First attempt: Scroll directly to the saved vertical offset
    window.scrollTo({ top: savedScrollY, behavior: 'auto' });

    // 3. Locate the target element using its stable ID attribute
    let targetEl: HTMLElement | null = null;
    if (targetId) {
      targetEl = document.querySelector<HTMLElement>(`[${dataAttr}="${targetId}"]`);
    }

    if (targetEl) {
      // Check if targetEl is nicely visible in viewport
      const rect = targetEl.getBoundingClientRect();
      const inView = rect.top >= 60 && rect.bottom <= window.innerHeight - 60;

      if (!inView) {
        // If content height shifted (e.g. items edited or deleted), center it smoothly
        targetEl.scrollIntoView({ block: 'center', behavior: 'auto' });
      }

      // 4. Apply high-visibility temporary highlight
      highlightTargetElement(targetEl, highlightDurationMs);
    }

    // 5. Restore previous scroll behavior
    requestAnimationFrame(() => {
      htmlEl.style.scrollBehavior = prevScrollBehavior;
    });
  });
}

function highlightTargetElement(el: HTMLElement, durationMs: number): void {
  // Add pulsing amber highlight styles
  const classesToAdd = [
    'relative',
    'z-10',
    'ring-2',
    'ring-amber-400',
    'shadow-lg',
    'shadow-amber-500/20',
    'bg-amber-500/[0.12]',
    'transition-all',
    'duration-500',
  ];

  el.classList.add(...classesToAdd);

  // Smoothly fade out the highlight
  setTimeout(() => {
    el.classList.remove('ring-amber-400', 'shadow-amber-500/20', 'bg-amber-500/[0.12]');
    el.classList.add('ring-transparent', 'bg-transparent');

    setTimeout(() => {
      el.classList.remove(...classesToAdd, 'ring-transparent', 'bg-transparent');
    }, 600);
  }, durationMs);
}
