export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "api_error";
    this.details = options.details ?? null;
  }
}

export type ApiProjectStatus = "active" | "paused" | "archived";
export type ApiSeedType = "none" | "git";
export type ApiAgentStatus = "idle" | "working" | "paused" | "error" | "offline";

export type ApiProjectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ApiProjectStatus;
  projectRoot: string;
  seedType: ApiSeedType;
  seedUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignedAgentCount: number;
  openTaskCount: number;
  backlogTaskCount: number;
};

export type ApiProjectDetail = ApiProjectSummary & {
  assignedAgentIds: string[];
};

export type ApiProjectActivityItem = {
  id: string;
  projectId: string;
  type: "comment" | "run" | "assignment";
  title: string;
  message: string;
  createdAt: string;
};

export type ApiAgent = {
  id: string;
  name: string;
  role: string;
  status: ApiAgentStatus;
  currentTaskId: string | null;
  projectIds: string[];
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  status?: ApiProjectStatus;
  projectRoot: string;
  seedType?: ApiSeedType;
  seedUrl?: string | null;
  tags?: string[];
};

export type DirectorySelection = {
  path: string | null;
  canceled: boolean;
};

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  (typeof window === "undefined" ? `${WEB_ORIGIN}/api/backend` : "/api/backend");

const buildApiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown }; message?: string } | null =
      null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}.`,
      {
        status: response.status,
        code: payload?.error?.code,
        details: payload?.error?.details,
      }
    );
  }

  return (await response.json()) as T;
}

export async function getProjects() {
  return requestJson<ApiProjectSummary[]>("/projects");
}

export async function getProject(projectId: string) {
  return requestJson<ApiProjectDetail>(`/projects/${projectId}`);
}

export async function getProjectActivity(projectId: string) {
  return requestJson<ApiProjectActivityItem[]>(`/projects/${projectId}/activity`);
}

export async function getAgents() {
  return requestJson<ApiAgent[]>("/agents");
}

export async function createProject(input: CreateProjectInput) {
  return requestJson<ApiProjectSummary>("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function selectProjectRootDirectory() {
  return requestJson<DirectorySelection>("/system/select-directory", {
    method: "POST",
  });
}
