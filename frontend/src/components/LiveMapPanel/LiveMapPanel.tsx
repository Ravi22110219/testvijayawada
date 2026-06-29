import React from "react";
import { ExternalLink, Layers, Map as MapIcon, Mountain, PauseCircle, PlayCircle, Satellite } from "lucide-react";
import {
  fetchAwsLatest,
  fetchFloodMapFrames,
  fetchGisLayerData,
  fetchGisLayers,
  googleMapsApiKey,
  toApiUrl
} from "../../services/api";
import { floodGoogleMapStyles, loadGoogleMaps, visibleFloodOverlayOpacity } from "../../services/googleMaps";
import type { AwsStationLatest, FloodMapFrame, GisLayer } from "../../types/api";
import { FloodDepthLegend } from "../FloodDepthLegend/FloodDepthLegend";
import styles from "./LiveMapPanel.module.css";

type OptionalLayerKey = "wards" | "hotspots" | "aws";
type MapType = "terrain" | "satellite" | "carto_voyager";
const CARTO_VOYAGER_MAP_TYPE = "carto_voyager";
const WARD_MARKER_SOURCE_LAYER_ID = "__ward_marker_source";
const PLACE_LABEL_MIN_ZOOM = 13;
const liveLayerOrder = [
  "wards",
  "municipal_boundary",
  "roads",
  "drainage",
  "manholes",
  "pumps",
  "sewerage_network",
  "sewerage_pumping_stations",
  "sewerage_treatment_plants",
  "water_krishna",
  "water_budameru",
  "water_reservoir",
  "water_network",
  "major_canals_osm",
  "budameru_osm_waterways",
  "flow_arrows",
  "candidate_outfalls",
  "control_sections",
  "coupling_exchange_points",
  "pump_to_drain_connectors",
  "pump_to_waterbody_connectors",
  "budameru_breach_segments",
  "anuga_domain",
  "mesh_refinement_zones",
  "contours_1m",
  "building_density_grid",
  "exposure_refinement_zones",
  "urban_ward_routine",
  "hotspots"
];

const vijayawadaPlaceLabels = [
  { name: "Vijayawada", latitude: 16.5062, longitude: 80.648 },
  { name: "Governorpet", latitude: 16.5159, longitude: 80.6336 },
  { name: "Benz Circle", latitude: 16.4997, longitude: 80.6506 },
  { name: "Moghalrajpuram", latitude: 16.5127, longitude: 80.6391 },
  { name: "Patamata", latitude: 16.5016, longitude: 80.6692 },
  { name: "Krishna Lanka", latitude: 16.4966, longitude: 80.6257 },
  { name: "Bhavanipuram", latitude: 16.5234, longitude: 80.5945 },
  { name: "One Town", latitude: 16.5173, longitude: 80.6175 },
  { name: "Satyanarayana Puram", latitude: 16.5264, longitude: 80.6422 },
  { name: "Ramalingeswara Nagar", latitude: 16.4896, longitude: 80.6517 },
  { name: "Ajit Singh Nagar", latitude: 16.5393, longitude: 80.6322 },
  { name: "Gunadala", latitude: 16.5221, longitude: 80.6723 },
  { name: "Auto Nagar", latitude: 16.4957, longitude: 80.6855 },
  { name: "Payakapuram", latitude: 16.5439, longitude: 80.6533 }
];

type AlertMapItem = {
  ward_id: string;
  alert_level?: string;
  max_depth_m?: number | null;
  wet_area_km2?: number | null;
};

type HotspotMapItem = {
  hotspot_id: string;
  latitude?: number | null;
  longitude?: number | null;
  ward_id?: string | null;
  alert_level?: string;
  model_depth_m?: number | null;
};

export type LiveMapPanelHandle = {
  zoomToLocation: (target: { latitude?: number | null; longitude?: number | null; label?: string; zoom?: number }) => void;
  zoomToWard: (target: { wardId?: string | null; label?: string }) => void;
};

