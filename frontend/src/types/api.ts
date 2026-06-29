export type HealthState = {
  status: "checking" | "online" | "offline";
  detail: string;
};

export type OptionItem = {
  id: string;
  label: string;
  description?: string;
};

export type NowcastOptions = {
  defaults?: {
    rainfall?: string;
    hydrograph?: string;
    stage?: string;
    run_length?: string;
  };
  rainfall_scenarios?: OptionItem[];
  hydrograph_scenarios?: OptionItem[];
  stage_scenarios?: OptionItem[];
  run_lengths?: OptionItem[];
};

export type NowcastSelection = {
  rainfall: string;
  hydrograph: string;
  stage: string;
  run_length: string;
  use_aware_latest?: boolean;
  use_tomorrow_latest?: boolean;
  tomorrow_forecast_id?: string | null;
  rainfall_hyetograph_csv?: string | null;
  build_animation: boolean;
};

export type NarrativeNowcastPreview = {
  parser: "deterministic_verified";
  narrative: string;
  selection: NowcastSelection & {
    use_aware_latest?: boolean;
    fail_on_exposure_error?: boolean;
  };
  confidence: "low" | "medium" | "high";
  summary: string;
  reasons: string[];
  warnings: string[];
};

export type AgentSuggestion = {
  label: string;
  prompt: string;
  action_type: "ask" | "nowcast_preview";
};

export type AgentAskResponse = {
  ok: boolean;
  mode: "verified";
  answer: string;
  cards: Array<Record<string, unknown>>;
  suggested_prompts: string[];
  evidence: Array<{ label: string; value: string }>;
  action?: {
    type: string;
    selection?: NarrativeNowcastPreview["selection"];
    warnings?: string[];
  } | null;
};

export type ArtifactRecord = {
  artifact_id: string;
  artifact_url: string;
  filename: string;
  path?: string;
  kind: string;
  media_type: string;
  size_bytes: number;
  modified_utc: string;
  storage_tier?: string;
  metadata?: Record<string, unknown>;
};

export type NowcastJob = {
  job_id: string;
  status: string;
  phase: string;
  created_utc?: string;
  started_utc?: string | null;
  completed_utc?: string | null;
  run_scenario_id?: string | null;
  forcing_scenario_id?: string | null;
  cancel_requested?: boolean;
  paused?: boolean;
  process_id?: number | null;
  error?: string;
  request?: Record<string, unknown>;
  result?: {
    max_depth_m?: number;
    wet_area_km2?: number;
    mass_residual_pct?: number;
    manifest?: string;
    quicklook?: string;
  };
  outputs?: Record<string, string>;
  artifacts?: Record<string, ArtifactRecord>;
};

export type NowcastOutputs = {
  run_id: string;
  outputs: Record<string, string>;
  artifacts: Record<string, ArtifactRecord>;
};

export type TomorrowRainfallStep = {
  forecast_time_utc: string;
  lead_hour: number;
  rainfall_mm: number;
  rainfall_mm_h: number;
  precipitation_probability?: number | null;
  quality_flag: string;
};

export type TomorrowForecastResponse = {
  status: "ready" | "unavailable";
  message: string;
  forecast_id: string;
  generated_utc: string;
  source: string;
  quality_flag: string;
  location_name: string;
  latitude: number;
  longitude: number;
  forecast_hours: number;
  total_rainfall_mm?: number | null;
  max_rainfall_mm_h?: number | null;
  hyetograph_csv: string;
  manifest_json: string;
  steps: TomorrowRainfallStep[];
};

