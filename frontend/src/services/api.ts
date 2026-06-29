import type {
  AgentAskResponse,
  AgentSuggestion,
  AwareLatestResponse,
  AwareOfficialSummary,
  AwareSnapshotArchive,
  AwsAlert,
  AwsLatestResponse,
  CreateIncidentPayload,
  CurrentUser,
  DashboardSummary,
  DisseminationActionPayload,
  DisseminationActionResponse,
  DisseminationSummary,
  DispatchActionResponse,
  DispatchIncidentDetailResponse,
  DispatchIncidentListResponse,
  DispatchPumpPayload,
  FloodMapFramesResponse,
  GisLayer,
  HealthState,
  GenerateReportPayload,
  GenerateReportResponse,
  LatestMapOverlayResponse,
  LoginResponse,
  MapInspectResponse,
  NarrativeNowcastPreview,
  NowcastJob,
  NowcastOptions,
  NowcastOutputs,
  NowcastSelection,
  HotspotImpactListResponse,
  IncidentCandidateListResponse,
  MisActionPayload,
  MisActionResponse,
  MisHotspotDetailResponse,
  MisHotspotListResponse,
  MisPhotoPayload,
  NearestPumpResponse,
  OperationalImpactSummary,
  PumpResourceListResponse,
  ReportSummary,
  OfficialScenarioGallery,
  ParityDownloadCenter,
  ParitySystemStatus,
  TomorrowForecastResponse,
  UpdateIncidentPayload,
  GenerateWardPdfPayload,
  GenerateWardPdfResponse
} from "../types/api";

const defaultApiBase = "https://testvapi.floodresq.com";

export const apiBase = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/$/, "");
export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
export const googleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
export const terminalStatuses = new Set(["completed", "completed_with_warnings", "failed", "cancelled"]);
export const activeStatuses = new Set(["queued", "running", "paused", "cancel_requested"]);
const authTokenStorageKey = "floodastra.phase6.authToken";
const localApiHosts = new Set(["localhost", "127.0.0.1"]);

type HealthResponse = {
  status?: string;
  message?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(path), init);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function readAuthToken() {
  return window.localStorage.getItem(authTokenStorageKey);
}

export function storeAuthToken(token: string) {
  window.localStorage.setItem(authTokenStorageKey, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(authTokenStorageKey);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const payload = await requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  storeAuthToken(payload.access_token);
  return payload;
}

export function fetchCurrentUser(token = readAuthToken()) {
  return requestJson<CurrentUser>("/api/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function logout() {
  try {
    await requestJson<{ status: string; message: string }>("/api/auth/logout", { method: "POST" });
  } finally {
    clearAuthToken();
  }
}

export async function fetchBackendHealth(signal?: AbortSignal): Promise<HealthState> {
  const payload = await requestJson<HealthResponse>("/api/health", { signal });
  return {
    status: "online",
    detail: payload.message || "Backend API is online."
  };
}

export function fetchNowcastOptions() {
  return requestJson<NowcastOptions>("/api/nowcast/options");
}

export function fetchAgentSuggestions(route: string) {
  return requestJson<{ route: string; suggestions: AgentSuggestion[] }>(`/api/agent/suggestions?route=${encodeURIComponent(route)}`);
}

export function askAgent(payload: { question: string; route: string; selected_context?: Record<string, unknown> }) {
  return requestJson<AgentAskResponse>("/api/agent/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function previewNarrativeNowcast(narrative: string, buildAnimation = true) {
  return requestJson<NarrativeNowcastPreview>("/api/agent/nowcast/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrative, build_animation: buildAnimation })
  });
}

export function runNarrativeNowcast(narrative: string, buildAnimation = true) {
  return requestJson<{ preview: NarrativeNowcastPreview; job: NowcastJob }>("/api/agent/nowcast/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrative, build_animation: buildAnimation })
  });
}

export function submitNowcastRun(selection: NowcastSelection) {
  return requestJson<NowcastJob>("/api/nowcast/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection)
  });
}

export function fetchNowcastJob(jobId: string) {
  return requestJson<NowcastJob>(`/api/nowcast/jobs/${jobId}`);
}

export function fetchNowcastJobs() {
  return requestJson<{ jobs: NowcastJob[] }>("/api/nowcast/jobs");
}

export function pauseNowcastJob(jobId: string) {
  return requestJson<NowcastJob>(`/api/nowcast/jobs/${jobId}/pause`, { method: "POST" });
}

export function resumeNowcastJob(jobId: string) {
  return requestJson<NowcastJob>(`/api/nowcast/jobs/${jobId}/resume`, { method: "POST" });
}

export function cancelNowcastJob(jobId: string) {
  return requestJson<NowcastJob>(`/api/nowcast/jobs/${jobId}/cancel`, { method: "POST" });
}

export function fetchLatestNowcast() {
  return requestJson<{ latest?: NowcastJob | null }>("/api/nowcast/latest");
}

export function fetchNowcastOutputs(runId: string) {
  return requestJson<NowcastOutputs>(`/api/nowcast/runs/${runId}/outputs`);
}

export function fetchTomorrow12hForecast() {
  return requestJson<TomorrowForecastResponse>("/api/nowcast/tomorrow/forecast/12h", { method: "POST" });
}

export function fetchLatestTomorrowForecast() {
  return requestJson<TomorrowForecastResponse>("/api/nowcast/tomorrow/forecast/latest");
}

export function fetchGisLayers() {
  return requestJson<{ layers: GisLayer[] }>("/api/gis/layers");
}

export function fetchGisLayerData(layerId: string) {
  return requestJson<Record<string, unknown>>(`/api/gis/layers/${layerId}/data`);
}

export function fetchDashboardSummary() {
  return requestJson<DashboardSummary>("/api/dashboard/summary");
}

