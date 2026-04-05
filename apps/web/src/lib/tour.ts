export type TourStepPlacement = "right" | "bottom" | "bottom-end" | "center";

export type TourStep = {
  id: string;
  /** Matches `data-tour-id` on the target element. `null` = centered modal. */
  target: string | null;
  title: string;
  body: string;
  icon: string;
  placement: TourStepPlacement;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to Nova",
    body: "Nova is your command center for managing AI agents, projects, and automated tasks. Let\u2019s take a quick tour.",
    icon: "waving_hand",
    placement: "center",
  },
  {
    id: "sidebar",
    target: "sidebar",
    title: "Navigation",
    body: "The sidebar is your main hub \u2014 jump to the dashboard, projects, agents, task board, runtimes, or settings from here.",
    icon: "space_dashboard",
    placement: "right",
  },
  {
    id: "projects",
    target: "nav-projects",
    title: "Projects",
    body: "Organize your work into projects. Each project has its own task board, assigned agents, and activity log.",
    icon: "folder_open",
    placement: "right",
  },
  {
    id: "agents",
    target: "nav-agents",
    title: "Agents",
    body: "Provision and monitor AI agents. Agents autonomously execute tasks, report progress, and escalate issues.",
    icon: "smart_toy",
    placement: "right",
  },
  {
    id: "tasks",
    target: "nav-tasks",
    title: "Task Board",
    body: "A Kanban-style board for creating, prioritizing, and tracking tasks as agents work through them.",
    icon: "view_kanban",
    placement: "right",
  },
  {
    id: "topbar",
    target: "top-bar",
    title: "Quick Access",
    body: "Switch between views with the top tabs. The notification bell keeps you updated on agent activity.",
    icon: "tab",
    placement: "bottom",
  },
  {
    id: "help",
    target: "help-button",
    title: "Restart This Tour",
    body: "Click the help icon anytime to revisit this tour. That\u2019s it \u2014 you\u2019re ready to go!",
    icon: "help",
    placement: "bottom-end",
  },
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nova:tour-completed";
const TOUR_TRIGGER_EVENT = "nova:tour-trigger";

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function markTourCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, "true");
}

export function resetTourCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Manual trigger (used by the help button in TopBar)
// ---------------------------------------------------------------------------

export function triggerTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_TRIGGER_EVENT));
}

export function onTourTrigger(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => callback();
  window.addEventListener(TOUR_TRIGGER_EVENT, handler);
  return () => window.removeEventListener(TOUR_TRIGGER_EVENT, handler);
}