export type GisLayer = {
  layer_id: string;
  label: string;
  group: string;
  kind: string;
  source_format: string;
  geometry_type: string;
  feature_count?: number;
  size_bytes?: number;
  notes?: string;
  metadata?: {
    swatch?: string | null;
    description?: string;
    default_on?: boolean;
    overlay_opacity?: number;
    bounds?: MapBounds;
    [key: string]: unknown;
  };
  data_url: string;
  artifact_url?: string | null;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type LatestMapOverlay = {
  run_scenario_id: string;
  layer_id: string;
  label: string;
  bounds: MapBounds;
  artifact: ArtifactRecord;
  max_depth_m: number;
  opacity: number;
  source_artifact_key: string;
};

export type LatestMapOverlayResponse = {
  status: "ready" | "unavailable";
  message: string;
  overlay?: LatestMapOverlay | null;
};

export type FloodMapFrame = {
  frame_index: number;
  time_s: number;
  label: string;
  bounds: MapBounds;
  artifact: ArtifactRecord;
  max_depth_m: number;
  opacity: number;
};

export type FloodMapFramesResponse = {
  status: "ready" | "unavailable";
  message: string;
  run_scenario_id?: string | null;
  frame_count: number;
  frames: FloodMapFrame[];
};

export type MapInspectNearbyFeature = {
  feature_id: string;
  label: string;
  layer: string;
  distance_m: number;
  properties: Record<string, unknown>;
};

export type MapInspectResponse = {
  status: "ready" | "unavailable";
  message: string;
  latitude: number;
  longitude: number;
  run_scenario_id?: string | null;
  depth_m?: number | null;
  alert_level: "green" | "yellow" | "orange" | "red";
  ward?: {
    ward_id?: string | null;
    label?: string | null;
    properties: Record<string, unknown>;
  } | null;
  nearest_hotspot?: MapInspectNearbyFeature | null;
  source_artifact_key: string;
};

export type AwsObservation = {
  station_id: string;
  observed_utc: string;
  rainfall_mm: number;
  interval_minutes: number;
  hourly_rate_mm_h: number;
  quality_flag: string;
};

export type AwsStationLatest = {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  ward: string;
  source: string;
  connectivity: string;
  quality_flag: string;
  latest_observation?: AwsObservation | null;
  rainfall_1h_mm: number;
  rainfall_3h_mm: number;
  rainfall_24h_mm: number;
  trend_6h: string;
  alert_level: string;
  affected_wards_within_2km: string[];
};

export type AwsLatestResponse = {
  generated_utc: string;
  city_max_hourly_rate_mm_h: number | null;
  quality_flag: string;
  stations: AwsStationLatest[];
};

export type AwsAlert = {
  station_id: string;
  station_name: string;
  alert_level: string;
  hourly_rate_mm_h: number;
  threshold_mm_h: number;
  affected_wards_within_2km: string[];
  quality_flag: string;
};

export type AwareForecastStep = {
  forecast_time_utc: string;
  lead_hour: number;
  rainfall_mm_h: number;
  quality_flag: string;
};

export type AwareLatestResponse = {
  generated_utc: string;
  source: string;
  quality_flag: string;
  max_6h_rainfall_mm_h: number | null;
  max_forecast_rainfall_mm_h?: number | null;
  forecast_hours?: number;
  requested_forecast_hours?: number;
  recommended_model_forcing: string;
  forecast_6h: AwareForecastStep[];
};

export type AwareOfficialSourceStatus = {
  source_id: string;
  label: string;
  endpoint: string;
  method: string;
  status: string;
  quality_flag: string;
  message: string;
  updated_utc?: string | null;
  record_count: number;
};

export type AwareOfficialReservoirRecord = {
  reservoir_name: string;
  district?: string | null;
  river?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  current_level_m?: number | null;
  total_storage?: number | null;
  inflow?: number | null;
  outflow?: number | null;
  reservoir_type?: string | null;
  quality_flag: string;
};

export type AwareOfficialStormSurgeRecord = {
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  surge_height_m?: number | null;
  category?: string | null;
  station_id?: string | null;
  quality_flag: string;
};

export type AwareOfficialImdRadarAlertRecord = {
  alert_type_uuid?: string | null;
  location_uuid?: string | null;
  location_type?: string | null;
  location_name?: string | null;
  parent_name?: string | null;
  parent_type?: string | null;
  rainfall_value?: number | null;
  category?: string | null;
  distribution_category?: string | null;
  status?: string | null;
  alert_generated_utc?: string | null;
  quality_flag: string;
};

export type AwareOfficialSummary = {
  generated_utc: string;
  status: string;
  message: string;
  sources: AwareOfficialSourceStatus[];
  aws_rainfall: AwsLatestResponse;
  ecmwf_forecast: AwareLatestResponse;
  storm_surge: AwareOfficialStormSurgeRecord[];
  reservoirs: AwareOfficialReservoirRecord[];
  imd_radar_alerts: AwareOfficialImdRadarAlertRecord[];
  metadata: Record<string, unknown>;
};

export type OfficialScenario = {
  run_id: string;
  official_id: string;
  label: string;
  description: string;
  public_role: string;
  duration_minutes?: number | null;
  frame_count?: number | null;
  max_depth_m?: number | null;
  wet_area_km2?: number | null;
  rainfall_peak_mm_h?: number | null;
  budameru_peak_m3_s?: number | null;
  pipe_capture_m3?: number | null;
  pipe_surcharge_m3?: number | null;
  top_wards: Array<{
    ward_id: string;
    max_depth_m?: number | null;
    wet_area_km2?: number | null;
    persistence_min?: number | null;
    earliest_flooding_min?: number | null;
  }>;
  chat_brief: string;
  gif_artifact?: ArtifactRecord | null;
  poster_artifact?: ArtifactRecord | null;
};

export type OfficialScenarioGallery = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  release_label: string;
  method: string;
  default_run_id: string;
  scenario_count: number;
  scenarios: OfficialScenario[];
};