export function fetchLatestMapOverlay() {
  return requestJson<LatestMapOverlayResponse>("/api/map/latest-overlay");
}

export function fetchFloodMapFrames(runId?: string | null) {
  const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
  return requestJson<FloodMapFramesResponse>(`/api/map/flood-frames${query}`);
}

export function fetchMapInspection(latitude: number, longitude: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  return requestJson<MapInspectResponse>(`/api/map/inspect?${query.toString()}`, { signal });
}

export function fetchAwsLatest() {
  return requestJson<AwsLatestResponse>("/api/telemetry/aws/latest");
}

export function fetchAwsAlerts() {
  return requestJson<{ alerts: AwsAlert[] }>("/api/telemetry/aws/alerts");
}

export function fetchAwareLatest() {
  return requestJson<AwareLatestResponse>("/api/aware/latest");
}

export function awareForecastCsvUrl(hours = 12) {
  return toApiUrl(`/api/aware/forecast/${hours}h.csv`);
}

export function fetchAwareOfficialStatus() {
  return requestJson<AwareOfficialSummary>("/api/aware/official/status");
}

export function fetchAwareSnapshots(limit = 8) {
  return requestJson<AwareSnapshotArchive>(`/api/parity/aware-snapshots?limit=${limit}`);
}

export function syncAwareOfficialSources() {
  return requestJson<AwareOfficialSummary>("/api/aware/official/sync", { method: "POST" });
}

export function fetchImpactSummary() {
  return requestJson<OperationalImpactSummary>("/api/impact/latest");
}

export function fetchImpactHotspots(limit = 100) {
  return requestJson<HotspotImpactListResponse>(`/api/impact/hotspots?limit=${limit}`);
}

export function fetchImpactIncidents(limit = 100) {
  return requestJson<IncidentCandidateListResponse>(`/api/impact/incidents?limit=${limit}`);
}

export function fetchMisHotspots(params: {
  query?: string;
  impact_status?: string;
  action_status?: string;
  critical_only?: boolean;
} = {}) {
  const query = new URLSearchParams();
  if (params.query) query.set("query", params.query);
  if (params.impact_status) query.set("impact_status", params.impact_status);
  if (params.action_status) query.set("action_status", params.action_status);
  if (params.critical_only) query.set("critical_only", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<MisHotspotListResponse>(`/api/mis/hotspots${suffix}`);
}

export function fetchMisHotspotDetail(hotspotId: string) {
  return requestJson<MisHotspotDetailResponse>(`/api/mis/hotspots/${encodeURIComponent(hotspotId)}`);
}

export function postMisHotspotAction(hotspotId: string, payload: MisActionPayload) {
  return requestJson<MisActionResponse>(`/api/mis/hotspots/${encodeURIComponent(hotspotId)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postMisHotspotPhoto(hotspotId: string, payload: MisPhotoPayload) {
  return requestJson<MisActionResponse>(`/api/mis/hotspots/${encodeURIComponent(hotspotId)}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchDispatchIncidents() {
  return requestJson<DispatchIncidentListResponse>("/api/dispatch/incidents");
}

export function fetchDispatchIncidentDetail(incidentId: string) {
  return requestJson<DispatchIncidentDetailResponse>(`/api/dispatch/incidents/${encodeURIComponent(incidentId)}`);
}

export function createDispatchIncidentFromHotspot(hotspotId: string, payload: CreateIncidentPayload) {
  return requestJson<DispatchActionResponse>(`/api/dispatch/incidents/from-hotspot/${encodeURIComponent(hotspotId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postDispatchPump(incidentId: string, payload: DispatchPumpPayload) {
  return requestJson<DispatchActionResponse>(`/api/dispatch/incidents/${encodeURIComponent(incidentId)}/dispatch-pump`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postDispatchIncidentUpdate(incidentId: string, payload: UpdateIncidentPayload) {
  return requestJson<DispatchActionResponse>(`/api/dispatch/incidents/${encodeURIComponent(incidentId)}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchPumpResources() {
  return requestJson<PumpResourceListResponse>("/api/dispatch/resources/pumps");
}

export function fetchNearestPumps(params: { hotspot_id?: string; incident_id?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params.hotspot_id) query.set("hotspot_id", params.hotspot_id);
  if (params.incident_id) query.set("incident_id", params.incident_id);
  query.set("limit", String(params.limit || 5));
  return requestJson<NearestPumpResponse>(`/api/dispatch/nearest-pumps?${query.toString()}`);
}

export function fetchDisseminationSummary() {
  return requestJson<DisseminationSummary>("/api/dissemination/summary");
}

export function generateWardPdf(payload: GenerateWardPdfPayload) {
  return requestJson<GenerateWardPdfResponse>("/api/dissemination/ward-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postDisseminationAction(payload: DisseminationActionPayload) {
  return requestJson<DisseminationActionResponse>("/api/dissemination/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchReportSummary() {
  return requestJson<ReportSummary>("/api/reports/summary");
}

export function generateReport(payload: GenerateReportPayload) {
  return requestJson<GenerateReportResponse>("/api/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchOfficialScenarios() {
  return requestJson<OfficialScenarioGallery>("/api/parity/scenarios");
}

export function fetchDownloadCenter() {
  return requestJson<ParityDownloadCenter>("/api/parity/downloads");
}

export function fetchParitySystemStatus() {
  return requestJson<ParitySystemStatus>("/api/parity/system-status");
}

export function toApiUrl(path: string) {
  if (!path) {
    return apiBase;
  }
  if (path.startsWith("http")) {
    const url = new URL(path);
    if (localApiHosts.has(url.hostname) || url.port === "6010") {
      return `${apiBase}${url.pathname}${url.search}${url.hash}`;
    }
    return path;
  }
  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
}
