declare global {
  interface Window {
    google?: any;
    __floodAstraGoogleMapsReady?: () => void;
  }
}

let googleMapsPromise: Promise<any> | null = null;

export const floodGoogleMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#eef5f0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#264351" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#5298a9" }, { weight: 0.7 }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e3f0e7" }] },
  { featureType: "poi", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d7ead9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#cfe2e4" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#9bc7ca" }] }
];

export function visibleFloodOverlayOpacity(opacity?: number | null) {
  return Math.min(0.94, Math.max(opacity ?? 0.86, 0.72));
}

export function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (googleMapsPromise) {
    return googleMapsPromise;
  }
  googleMapsPromise = new Promise((resolve, reject) => {
    window.__floodAstraGoogleMapsReady = () => resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__floodAstraGoogleMapsReady&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Unable to load Google Maps JavaScript."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export {};