export type AwareSnapshotArchive = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  total: number;
  snapshots: Array<{
    snapshot_id: string;
    modified_utc: string;
    target_date: string;
    status: string;
    confidence: string;
    run_ready?: boolean | null;
    rainfall_scale_suggested?: number | null;
    stage_option_suggested: string;
    summary: string;
  }>;
};

export type ParityDownloadCenter = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  total: number;
  downloads: Array<{
    download_id: string;
    title: string;
    category: string;
    description: string;
    artifact: ArtifactRecord;
  }>;
};

export type ParitySystemStatus = {
  status: "ready" | "partial";
  message: string;
  generated_utc: string;
  completed_count: number;
  partial_count: number;
  pending_count: number;
  items: Array<{
    id: string;
    label: string;
    status: "ready" | "partial" | "pending" | "unavailable";
    detail: string;
    route: string;
  }>;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  note: string;
};

export type CurrentUser = {
  email: string;
  display_name: string;
  roles: string[];
  auth_mode: string;
};

export type DashboardCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "red" | "orange" | "yellow" | "amber" | "green";
  href: string;
  metric?: string | null;
  numeric_value?: number | null;
  unit?: string | null;
};

export type LatestModelRunSummary = {
  job_id?: string | null;
  run_scenario_id?: string | null;
  status: string;
  phase: string;
  max_depth_m?: number | null;
  wet_area_km2?: number | null;
  completed_utc?: string | null;
};

export type DashboardSummary = {
  generated_utc: string;
  mode: string;
  rainfall_quality_flag: string;
  rainfall_source: string;
  rainfall_alert_level: string;
  max_rainfall_mm_h?: number | null;
  ward_alert_threshold_m: number;
  next_forecast_refresh_utc?: string | null;
  cards: DashboardCard[];
  latest_model_run: LatestModelRunSummary;
  gis_layer_count: number;
  notes: string[];
};

export type ImpactCounts = {
  wards_total: number;
  wards_under_alert: number;
  hotspots_total: number;
  hotspots_under_alert: number;
  roads_total: number;
  roads_wet: number;
  roads_restricted: number;
  incident_candidates: number;
};

export type ImpactThresholds = {
  ward_alert_depth_m: number;
  hotspot_incident_depth_m: number;
  road_restricted_depth_m: number;
  road_closed_depth_m: number;
};

export type WardImpact = {
  ward_id: string;
  modeled_area_km2?: number | null;
  wet_area_km2: number;
  wet_area_pct?: number | null;
  max_depth_m: number;
  mean_wet_depth_m?: number | null;
  p95_wet_depth_m?: number | null;
  max_speed_mps?: number | null;
  wet_duration_minutes?: number | null;
  earliest_flooding_minutes?: number | null;
  road_segments_wet: number;
  road_segments_high: number;
  flooded_road_length_km: number;
  max_road_depth_m?: number | null;
  alert_level: "green" | "yellow" | "orange" | "red";
  alert_reasons: string[];
};

