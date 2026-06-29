import React from "react";
import { Mountain, PauseCircle, PlayCircle, Satellite } from "lucide-react";
import {
  fetchAwsLatest,
  fetchFloodMapFrames,
  fetchGisLayerData,
  fetchGisLayers,
  fetchLatestMapOverlay,
  fetchMapInspection,
  googleMapsApiKey,
  googleMapsConfigured,
  toApiUrl
} from "../../services/api";
import { floodGoogleMapStyles, loadGoogleMaps, visibleFloodOverlayOpacity } from "../../services/googleMaps";
import type { AwsStationLatest, FloodMapFrame, GisLayer, LatestMapOverlay, MapInspectResponse } from "../../types/api";
import { FloodDepthLegend } from "../FloodDepthLegend/FloodDepthLegend";
import styles from "./OperationalMap.module.css";

type SelectedItem = {
  title: string;
  subtitle: string;
  properties: Record<string, unknown>;
};

type MapType = "terrain" | "satellite";
type HoverPoint = { latitude: number; longitude: number; x: number; y: number };

const defaultLayerIds = ["wards", "municipal_boundary", "drainage", "pumps", "water_krishna", "water_budameru", "hotspots"];

export function OperationalMap() {
  const mapStageRef = React.useRef<HTMLDivElement | null>(null);
  const mapElementRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const featuresByLayerRef = React.useRef<Map<string, any[]>>(new Map());
  const imageOverlaysByLayerRef = React.useRef<Map<string, any>>(new Map());
  const stationMarkersRef = React.useRef<any[]>([]);
  const overlayRef = React.useRef<any>(null);
  const overlayFitDoneRef = React.useRef(false);

  const [layers, setLayers] = React.useState<GisLayer[]>([]);
  const [enabledLayers, setEnabledLayers] = React.useState<string[]>(defaultLayerIds);
  const [loadedLayers, setLoadedLayers] = React.useState<string[]>([]);
  const [stationsVisible, setStationsVisible] = React.useState(true);
  const [awsStations, setAwsStations] = React.useState<AwsStationLatest[]>([]);
  const [modelOverlayVisible, setModelOverlayVisible] = React.useState(true);
  const [latestOverlay, setLatestOverlay] = React.useState<LatestMapOverlay | null>(null);
  const [floodFrames, setFloodFrames] = React.useState<FloodMapFrame[]>([]);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [mapType, setMapType] = React.useState<MapType>("terrain");
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const [hoverPoint, setHoverPoint] = React.useState<HoverPoint | null>(null);
  const [hoverInspect, setHoverInspect] = React.useState<MapInspectResponse | null>(null);
  const [message, setMessage] = React.useState("Loading map resources...");
  const [mapReady, setMapReady] = React.useState(false);

  const inspectPoint = React.useCallback((latitude: number, longitude: number) => {
    setMessage("Inspecting flood depth and ward context...");
    fetchMapInspection(latitude, longitude)
      .then((payload) => {
        setSelectedItem(mapInspectionToSelectedItem(payload));
        setMessage(payload.status === "ready" ? "Point inspection is ready." : payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Unable to inspect this map point."));
  }, []);

  React.useEffect(() => {
    Promise.all([fetchGisLayers(), fetchLatestMapOverlay(), fetchFloodMapFrames()])
      .then(([layerPayload, overlayPayload, framePayload]) => {
        setLayers(layerPayload.layers);
        const defaultIds = Array.from(
          new Set([...layerPayload.layers.filter(shouldEnableByDefault).map((layer) => layer.layer_id), ...defaultLayerIds])
        );
        setEnabledLayers(defaultIds.length ? defaultIds : defaultLayerIds);
        setLatestOverlay(overlayPayload.overlay || null);
        setFloodFrames(framePayload.frames || []);
        setFrameIndex(0);
        const frameMessage = floodFrameMessage(framePayload.status, framePayload.frame_count, framePayload.message);
        setMessage(overlayPayload.status === "ready" ? `GIS catalog loaded. ${frameMessage}` : overlayPayload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Unable to load map resources."));
    fetchAwsLatest()
      .then((payload) => setAwsStations(payload.stations || []))
      .catch(() => setAwsStations([]));
  }, []);

  React.useEffect(() => {
    if (!googleMapsConfigured || !googleMapsApiKey) {
      setMessage("Google Maps API key is not configured.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(googleMapsApiKey)
      .then((google) => {
        if (cancelled || !mapElementRef.current || mapRef.current) {
          return;
        }
        const map = new google.maps.Map(mapElementRef.current, {
          center: { lat: 16.5062, lng: 80.648 },
          zoom: 12,
          mapTypeId: "terrain",
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          styles: floodGoogleMapStyles
        });
        map.data.setStyle((feature: any) => styleFeature(feature, google));
        map.data.addListener("click", (event: any) => {
          const point = pointFromFeature(event.feature);
          if (point) {
            inspectPoint(point.latitude, point.longitude);
            return;
          }
          setSelectedItem(featureToSelectedItem(event.feature));
        });
        map.addListener("click", (event: any) => {
          const point = event.latLng;
          if (!point) {
            return;
          }
          inspectPoint(point.lat(), point.lng());
        });
        map.addListener("mousemove", (event: any) => {
          const point = event.latLng;
          if (!point || !event.domEvent || !mapStageRef.current) {
            return;
          }
          const rect = mapStageRef.current.getBoundingClientRect();
          const domEvent = event.domEvent as MouseEvent;
          setHoverPoint({
            latitude: point.lat(),
            longitude: point.lng(),
            x: Math.min(Math.max(domEvent.clientX - rect.left, 12), rect.width - 12),
            y: Math.min(Math.max(domEvent.clientY - rect.top, 12), rect.height - 12)
          });
        });
        map.addListener("mouseout", () => {
          setHoverPoint(null);
          setHoverInspect(null);
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((error: Error) => setMessage(error.message || "Google Maps failed to load."));
    return () => {
      cancelled = true;
    };
  }, [inspectPoint]);

  React.useEffect(() => {
    if (!hoverPoint) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchMapInspection(hoverPoint.latitude, hoverPoint.longitude, controller.signal)
        .then((payload) => setHoverInspect(payload))
        .catch(() => {
          if (!controller.signal.aborted) {
            setHoverInspect(null);
          }
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [hoverPoint?.latitude, hoverPoint?.longitude]);

  React.useEffect(() => {
    if (mapReady && mapRef.current) {
      mapRef.current.setMapTypeId(mapType);
    }
  }, [mapReady, mapType]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps || !layers.length) {
      return;
    }
    const map = mapRef.current;
    const featureMap = featuresByLayerRef.current;
    const overlayMap = imageOverlaysByLayerRef.current;
    const google = window.google;

    for (const [layerId, features] of featureMap.entries()) {
      if (!enabledLayers.includes(layerId)) {
        features.forEach((feature) => map.data.remove(feature));
        featureMap.delete(layerId);
        setLoadedLayers((current) => current.filter((id) => id !== layerId));
      }
    }

    for (const [layerId, overlay] of overlayMap.entries()) {
      if (!enabledLayers.includes(layerId)) {
        overlay.setMap(null);
        overlayMap.delete(layerId);
        setLoadedLayers((current) => current.filter((id) => id !== layerId));
      }
    }

    layers
      .filter((layer) => enabledLayers.includes(layer.layer_id) && isImageOverlayLayer(layer) && !overlayMap.has(layer.layer_id))
      .forEach((layer) => {
        const bounds = layer.metadata?.bounds;
        if (!bounds || !layer.artifact_url) {
          return;
        }
        const googleBounds = new google.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east }
        );
        const overlay = new google.maps.GroundOverlay(toApiUrl(layer.artifact_url), googleBounds, {
          opacity: imageOverlayOpacity(layer)
        });
        overlay.setMap(map);
        overlayMap.set(layer.layer_id, overlay);
        setLoadedLayers((current) => Array.from(new Set([...current, layer.layer_id])));
      });

    layers
      .filter((layer) => enabledLayers.includes(layer.layer_id) && !isImageOverlayLayer(layer) && !featureMap.has(layer.layer_id))
      .forEach((layer) => {
        fetchGisLayerData(layer.layer_id)
          .then((geojson) => {
            if (!mapRef.current || !enabledLayers.includes(layer.layer_id)) {
              return;
            }
            const prepared = tagGeoJson(geojson, layer);
            const added = isEmptyFeatureCollection(prepared) ? [] : map.data.addGeoJson(prepared);
            featureMap.set(layer.layer_id, added);
            setLoadedLayers((current) => Array.from(new Set([...current, layer.layer_id])));
          })
          .catch((error: Error) => setMessage(`${layer.label}: ${error.message}`));
      });
  }, [enabledLayers, layers, mapReady]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    stationMarkersRef.current.forEach((marker) => marker.setMap(null));
    stationMarkersRef.current = [];
    if (!stationsVisible || !awsStations.length) {
      return;
    }
    stationMarkersRef.current = awsStations.map((station) => {
      const rate = station.latest_observation?.hourly_rate_mm_h || 0;
      const marker = new google.maps.Marker({
        position: { lat: station.latitude, lng: station.longitude },
        map: mapRef.current,
        title: station.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: rate >= 30 ? "#fb923c" : "#22d3ee",
          fillOpacity: 0.95,
          strokeColor: "#0f172a",
          strokeWeight: 2
        }
      });
      marker.addListener("click", () => {
        setSelectedItem({
          title: station.name,
          subtitle: "AWS station telemetry",
          properties: station
        });
      });
      return marker;
    });
  }, [awsStations, mapReady, stationsVisible]);

  const currentFrame = floodFrames[Math.min(frameIndex, Math.max(floodFrames.length - 1, 0))] || null;
  const activeOverlay = currentFrame || latestOverlay;

  React.useEffect(() => {
    if (floodFrames.length <= 1) {
      setIsPlaying(false);
      setFrameIndex(0);
      return;
    }
    setFrameIndex((current) => Math.min(current, floodFrames.length - 1));
  }, [floodFrames.length]);

  React.useEffect(() => {
    if (!isPlaying || floodFrames.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % floodFrames.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [floodFrames.length, isPlaying]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
    if (!modelOverlayVisible || !activeOverlay) {
      setIsPlaying(false);
      return;
    }
    const google = window.google;
    const bounds = new google.maps.LatLngBounds(
      { lat: activeOverlay.bounds.south, lng: activeOverlay.bounds.west },
      { lat: activeOverlay.bounds.north, lng: activeOverlay.bounds.east }
    );
    overlayRef.current = new google.maps.GroundOverlay(toApiUrl(activeOverlay.artifact.artifact_url), bounds, {
      opacity: visibleFloodOverlayOpacity(activeOverlay.opacity)
    });
    overlayRef.current.setMap(mapRef.current);
    if (!overlayFitDoneRef.current) {
      mapRef.current.fitBounds(bounds);
      overlayFitDoneRef.current = true;
    }
  }, [activeOverlay, mapReady, modelOverlayVisible]);

  const layerGroups = groupLayers(layers);

  return (
    <section className={styles.shell}>
      <aside className={styles.layerPanel}>
        <div className={styles.panelHeader}>
          <strong>Layer Control</strong>
          <span>{loadedLayers.length} active</span>
        </div>

        <label className={styles.toggleRow}>
          <input checked={modelOverlayVisible} type="checkbox" onChange={(event) => setModelOverlayVisible(event.currentTarget.checked)} />
          <span>Flood animation layer</span>
        </label>
        <label className={styles.toggleRow}>
          <input checked={stationsVisible} type="checkbox" onChange={(event) => setStationsVisible(event.currentTarget.checked)} />
          <span>AWS stations</span>
        </label>

        {Object.entries(layerGroups).map(([group, groupLayers]) => (
          <div className={styles.layerGroup} key={group}>
            <h2>{group}</h2>
            {groupLayers.map((layer) => (
              <label className={styles.layerRow} key={layer.layer_id}>
                <input
                  checked={enabledLayers.includes(layer.layer_id)}
                  type="checkbox"
                  onChange={() => setEnabledLayers((current) => toggleValue(current, layer.layer_id))}
                />
                <i
                  className={styles.layerSwatch}
                  style={{ background: layer.metadata?.swatch || "#94a3b8" }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{layer.label}</strong>
                  <small>{layerDetail(layer)}</small>
                </span>
              </label>
            ))}
          </div>
        ))}
      </aside>

      <div className={styles.mapStage} ref={mapStageRef}>
        <div className={styles.mapCanvas} ref={mapElementRef}>
          {!googleMapsConfigured ? <span>Google Maps API key is required for Phase 8 map rendering.</span> : null}
        </div>
        {hoverPoint ? <HoverInspection point={hoverPoint} inspection={hoverInspect} /> : null}
        <div className={styles.mapStatus}>{message}</div>
        {activeOverlay ? (
          <div className={styles.overlayBadge}>
            <strong>{activeOverlay.label}</strong>
            <span>{activeOverlay.max_depth_m.toFixed(2)} m max depth</span>
          </div>
        ) : null}
        {activeOverlay ? <FloodDepthLegend label="Maximum depth, metres" maxDepth={activeOverlay.max_depth_m} /> : null}
        {modelOverlayVisible && floodFrames.length ? (
          <div className={styles.animationControls}>
            <button
              type="button"
              disabled={floodFrames.length <= 1}
              aria-label={isPlaying ? "Pause flood animation" : "Play flood animation"}
              onClick={() => setIsPlaying((value) => !value)}
            >
              {isPlaying ? <PauseCircle aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
            </button>
            <span>{currentFrame?.label || "Flood frame"}</span>
            <input
              aria-label="Flood animation time"
              disabled={floodFrames.length <= 1}
              max={Math.max(floodFrames.length - 1, 0)}
              min={0}
              step={1}
              type="range"
              value={Math.min(frameIndex, Math.max(floodFrames.length - 1, 0))}
              onChange={(event) => {
                setIsPlaying(false);
                setFrameIndex(Number(event.currentTarget.value));
              }}
            />
            <strong>{`${Math.min(frameIndex + 1, floodFrames.length)}/${floodFrames.length}`}</strong>
          </div>
        ) : null}
        <div className={styles.mapTypeControls} aria-label="Map base view">
          <button
            type="button"
            className={mapType === "terrain" ? styles.mapTypeActive : undefined}
            onClick={() => setMapType("terrain")}
          >
            <Mountain aria-hidden="true" />
            Terrain
          </button>
          <button
            type="button"
            className={mapType === "satellite" ? styles.mapTypeActive : undefined}
            onClick={() => setMapType("satellite")}
          >
            <Satellite aria-hidden="true" />
            Satellite
          </button>
        </div>
      </div>

      <aside className={styles.inspectPanel}>
        <div className={styles.panelHeader}>
          <strong>Inspector</strong>
          <span>{selectedItem ? "selected" : "ready"}</span>
        </div>
        {selectedItem ? (
          <div className={styles.featureDetails}>
            <h2>{selectedItem.title}</h2>
            <p>{selectedItem.subtitle}</p>
            <dl>
              {Object.entries(selectedItem.properties)
                .filter(([key]) => !key.startsWith("__"))
                .slice(0, 12)
                .map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt>{key}</dt>
                    <dd>{formatValue(value)}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </div>
        ) : (
          <div className={styles.emptyInspect}>
            <strong>Click a ward, hotspot, pump, river segment, or AWS station.</strong>
            <span>Feature details, alert context, and quality flags will appear here.</span>
          </div>
        )}
      </aside>
    </section>
  );
}

function HoverInspection(props: { point: HoverPoint; inspection: MapInspectResponse | null }) {
  const depth = props.inspection?.depth_m;
  const wardLabel = props.inspection?.ward?.label || props.inspection?.ward?.ward_id || "outside ward";
  return (
    <div
      className={styles.hoverInspect}
      style={{ left: props.point.x, top: props.point.y }}
      aria-live="polite"
    >
      <strong>{depth === null || depth === undefined ? "--" : `${depth.toFixed(2)} m`}</strong>
      <span>{wardLabel}</span>
      <small>{`${props.point.latitude.toFixed(5)}, ${props.point.longitude.toFixed(5)}`}</small>
    </div>
  );
}

function tagGeoJson(geojson: Record<string, unknown>, layer: GisLayer) {
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return {
    ...geojson,
    features: features.map((feature: any) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        __layer_id: layer.layer_id,
        __layer_label: layer.label,
        __layer_group: layer.group
      }
    }))
  };
}

function isEmptyFeatureCollection(geojson: Record<string, unknown>) {
  return geojson.type === "FeatureCollection" && Array.isArray(geojson.features) && geojson.features.length === 0;
}

function styleFeature(feature: any, google: any) {
  const group = String(feature.getProperty("__layer_group") || "").toLowerCase();
  const layerId = String(feature.getProperty("__layer_id") || "");
  if (layerId === "hotspots") {
    return pointStyle(google, "#dc2626", 9);
  }
  if (["pumps", "sewerage_pumping_stations"].includes(layerId)) {
    return pointStyle(google, "#22c55e", 6);
  }
  if (["candidate_outfalls", "coupling_exchange_points", "control_sections"].includes(layerId)) {
    return pointStyle(google, "#f97316", 5);
  }
  if (["manholes", "sewerage_treatment_plants"].includes(layerId)) {
    return pointStyle(google, "#64748b", 4);
  }
  if (group.includes("administrative")) {
    return { strokeColor: "#38bdf8", strokeWeight: 1.4, fillColor: "#0ea5e9", fillOpacity: 0.06 };
  }
  if (group.includes("urban") || group.includes("drainage") || group.includes("coupling")) {
    return { strokeColor: "#fbbf24", strokeWeight: layerId === "roads" ? 0.6 : 1.4, fillOpacity: 0 };
  }
  if (group.includes("water")) {
    return { strokeColor: "#22d3ee", strokeWeight: 1.3, fillColor: "#0891b2", fillOpacity: 0.18 };
  }
  if (group.includes("hazard") || group.includes("aware")) {
    return { strokeColor: "#f97316", strokeWeight: 2, fillColor: "#f97316", fillOpacity: 0.1 };
  }
  if (group.includes("model") || group.includes("terrain") || group.includes("exposure")) {
    return { strokeColor: "#16a34a", strokeWeight: 1.1, fillColor: "#22c55e", fillOpacity: 0.08 };
  }
  return { strokeColor: "#cbd5e1", strokeWeight: 1, fillOpacity: 0.08 };
}

function pointStyle(google: any, color: string, scale: number) {
  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 0.95,
      strokeColor: "#0f172a",
      strokeWeight: 1.5
    }
  };
}

function featureToSelectedItem(feature: any): SelectedItem {
  const properties: Record<string, unknown> = {};
  feature.forEachProperty((value: unknown, key: string) => {
    properties[key] = value;
  });
  const layerLabel = String(properties.__layer_label || "GIS Feature");
  const title = String(
    properties.name ||
      properties.Name ||
      properties.ward_id ||
      properties.hotspot_id ||
      properties.id ||
      layerLabel
  );
  const group = String(properties.__layer_group || "gis");
  return { title, subtitle: `${layerLabel} · ${group}`, properties };
}

function pointFromFeature(feature: any): { latitude: number; longitude: number } | null {
  const geometry = feature.getGeometry?.();
  if (!geometry || geometry.getType?.() !== "Point") {
    return null;
  }
  const point = geometry.get?.();
  if (!point) {
    return null;
  }
  return { latitude: point.lat(), longitude: point.lng() };
}

function mapInspectionToSelectedItem(inspection: MapInspectResponse): SelectedItem {
  const wardLabel = inspection.ward?.label || inspection.ward?.ward_id || "Outside mapped ward";
  const depthText = inspection.depth_m === null || inspection.depth_m === undefined ? "No model depth" : `${inspection.depth_m.toFixed(3)} m`;
  const nearestHotspot = inspection.nearest_hotspot
    ? `${inspection.nearest_hotspot.label} (${inspection.nearest_hotspot.distance_m.toFixed(0)} m away)`
    : "--";
  return {
    title: `${depthText} at selected point`,
    subtitle: `${wardLabel} · ${inspection.alert_level.toUpperCase()} depth class`,
    properties: {
      depth_m: inspection.depth_m,
      alert_level: inspection.alert_level,
      ward: wardLabel,
      ward_id: inspection.ward?.ward_id || "--",
      latitude: inspection.latitude,
      longitude: inspection.longitude,
      nearest_hotspot: nearestHotspot,
      run_scenario_id: inspection.run_scenario_id || "--",
      source: inspection.source_artifact_key,
      message: inspection.message
    }
  };
}

function groupLayers(layers: GisLayer[]) {
  return layers.reduce<Record<string, GisLayer[]>>((groups, layer) => {
    const key = layer.group || "other";
    groups[key] = groups[key] || [];
    groups[key].push(layer);
    return groups;
  }, {});
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function shouldEnableByDefault(layer: GisLayer) {
  if (typeof layer.metadata?.default_on === "boolean") {
    return layer.metadata.default_on;
  }
  return defaultLayerIds.includes(layer.layer_id);
}

function isImageOverlayLayer(layer: GisLayer) {
  return layer.kind === "image" || layer.source_format === "image_overlay";
}

function imageOverlayOpacity(layer: GisLayer) {
  const opacity = layer.metadata?.overlay_opacity;
  if (typeof opacity === "number" && Number.isFinite(opacity)) {
    return Math.min(0.9, Math.max(0.35, opacity));
  }
  return 0.72;
}

function layerDetail(layer: GisLayer) {
  if (isImageOverlayLayer(layer)) {
    return layer.geometry_type || "same-extent overlay";
  }
  const count = layer.feature_count;
  if (count === null || count === undefined) {
    return layer.geometry_type || "--";
  }
  if (count === 0) {
    return `${layer.geometry_type || layer.source_format || "layer"} · empty`;
  }
  return `${count.toLocaleString()} features`;
}

function floodFrameMessage(status: string, frameCount: number, message: string) {
  if (status !== "ready") {
    return message;
  }
  if (frameCount <= 0) {
    return "Flood map is ready but no frame artifacts are available.";
  }
  return `Flood animation loaded: ${frameCount} frame${frameCount === 1 ? "" : "s"}.`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