export const LiveMapPanel = React.forwardRef<LiveMapPanelHandle, {
  googleMapsConfigured: boolean;
  refreshKey?: string;
  variant?: "card" | "landing";
  topOverlay?: React.ReactNode;
  runId?: string | null;
  showAws?: boolean;
  showHotspots?: boolean;
  initialOptionalLayers?: Partial<Record<OptionalLayerKey, boolean>>;
  alertMarkers?: AlertMapItem[];
  hotspotMarkers?: HotspotMapItem[];
}>(function LiveMapPanel(props, ref) {
  const mapElementRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const floodOverlayRef = React.useRef<any>(null);
  const infoWindowRef = React.useRef<any>(null);
  const selectedFeatureRef = React.useRef<any>(null);
  const featuresByLayerRef = React.useRef<Map<string, any[]>>(new Map());
  const imageOverlaysByLayerRef = React.useRef<Map<string, any>>(new Map());
  const awsMarkersRef = React.useRef<any[]>([]);
  const alertMarkersRef = React.useRef<any[]>([]);
  const hotspotMarkersRef = React.useRef<any[]>([]);
  const alertPulseRefs = React.useRef<any[]>([]);
  const hotspotPulseRefs = React.useRef<any[]>([]);
  const placeLabelMarkersRef = React.useRef<any[]>([]);
  const overlayFitDoneRef = React.useRef(false);

  const [frames, setFrames] = React.useState<FloodMapFrame[]>([]);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [mapType, setMapType] = React.useState<MapType>("carto_voyager");
  const [mapZoom, setMapZoom] = React.useState(12);
  const [mapReady, setMapReady] = React.useState(false);
  const [layerMenuOpen, setLayerMenuOpen] = React.useState(false);
  const [vectorLayerVersion, setVectorLayerVersion] = React.useState(0);
  const [gisLayers, setGisLayers] = React.useState<GisLayer[]>([]);
  const [optionalLayers, setOptionalLayers] = React.useState<Record<string, boolean>>({
    wards: props.initialOptionalLayers?.wards ?? true,
    hotspots: props.initialOptionalLayers?.hotspots ?? Boolean(props.showHotspots),
    aws: props.initialOptionalLayers?.aws ?? (props.showAws ?? props.variant !== "landing")
  });
  const [awsStations, setAwsStations] = React.useState<AwsStationLatest[]>([]);
  const [message, setMessage] = React.useState("Loading latest flood map...");

  React.useImperativeHandle(ref, () => ({
    zoomToLocation: (target) => {
      if (!mapRef.current || !window.google?.maps || target.latitude === null || target.latitude === undefined || target.longitude === null || target.longitude === undefined) {
        return;
      }
      const latLng = new window.google.maps.LatLng(target.latitude, target.longitude);
      mapRef.current.panTo(latLng);
      mapRef.current.setZoom(target.zoom || 15);
      if (!infoWindowRef.current) {
        infoWindowRef.current = new window.google.maps.InfoWindow();
      }
      infoWindowRef.current.setContent(`<strong>${escapeHtml(target.label || "Selected hotspot")}</strong>`);
      infoWindowRef.current.setPosition(latLng);
      infoWindowRef.current.open({ map: mapRef.current });
    },
    zoomToWard: (target) => {
      if (!mapRef.current || !window.google?.maps || !target.wardId) {
        return;
      }
      const wardFeature = (featuresByLayerRef.current.get("wards") || []).find((feature) => {
        const wardNo = feature.getProperty("REV_WRD_NO") || feature.getProperty("ward_id") || feature.getProperty("WARD_NO");
        return String(wardNo) === String(target.wardId);
      }) || findWardFeature(featuresByLayerRef.current.get(WARD_MARKER_SOURCE_LAYER_ID) || [], target.wardId);
      if (!wardFeature) {
        return;
      }
      handleFeatureClick(
        wardFeature,
        centerForFeature(wardFeature, window.google),
        mapRef.current,
        window.google,
        selectedFeatureRef,
        infoWindowRef,
        target.label
      );
    }
  }));

  React.useEffect(() => {
    overlayFitDoneRef.current = false;
    setMessage(props.runId ? `Loading flood map for ${props.runId}...` : "Loading latest flood map...");
    fetchFloodMapFrames(props.runId)
      .then((payload) => {
        setFrames(payload.frames || []);
        setFrameIndex(0);
        setMessage(payload.status === "ready" ? `Flood frames loaded: ${payload.frame_count}` : payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Flood frames unavailable."));
    if (props.showAws ?? props.variant !== "landing") {
      fetchAwsLatest()
        .then((payload) => setAwsStations(payload.stations || []))
        .catch(() => setAwsStations([]));
    } else {
      setAwsStations([]);
    }
  }, [props.refreshKey, props.runId, props.showAws, props.variant]);

  React.useEffect(() => {
    fetchGisLayers()
      .then((payload) => {
        const orderedLayers = orderLiveLayers(payload.layers || []);
        setGisLayers(orderedLayers);
        setOptionalLayers((current) => {
          const next = { ...current };
          orderedLayers.forEach((layer) => {
            if (next[layer.layer_id] === undefined) {
              next[layer.layer_id] = layer.layer_id === "wards";
            }
          });
          return next;
        });
      })
      .catch((error: Error) => setMessage(error.message || "Static GIS layer catalog unavailable."));
  }, []);

  React.useEffect(() => {
    if (!props.googleMapsConfigured || !googleMapsApiKey) {
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
          mapTypeId: CARTO_VOYAGER_MAP_TYPE,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
          styles: floodGoogleMapStyles
        });
        registerCartoVoyagerMapType(map, google);
        map.data.setStyle((feature: any) => previewFeatureStyle(feature, google));
        map.addListener("zoom_changed", () => setMapZoom(map.getZoom() || 12));
        map.data.addListener("click", (event: any) =>
          handleFeatureClick(event.feature, event.latLng, map, google, selectedFeatureRef, infoWindowRef)
        );
        map.data.addListener("mouseover", (event: any) => {
          if (event.feature !== selectedFeatureRef.current && String(event.feature.getProperty("__layer_id") || "") === "wards") {
            map.data.overrideStyle(event.feature, wardBoundaryStyle(true));
          }
        });
        map.data.addListener("mouseout", (event: any) => {
          if (event.feature !== selectedFeatureRef.current && String(event.feature.getProperty("__layer_id") || "") === "wards") {
            map.data.revertStyle(event.feature);
          }
        });
        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapZoom(map.getZoom() || 12);
        setMapReady(true);
      })
      .catch((error: Error) => setMessage(error.message || "Google Maps failed to load."));
    return () => {
      cancelled = true;
    };
  }, [props.googleMapsConfigured]);

  const currentFrame = frames[Math.min(frameIndex, Math.max(frames.length - 1, 0))] || null;

  React.useEffect(() => {
    if (mapReady && mapRef.current) {
      mapRef.current.setMapTypeId(mapType);
    }
  }, [mapReady, mapType]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    placeLabelMarkersRef.current.forEach((marker) => marker.setMap(null));
    placeLabelMarkersRef.current = [];
    if (mapType !== "carto_voyager" || mapZoom < PLACE_LABEL_MIN_ZOOM) {
      return;
    }
    placeLabelMarkersRef.current = vijayawadaPlaceLabels.map((place) =>
      new google.maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapRef.current,
        clickable: false,
        optimized: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
          fillOpacity: 0,
          strokeOpacity: 0
        },
        label: {
          text: place.name,
          color: "#1f2937",
          fontSize: "12px",
          fontWeight: "800"
        }
      })
    );
  }, [mapReady, mapType, mapZoom]);

  React.useEffect(() => {
    if (frames.length <= 1) {
      setIsPlaying(false);
      setFrameIndex(0);
      return;
    }
    setFrameIndex((current) => Math.min(current, frames.length - 1));
  }, [frames.length]);

  React.useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [frames.length, isPlaying]);

  React.useEffect(() => {
    if (!currentFrame || !mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    const bounds = new google.maps.LatLngBounds(
      { lat: currentFrame.bounds.south, lng: currentFrame.bounds.west },
      { lat: currentFrame.bounds.north, lng: currentFrame.bounds.east }
    );
    if (floodOverlayRef.current) {
      floodOverlayRef.current.setMap(null);
    }
    floodOverlayRef.current = new google.maps.GroundOverlay(toApiUrl(currentFrame.artifact.artifact_url), bounds, {
      opacity: visibleFloodOverlayOpacity(currentFrame.opacity)
    });
    floodOverlayRef.current.setMap(mapRef.current);
    if (!overlayFitDoneRef.current) {
      mapRef.current.fitBounds(bounds);
      overlayFitDoneRef.current = true;
    }
  }, [currentFrame, mapReady]);

  React.useEffect(() => {
    setOptionalLayers((current) => ({
      ...current,
      aws: props.initialOptionalLayers?.aws ?? (props.showAws ?? props.variant !== "landing"),
      hotspots: props.initialOptionalLayers?.hotspots ?? Boolean(props.showHotspots)
    }));
  }, [props.initialOptionalLayers?.aws, props.initialOptionalLayers?.hotspots, props.showAws, props.showHotspots, props.variant]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || featuresByLayerRef.current.has(WARD_MARKER_SOURCE_LAYER_ID)) {
      return;
    }
    if (!(props.alertMarkers?.length || props.hotspotMarkers?.some((hotspot) => hotspot.ward_id))) {
      return;
    }
    fetchGisLayerData("wards")
      .then((geojson) => {
        if (!mapRef.current || featuresByLayerRef.current.has(WARD_MARKER_SOURCE_LAYER_ID)) {
          return;
        }
        const added = mapRef.current.data.addGeoJson(tagInternalWardGeoJson(geojson));
        featuresByLayerRef.current.set(WARD_MARKER_SOURCE_LAYER_ID, added);
        setVectorLayerVersion((value) => value + 1);
      })
      .catch(() => undefined);
  }, [mapReady, props.alertMarkers, props.hotspotMarkers]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const currentLayerIds = new Set(gisLayers.map((layer) => layer.layer_id));
    for (const [layerId, features] of featuresByLayerRef.current.entries()) {
      if (layerId === WARD_MARKER_SOURCE_LAYER_ID) {
        continue;
      }
      if (!currentLayerIds.has(layerId) || !optionalLayers[layerId]) {
        features.forEach((feature) => mapRef.current.data.remove(feature));
        featuresByLayerRef.current.delete(layerId);
      }
    }
    for (const [layerId, overlay] of imageOverlaysByLayerRef.current.entries()) {
      if (!currentLayerIds.has(layerId) || !optionalLayers[layerId]) {
        overlay.setMap(null);
        imageOverlaysByLayerRef.current.delete(layerId);
      }
    }
    gisLayers.forEach((layer) => syncGisLayer(layer, Boolean(optionalLayers[layer.layer_id])));
  }, [gisLayers, mapReady, optionalLayers]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    setVectorLayerVersion((value) => value + 1);
  }, [mapReady, optionalLayers.wards]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    awsMarkersRef.current.forEach((marker) => marker.setMap(null));
    awsMarkersRef.current = [];
    if (!optionalLayers.aws || !awsStations.length) {
      return;
    }
    awsMarkersRef.current = awsStations.map((station) => {
      const rate = station.latest_observation?.hourly_rate_mm_h || 0;
      const marker = new google.maps.Marker({
        position: { lat: station.latitude, lng: station.longitude },
        map: mapRef.current,
        title: `${station.name}: ${rate.toFixed(1)} mm/hr`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: rate >= 30 ? "#fb923c" : "#22d3ee",
          fillOpacity: 0.95,
          strokeColor: "#0f172a",
          strokeWeight: 2
        }
      });
      return marker;
    });
  }, [awsStations, mapReady, optionalLayers.aws]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    alertMarkersRef.current.forEach((marker) => marker.setMap(null));
    alertPulseRefs.current.forEach((pulse) => pulse.setMap(null));
    alertMarkersRef.current = [];
    alertPulseRefs.current = [];
    const alertItems = props.alertMarkers || [];
    if (!alertItems.length) {
      return;
    }
      const wardFeatures = [
        ...(featuresByLayerRef.current.get("wards") || []),
        ...(featuresByLayerRef.current.get(WARD_MARKER_SOURCE_LAYER_ID) || [])
      ];
    alertMarkersRef.current = alertItems.flatMap((alert, index) => {
      const feature = findWardFeature(wardFeatures, alert.ward_id);
      if (!feature) {
        return [];
      }
      const position = centerForFeature(feature, google);
      if (!position) {
        return [];
      }
      const pulse = createPulseOverlay(position, mapRef.current, google, styles.alertPulse);
      alertPulseRefs.current.push(pulse);
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        title: `Ward ${alert.ward_id} alert`,
        animation: google.maps.Animation.DROP,
        label: {
          text: String(index + 1),
          color: "#ffffff",
          fontWeight: "900"
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: alertColor(alert.alert_level),
          fillOpacity: 0.96,
          strokeColor: "#111827",
          strokeWeight: 1.5
        }
      });
      marker.addListener("click", () => {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        window.setTimeout(() => marker.setAnimation(null), 1400);
        handleFeatureClick(
          feature,
          position,
          mapRef.current,
          google,
          selectedFeatureRef,
          infoWindowRef,
          `Ward ${alert.ward_id} · ${formatAlertDepth(alert.max_depth_m)} · ${formatAlertArea(alert.wet_area_km2)} flooded`
        );
      });
      return [marker];
    });
  }, [mapReady, props.alertMarkers, vectorLayerVersion]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }
    const google = window.google;
    hotspotMarkersRef.current.forEach((marker) => marker.setMap(null));
    hotspotPulseRefs.current.forEach((pulse) => pulse.setMap(null));
    hotspotMarkersRef.current = [];
    hotspotPulseRefs.current = [];
    const hotspotItems = props.hotspotMarkers || [];
    if (!hotspotItems.length) {
      return;
    }
    hotspotMarkersRef.current = hotspotItems.flatMap((hotspot, index) => {
      if (hotspot.latitude === null || hotspot.latitude === undefined || hotspot.longitude === null || hotspot.longitude === undefined) {
        return [];
      }
      const position = new google.maps.LatLng(hotspot.latitude, hotspot.longitude);
      const pulse = createPulseOverlay(position, mapRef.current, google, styles.hotspotPulse);
      hotspotPulseRefs.current.push(pulse);
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        title: `${hotspot.hotspot_id}${hotspot.ward_id ? ` Ward ${hotspot.ward_id}` : ""}`,
        animation: google.maps.Animation.DROP,
        label: {
          text: String(index + 1),
          color: "#ffffff",
          fontWeight: "900"
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: alertColor(hotspot.alert_level || "red"),
          fillOpacity: 0.96,
          strokeColor: "#111827",
          strokeWeight: 1.5
        }
      });
      marker.addListener("click", () => {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        window.setTimeout(() => marker.setAnimation(null), 1400);
        const wardFeature = hotspot.ward_id
          ? findWardFeature(
              [
                ...(featuresByLayerRef.current.get("wards") || []),
                ...(featuresByLayerRef.current.get(WARD_MARKER_SOURCE_LAYER_ID) || [])
              ],
              hotspot.ward_id
            )
          : null;
        if (wardFeature) {
          handleFeatureClick(
            wardFeature,
            position,
            mapRef.current,
            google,
            selectedFeatureRef,
            infoWindowRef,
            `${hotspot.hotspot_id} · Ward ${hotspot.ward_id} · ${formatAlertDepth(hotspot.model_depth_m)}`
          );
          return;
        }
        mapRef.current.panTo(position);
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 12, 15));
        infoWindowRef.current?.setContent(
          `<strong>${escapeHtml(hotspot.hotspot_id)}</strong><br/>${escapeHtml(hotspot.ward_id ? `Ward ${hotspot.ward_id}` : "Ward pending")}<br/>Depth ${escapeHtml(formatAlertDepth(hotspot.model_depth_m))}`
        );
        infoWindowRef.current?.setPosition(position);
        infoWindowRef.current?.open({ map: mapRef.current });
      });
      return [marker];
    });
  }, [mapReady, props.hotspotMarkers]);

  const syncGisLayer = (layer: GisLayer, enabled: boolean) => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) {
      return;
    }
    const layerId = layer.layer_id;
    const featureMap = featuresByLayerRef.current;
    const overlayMap = imageOverlaysByLayerRef.current;
    if (!enabled) {
      (featureMap.get(layerId) || []).forEach((feature) => map.data.remove(feature));
      featureMap.delete(layerId);
      overlayMap.get(layerId)?.setMap(null);
      overlayMap.delete(layerId);
      return;
    }
    if (isImageOverlayLayer(layer)) {
      if (overlayMap.has(layerId)) {
        return;
      }
      const bounds = layer.metadata?.bounds;
      if (!bounds || !layer.artifact_url) {
        return;
      }
      const google = window.google;
      const googleBounds = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      );
      const overlay = new google.maps.GroundOverlay(toApiUrl(layer.artifact_url), googleBounds, {
        opacity: imageOverlayOpacity(layer)
      });
      overlay.setMap(map);
      overlayMap.set(layerId, overlay);
      return;
    }
    if (featureMap.has(layerId)) {
      return;
    }
    fetchGisLayerData(layerId)
      .then((geojson) => {
        if (!mapRef.current || !optionalLayers[layerId]) {
          return;
        }
        const added = mapRef.current.data.addGeoJson(tagLayer(geojson, layer));
        featureMap.set(layerId, added);
        setVectorLayerVersion((value) => value + 1);
      })
      .catch((error: Error) => setMessage(`${layer.label}: ${error.message}`));
  };

  const isLanding = props.variant === "landing";

  return (
    <article className={`${styles.panel} ${isLanding ? styles.landingPanel : ""}`} id="map">
      {!isLanding ? (
        <div className={styles.header}>
          <div>
            <h2>Flood Map Preview</h2>
            <p>Latest model flood overlay with time slider. Optional GIS layers are controlled from the layer button.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.layerButton} onClick={() => setLayerMenuOpen((value) => !value)} aria-label="Toggle map layers">
              <Layers aria-hidden="true" />
            </button>
            <a className={styles.openLink} href="/map" aria-label="Open full live map">
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}

      <div className={`${styles.mapFrame} ${isLanding ? styles.landingMapFrame : ""}`}>
        <div className={styles.mapCanvas} ref={mapElementRef}>
          {!props.googleMapsConfigured ? <span>Add VITE_GOOGLE_MAPS_API_KEY to render Google Maps.</span> : null}
        </div>

        {isLanding ? (
          <>
            <div className={styles.leftToolRail}>
              <button type="button" className={layerMenuOpen ? styles.toolActive : undefined} onClick={() => setLayerMenuOpen((value) => !value)} aria-label="Open map layers">
                <Layers aria-hidden="true" />
              </button>
              <a href="/map" aria-label="Open full map"><ExternalLink aria-hidden="true" /></a>
              <button type="button" aria-label="Carto Voyager view" onClick={() => setMapType("carto_voyager")}><MapIcon aria-hidden="true" /></button>
              <button type="button" aria-label="Terrain view" onClick={() => setMapType("terrain")}><Mountain aria-hidden="true" /></button>
              <button type="button" aria-label="Satellite view" onClick={() => setMapType("satellite")}><Satellite aria-hidden="true" /></button>
            </div>
            {props.topOverlay ? <div className={styles.dataOverlay}>{props.topOverlay}</div> : null}
            {layerMenuOpen ? <div className={styles.baseGallery}>
              <div>
                <strong>Base Map Gallery</strong>
                <button type="button" aria-label="Close base map gallery" onClick={() => setLayerMenuOpen(false)}>×</button>
              </div>
              <div className={styles.baseTiles}>
                <button type="button" className={mapType === "carto_voyager" ? styles.baseActive : undefined} onClick={() => setMapType("carto_voyager")}>
                  <i className={styles.tileVoyager} />
                  <span>Carto Voyager</span>
                </button>
                <button type="button" className={mapType === "terrain" ? styles.baseActive : undefined} onClick={() => setMapType("terrain")}>
                  <i className={styles.tileTerrain} />
                  <span>Terrain</span>
                </button>
                <button type="button" className={mapType === "satellite" ? styles.baseActive : undefined} onClick={() => setMapType("satellite")}>
                  <i className={styles.tileSatellite} />
                  <span>Satellite</span>
                </button>
                <button type="button" onClick={() => setMapType("terrain")}>
                  <i className={styles.tileLight} />
                  <span>Street</span>
                </button>
              </div>
            </div> : null}
          </>
        ) : null}

        {layerMenuOpen ? (
          <div className={styles.layerMenu}>
            <strong>Map Layers</strong>
            {(props.showAws ?? props.variant !== "landing") ? (
              <LayerCheck label="AWS stations" detail="Live telemetry" checked={Boolean(optionalLayers.aws)} onChange={() => toggleOptionalLayer(setOptionalLayers, "aws")} />
            ) : null}
            {Object.entries(groupLayers(gisLayers)).map(([group, layers]) => (
              <div className={styles.layerGroup} key={group}>
                <span className={styles.layerGroupTitle}>{group}</span>
                {layers
                  .filter((layer) => props.showHotspots || layer.layer_id !== "hotspots")
                  .map((layer) => (
                    <LayerCheck
                      key={layer.layer_id}
                      label={layer.label}
                      detail={layerDetail(layer)}
                      swatch={layer.metadata?.swatch || "#94a3b8"}
                      checked={Boolean(optionalLayers[layer.layer_id])}
                      onChange={() => toggleOptionalLayer(setOptionalLayers, layer.layer_id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        ) : null}

        {!isLanding ? <div className={styles.mapTypeControls} aria-label="Map base view">
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
            className={mapType === "carto_voyager" ? styles.mapTypeActive : undefined}
            onClick={() => setMapType("carto_voyager")}
          >
            <MapIcon aria-hidden="true" />
            Voyager
          </button>
          <button
            type="button"
            className={mapType === "satellite" ? styles.mapTypeActive : undefined}
            onClick={() => setMapType("satellite")}
          >
            <Satellite aria-hidden="true" />
            Satellite
          </button>
        </div> : null}

        {!isLanding ? <div className={styles.mapStatus}>{message}</div> : null}
        {currentFrame && !isLanding ? (
          <div className={styles.depthBadge}>
            <strong>{currentFrame.max_depth_m.toFixed(2)} m</strong>
            <span>{currentFrame.label}</span>
          </div>
        ) : null}
        {currentFrame ? <FloodDepthLegend label="Maximum depth, metres" maxDepth={currentFrame.max_depth_m} /> : null}
      </div>

      <div className={styles.sliderRow}>
        <button
          type="button"
          className={styles.playButton}
          disabled={frames.length <= 1}
          aria-label={isPlaying ? "Pause flood animation" : "Play flood animation"}
          onClick={() => setIsPlaying((value) => !value)}
        >
          {isPlaying ? <PauseCircle aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
        </button>
        <span>{currentFrame?.label || "--"}</span>
        <input
          aria-label="Flood map time"
          disabled={frames.length <= 1}
          max={Math.max(frames.length - 1, 0)}
          min={0}
          step={1}
          type="range"
          value={Math.min(frameIndex, Math.max(frames.length - 1, 0))}
          onChange={(event) => {
            setIsPlaying(false);
            setFrameIndex(Number(event.currentTarget.value));
          }}
        />
        <span>{frames.length ? `${frameIndex + 1}/${frames.length}` : "0/0"}</span>
      </div>
    </article>
  );
});

function registerCartoVoyagerMapType(map: any, google: any) {
  if (map.mapTypes.get(CARTO_VOYAGER_MAP_TYPE)) {
    return;
  }
  map.mapTypes.set(
    CARTO_VOYAGER_MAP_TYPE,
    new google.maps.ImageMapType({
      name: "Carto Voyager",
      alt: "Carto Voyager base map",
      minZoom: 0,
      maxZoom: 20,
      tileSize: new google.maps.Size(256, 256),
      getTileUrl: (coord: { x: number; y: number }, zoom: number) => {
        const scale = 1 << zoom;
        const x = ((coord.x % scale) + scale) % scale;
        return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${coord.y}.png`;
      }
    })
  );
}

function createPulseOverlay(position: any, map: any, google: any, className: string) {
  const overlay = new google.maps.OverlayView();
  let element: HTMLDivElement | null = null;
  overlay.onAdd = () => {
    element = document.createElement("div");
    element.className = className;
    overlay.getPanes()?.overlayMouseTarget.appendChild(element);
  };
  overlay.draw = () => {
    if (!element) {
      return;
    }
    const point = overlay.getProjection()?.fromLatLngToDivPixel(position);
    if (!point) {
      return;
    }
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  };
  overlay.onRemove = () => {
    element?.remove();
    element = null;
  };
  overlay.setMap(map);
  return overlay;
}

function handleFeatureClick(
  feature: any,
  latLng: any,
  map: any,
  google: any,
  selectedFeatureRef: React.MutableRefObject<any>,
  infoWindowRef: React.MutableRefObject<any>
  ,
  overrideLabel?: string
) {
  const layerId = String(feature.getProperty("__layer_id") || "");
  if (layerId !== "wards" && layerId !== WARD_MARKER_SOURCE_LAYER_ID) {
    const featurePosition = latLng || centerForFeature(feature, google);
    if (featurePosition) {
      map.panTo(featurePosition);
      if (feature.getGeometry?.()?.getType?.() === "Point" || layerId === "hotspots") {
      map.setZoom(Math.max(map.getZoom() || 12, 15));
      }
      infoWindowRef.current?.setContent(featureInfoHtml(feature));
      infoWindowRef.current?.setPosition(featurePosition);
      infoWindowRef.current?.open({ map });
    }
    return;
  }
  if (selectedFeatureRef.current) {
    map.data.revertStyle(selectedFeatureRef.current);
  }
  selectedFeatureRef.current = feature;
  map.data.overrideStyle(feature, {
    ...wardBoundaryStyle(true),
    strokeWeight: 2.8
  });

  const bounds = boundsForFeature(feature, google);
  if (bounds) {
    map.fitBounds(bounds, 48);
  } else {
    map.panTo(latLng);
    map.setZoom(Math.max(map.getZoom() || 12, 14));
  }

  const wardLabel = overrideLabel || wardFeatureLabel(feature);
  infoWindowRef.current?.setContent(`<strong>${escapeHtml(wardLabel)}</strong>`);
  infoWindowRef.current?.setPosition(latLng);
  infoWindowRef.current?.open({ map });
}

function centerForFeature(feature: any, google: any) {
  const bounds = boundsForFeature(feature, google);
  return bounds ? bounds.getCenter() : null;
}

function findWardFeature(features: any[], wardId: string) {
  return features.find((feature) => {
    const wardNo = feature.getProperty("REV_WRD_NO") || feature.getProperty("ward_id") || feature.getProperty("WARD_NO");
    return String(wardNo) === String(wardId);
  });
}

function boundsForFeature(feature: any, google: any) {
  const bounds = new google.maps.LatLngBounds();
  let hasPoint = false;
  feature.getGeometry()?.forEachLatLng((latLng: any) => {
    bounds.extend(latLng);
    hasPoint = true;
  });
  return hasPoint ? bounds : null;
}

function wardFeatureLabel(feature: any) {
  const wardNo = feature.getProperty("REV_WRD_NO") || feature.getProperty("ward_id") || feature.getProperty("WARD_NO");
  const name = feature.getProperty("WARD_NAME") || feature.getProperty("ward_name") || feature.getProperty("name");
  if (name && wardNo) {
    return `Ward ${wardNo}: ${name}`;
  }
  if (name) {
    return String(name);
  }
  if (wardNo) {
    return `Ward ${wardNo}`;
  }
  return "Selected ward";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };
    return entities[char] || char;
  });
}

function alertColor(level?: string) {
  if (level === "red") return "#dc2626";
  if (level === "orange") return "#f97316";
  if (level === "yellow") return "#eab308";
  return "#2563eb";
}

function formatAlertDepth(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value) ? "-- m" : `${value.toFixed(2)} m`;
}

function formatAlertArea(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value) ? "-- km2" : `${value.toFixed(2)} km2`;
}

function LayerCheck(props: { label: string; checked: boolean; onChange: () => void; detail?: string; swatch?: string }) {
  return (
    <label className={styles.layerCheck}>
      <input checked={props.checked} type="checkbox" onChange={props.onChange} />
      {props.swatch ? <i className={styles.layerSwatch} style={{ background: props.swatch }} aria-hidden="true" /> : null}
      <span>
        <strong>{props.label}</strong>
        {props.detail ? <small>{props.detail}</small> : null}
      </span>
    </label>
  );
}

function toggleOptionalLayer(
  setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  key: string
) {
  setter((current) => ({ ...current, [key]: !current[key] }));
}

function tagLayer(geojson: Record<string, unknown>, layer: GisLayer) {
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

function tagInternalWardGeoJson(geojson: Record<string, unknown>) {
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return {
    ...geojson,
    features: features.map((feature: any) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        __layer_id: WARD_MARKER_SOURCE_LAYER_ID
      }
    }))
  };
}

function previewFeatureStyle(feature: any, google: any) {
  const group = String(feature.getProperty("__layer_group") || "").toLowerCase();
  const layerId = String(feature.getProperty("__layer_id") || "");
  if (layerId === WARD_MARKER_SOURCE_LAYER_ID) {
    return {
      strokeColor: "#111827",
      strokeOpacity: 0,
      strokeWeight: 0,
      fillColor: "#111827",
      fillOpacity: 0
    };
  }
  if (layerId === "hotspots") {
    return pointStyle(google, "#dc2626", 8);
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
    return {
      ...wardBoundaryStyle(false),
      fillColor: "#0f172a",
      fillOpacity: layerId === "municipal_boundary" ? 0.02 : 0
    };
  }
  if (group.includes("urban")) {
    return { strokeColor: "#6b7280", strokeOpacity: 0.72, strokeWeight: layerId === "roads" ? 0.7 : 1.1, fillOpacity: 0 };
  }
  if (group.includes("drainage")) {
    return { strokeColor: "#15803d", strokeOpacity: 0.86, strokeWeight: 1.25, fillOpacity: 0 };
  }
  if (group.includes("water")) {
    return { strokeColor: "#0891b2", strokeOpacity: 0.82, strokeWeight: 1.35, fillColor: "#0891b2", fillOpacity: 0.12 };
  }
  if (group.includes("coupling")) {
    return { strokeColor: "#f97316", strokeOpacity: 0.86, strokeWeight: 1.4, fillColor: "#f97316", fillOpacity: 0.08 };
  }
  if (group.includes("hazard")) {
    return { strokeColor: "#dc2626", strokeOpacity: 0.9, strokeWeight: 1.7, fillColor: "#dc2626", fillOpacity: 0.08 };
  }
  if (group.includes("model") || group.includes("terrain")) {
    return { strokeColor: "#7c3aed", strokeOpacity: 0.76, strokeWeight: 1.2, fillColor: "#7c3aed", fillOpacity: 0.06 };
  }
  if (group.includes("exposure")) {
    return { strokeColor: "#0e7490", strokeOpacity: 0.72, strokeWeight: 1.1, fillColor: "#0e7490", fillOpacity: 0.07 };
  }
  return {
    strokeColor: "#64748b",
    strokeOpacity: 0.72,
    strokeWeight: 1,
    fillColor: "#64748b",
    fillOpacity: 0.05
  };
}

function pointStyle(google: any, color: string, scale: number) {
  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 0.94,
      strokeColor: "#0f172a",
      strokeWeight: 1.5
    }
  };
}

function wardBoundaryStyle(active: boolean) {
  return {
    strokeColor: active ? "#111827" : "#64748b",
    strokeOpacity: active ? 0.98 : 0.58,
    strokeWeight: active ? 2.2 : 1.1,
    fillColor: "#111827",
    fillOpacity: 0
  };
}

function orderLiveLayers(layers: GisLayer[]) {
  const ranks = new Map(liveLayerOrder.map((layerId, index) => [layerId, index]));
  return [...layers].sort((a, b) => {
    const rankA = ranks.get(a.layer_id) ?? 999;
    const rankB = ranks.get(b.layer_id) ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return `${a.group}${a.label}`.localeCompare(`${b.group}${b.label}`);
  });
}

function groupLayers(layers: GisLayer[]) {
  return layers.reduce<Record<string, GisLayer[]>>((groups, layer) => {
    const group = layer.group || "Other";
    groups[group] = groups[group] || [];
    groups[group].push(layer);
    return groups;
  }, {});
}

function layerDetail(layer: GisLayer) {
  const count = layer.feature_count ? `${layer.feature_count.toLocaleString()} features` : layer.kind;
  return `${layer.geometry_type || layer.source_format} · ${count}`;
}

function isImageOverlayLayer(layer: GisLayer) {
  return layer.kind === "image" || layer.source_format === "image_overlay";
}

function imageOverlayOpacity(layer: GisLayer) {
  const value = Number(layer.metadata?.overlay_opacity);
  return Number.isFinite(value) ? Math.max(0.1, Math.min(value, 1)) : 0.72;
}

function featureInfoHtml(feature: any) {
  const properties: Record<string, unknown> = {};
  feature.forEachProperty((value: unknown, key: string) => {
    properties[key] = value;
  });
  const title = String(
    properties.hotspot_id ||
      properties.DPS_ID ||
      properties.name ||
      properties.Name ||
      properties.id ||
      properties.__layer_label ||
      "GIS feature"
  );
  const subtitle = String(properties.__layer_label || properties.__layer_group || "Static GIS layer");
  const details = Object.entries(properties)
    .filter(([key]) => !key.startsWith("__"))
    .slice(0, 5)
    .map(([key, value]) => `<br/><small>${escapeHtml(key)}: ${escapeHtml(formatPropertyValue(value))}</small>`)
    .join("");
  return `<strong>${escapeHtml(title)}</strong><br/><span>${escapeHtml(subtitle)}</span>${details}`;
}

function formatPropertyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "--";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