export type RoadImpact = {
  road_index?: number | null;
  road_id: string;
  locality?: string | null;
  ward_id?: string | null;
  length_m?: number | null;
  max_depth_m: number;
  max_speed_mps?: number | null;
  persistence_minutes?: number | null;
  time_to_flooding_minutes?: number | null;
  flood_class?: string | null;
  flooded_length_proxy_m: number;
  flood_priority_score?: number | null;
  flood_priority_rank?: number | null;
  passability: "open" | "caution" | "restricted" | "closed";
  alert_level: "green" | "yellow" | "orange" | "red";
};

export type HotspotImpact = {
  hotspot_id: string;
  rank?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  ward_id?: string | null;
  model_depth_m?: number | null;
  model_persistence_minutes?: number | null;
  model_time_to_flooding_minutes?: number | null;
  verification_depth_m?: number | null;
  verification_p95_depth_m?: number | null;
  area_ha?: number | null;
  estimated_impacted_area_ha: number;
  source_run?: string | null;
  alert_level: "green" | "yellow" | "orange" | "red";
  incident_candidate: boolean;
  alert_reasons: string[];
};

export type UlbImpactSummary = {
  ulb_id: string;
  ulb_name: string;
  max_depth_m: number;
  wet_area_km2: number;
  flooded_road_length_km: number;
  wards_under_alert: number;
  hotspots_under_alert: number;
  road_segments_restricted: number;
  incident_candidates: number;
  alert_level: "green" | "yellow" | "orange" | "red";
  summary_text: string;
};

export type AlertRule = {
  rule_id: string;
  label: string;
  severity: "green" | "yellow" | "orange" | "red";
  triggered: boolean;
  trigger_count: number;
  threshold: string;
  message: string;
};

export type IncidentCandidate = {
  incident_candidate_id: string;
  source_type: "hotspot" | "ward" | "road";
  source_id: string;
  title: string;
  ward_id?: string | null;
  severity: "yellow" | "orange" | "red";
  priority_score: number;
  predicted_depth_m?: number | null;
  predicted_duration_minutes?: number | null;
  recommended_action: string;
  reason: string;
};

export type OperationalImpactSummary = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  run_scenario_id?: string | null;
  source_paths: Record<string, string>;
  thresholds: ImpactThresholds;
  counts: ImpactCounts;
  ulb_summary: UlbImpactSummary;
  alert_rules: AlertRule[];
  top_wards: WardImpact[];
  top_hotspots: HotspotImpact[];
  top_roads: RoadImpact[];
  incident_candidates: IncidentCandidate[];
};

export type HotspotImpactListResponse = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  run_scenario_id?: string | null;
  total: number;
  hotspots: HotspotImpact[];
};

export type IncidentCandidateListResponse = {
  status: "ready" | "unavailable";
  message: string;
  generated_utc: string;
  run_scenario_id?: string | null;
  total: number;
  incident_candidates: IncidentCandidate[];
};

export type MisPhotoRecord = {
  photo_id: string;
  hotspot_id: string;
  stage: "before" | "after" | "field" | "other";
  filename: string;
  photo_url?: string | null;
  caption?: string | null;
  uploaded_by: string;
  uploaded_utc: string;
};

export type MisAuditEntry = {
  audit_id: string;
  hotspot_id: string;
  action_type: string;
  actor: string;
  created_utc: string;
  summary: string;
  changes: Record<string, string | number | boolean | null>;
};

export type MisHotspotRecord = {
  hotspot_id: string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  ward_id?: string | null;
  ward_name?: string | null;
  current_inundation_level: "none" | "low" | "moderate" | "severe";
  predicted_depth_m?: number | null;
  wet_duration_minutes?: number | null;
  hotspot_area_ha?: number | null;
  impact_status: "normal" | "watch" | "critical" | "resolved";
  action_status: "new" | "monitoring" | "assigned" | "in_progress" | "pump_dispatched" | "traffic_closed" | "resolved" | "closed";
  assigned_department?: string | null;
  assigned_team_user?: string | null;
  last_update_utc: string;
  source_run_id?: string | null;
  priority_score: number;
  remarks: string[];
  photos: MisPhotoRecord[];
  latest_audit?: MisAuditEntry | null;
};

export type MisRegistrySummary = {
  total_hotspots: number;
  critical_hotspots: number;
  assigned_hotspots: number;
  in_progress_hotspots: number;
  resolved_hotspots: number;
  before_photos: number;
  after_photos: number;
  latest_update_utc?: string | null;
};

export type MisHotspotListResponse = {
  generated_utc: string;
  status: "ready" | "unavailable";
  message: string;
  total: number;
  summary: MisRegistrySummary;
  hotspots: MisHotspotRecord[];
};

export type MisHotspotDetailResponse = {
  generated_utc: string;
  hotspot: MisHotspotRecord;
  audit: MisAuditEntry[];
};

export type MisActionPayload = {
  action_type: "dispatch_pump" | "close_traffic" | "assign_team" | "update_status" | "add_remark" | "resolve_incident";
  actor?: string;
  assigned_department?: string | null;
  assigned_team_user?: string | null;
  action_status?: MisHotspotRecord["action_status"] | null;
  remark?: string | null;
};

export type MisPhotoPayload = {
  stage: "before" | "after" | "field" | "other";
  filename: string;
  actor?: string;
  photo_url?: string | null;
  caption?: string | null;
};

export type MisActionResponse = {
  generated_utc: string;
  hotspot: MisHotspotRecord;
  audit_entry: MisAuditEntry;
};

export type PumpResource = {
  resource_id: string;
  name: string;
  resource_type: "fixed_pump" | "mobile_pump" | "crew";
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  capacity_mld?: number | null;
  status: "available" | "assigned" | "dispatched" | "offline" | "maintenance";
  assigned_incident_id?: string | null;
  distance_km?: number | null;
};

export type WardEngineerContact = {
  ward_id: string;
  engineer_name: string;
  phone: string;
  department: string;
  escalation_level: string;
};

export type DispatchAuditEntry = {
  audit_id: string;
  incident_id: string;
  action_type: string;
  actor: string;
  created_utc: string;
  summary: string;
  changes: Record<string, string | number | boolean | null>;
};

export type DispatchIncident = {
  incident_id: string;
  hotspot_id: string;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
  ward_id?: string | null;
  ward_name?: string | null;
  severity: "yellow" | "orange" | "red";
  status: "new" | "assigned" | "dispatched" | "in_progress" | "blocked" | "resolved" | "closed";
  assigned_department?: string | null;
  assigned_team_user?: string | null;
  engineer_contact?: WardEngineerContact | null;
  predicted_depth_m?: number | null;
  wet_duration_minutes?: number | null;
  pump_resource_id?: string | null;
  pump_start_utc?: string | null;
  pump_capacity_mld?: number | null;
  silt_clearance_progress_pct: number;
  road_block_status: "open" | "partial" | "full" | "cleared";
  created_utc: string;
  updated_utc: string;
  latest_audit?: DispatchAuditEntry | null;
};

export type DispatchSummary = {
  total_incidents: number;
  active_incidents: number;
  dispatched_incidents: number;
  resolved_incidents: number;
  available_pumps: number;
  dispatched_pumps: number;
  road_blocks: number;
  avg_silt_clearance_progress_pct: number;
};

export type DispatchIncidentListResponse = {
  generated_utc: string;
  status: "ready" | "unavailable";
  message: string;
  summary: DispatchSummary;
  incidents: DispatchIncident[];
};

export type DispatchIncidentDetailResponse = {
  generated_utc: string;
  incident: DispatchIncident;
  audit: DispatchAuditEntry[];
  nearest_pumps: PumpResource[];
};

export type PumpResourceListResponse = {
  generated_utc: string;
  total: number;
  pumps: PumpResource[];
};

export type CreateIncidentPayload = {
  actor?: string;
  assigned_department?: string | null;
  assigned_team_user?: string | null;
  remark?: string | null;
};

export type DispatchPumpPayload = {
  pump_resource_id?: string | null;
  actor?: string;
  pump_start_utc?: string | null;
  pump_capacity_mld?: number | null;
  remark?: string | null;
};

export type UpdateIncidentPayload = {
  actor?: string;
  status?: DispatchIncident["status"] | null;
  assigned_department?: string | null;
  assigned_team_user?: string | null;
  silt_clearance_progress_pct?: number | null;
  road_block_status?: DispatchIncident["road_block_status"] | null;
  remark?: string | null;
};

export type DispatchActionResponse = {
  generated_utc: string;
  incident: DispatchIncident;
  audit_entry: DispatchAuditEntry;
};

export type NearestPumpResponse = {
  generated_utc: string;
  hotspot_id?: string | null;
  incident_id?: string | null;
  pumps: PumpResource[];
};

export type DisseminationHeatmapCell = {
  cell_id: string;
  latitude: number;
  longitude: number;
  rainfall_mm_h: number;
  quality_flag: string;
  alert_level: "green" | "yellow" | "orange" | "red";
};

export type DisseminationUlb = {
  ulb_id: string;
  ulb_name: string;
  district: string;
  mandal: string;
  latitude: number;
  longitude: number;
  predicted_depth_m: number;
  duration_minutes: number;
  hotspot_area_ha: number;
  alert_level: "green" | "yellow" | "orange" | "red";
  ward_count: number;
  critical_ward_count: number;
  pdf_artifact?: ArtifactRecord | null;
};

export type DisseminationWard = {
  ulb_id: string;
  ulb_name: string;
  district: string;
  mandal: string;
  ward_id: string;
  predicted_depth_m: number;
  duration_minutes: number;
  hotspot_area_ha: number;
  alert_level: "green" | "yellow" | "orange" | "red";
};

export type OfficialMessagePreview = {
  subject: string;
  body: string;
  pdf_link: string;
  quality_flag: string;
};

export type DisseminationAuditEntry = {
  audit_id: string;
  action_type: string;
  actor: string;
  created_utc: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type DisseminationSummary = {
  generated_utc: string;
  status: "ready" | "unavailable";
  message: string;
  aware_quality_flag: string;
  aware_max_6h_rainfall_mm_h: number | null;
  heatmap_enabled_default: boolean;
  ap_view: Record<string, unknown>;
  heatmap_cells: DisseminationHeatmapCell[];
  ulbs: DisseminationUlb[];
  wards: DisseminationWard[];
  official_message: OfficialMessagePreview;
  latest_pdf_artifact?: ArtifactRecord | null;
  audit: DisseminationAuditEntry[];
};

export type GenerateWardPdfPayload = {
  actor?: string;
  ulb_id?: string;
  ward_ids?: string[] | null;
};

export type GenerateWardPdfResponse = {
  generated_utc: string;
  artifact: ArtifactRecord;
  official_message: OfficialMessagePreview;
  audit_entry: DisseminationAuditEntry;
};

export type DisseminationActionPayload = {
  actor?: string;
  action_type: "send" | "export" | "approve_draft";
  channel: "manual_export" | "email" | "sms" | "whatsapp" | "dashboard";
  recipients?: string[];
  artifact_id?: string | null;
  note?: string | null;
};

export type DisseminationActionResponse = {
  generated_utc: string;
  audit_entry: DisseminationAuditEntry;
  official_message: OfficialMessagePreview;
};

export type ReportTypeId = "ward_alert" | "ulb_summary" | "daily_executive" | "model_run" | "incident_action";

export type ReportTypeDescriptor = {
  report_type: ReportTypeId;
  title: string;
  description: string;
  cadence: string;
  latest_artifact?: ArtifactRecord | null;
};

export type ReportSummary = {
  generated_utc: string;
  status: "ready" | "unavailable";
  message: string;
  run_scenario_id?: string | null;
  report_types: ReportTypeDescriptor[];
  latest_artifacts: ArtifactRecord[];
  data_sources: Record<string, string>;
  quality_flags: Record<string, string>;
  metrics: Record<string, string | number | boolean | null>;
};

export type GenerateReportPayload = {
  report_type: ReportTypeId;
  actor?: string;
  note?: string | null;
};

export type GenerateReportResponse = {
  generated_utc: string;
  report_type: ReportTypeId;
  title: string;
  message: string;
  artifact: ArtifactRecord;
  metadata: Record<string, unknown>;
};
