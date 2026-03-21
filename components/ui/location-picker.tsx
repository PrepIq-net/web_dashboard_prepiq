"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, MapsArrow, Xmark } from "iconoir-react";
import { toast } from "react-hot-toast";

type LatLng = { lat: number; lng: number };

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  address: string;
  onLocationChange: (lat: string, lng: string, address: string) => void;
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function LocationPicker({
  latitude,
  longitude,
  address,
  onLocationChange,
}: LocationPickerProps) {
  const [query, setQuery] = useState(address || "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initLock = useRef(false);

  const debouncedQuery = useDebounce(query, 420);

  const currentLatLng: LatLng | null =
    latitude && longitude
      ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
      : null;

  // ── Init Leaflet map (client-only) ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (initLock.current) return;
    initLock.current = true;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const center: [number, number] = currentLatLng
        ? [currentLatLng.lat, currentLatLng.lng]
        : [0, 20];
      const zoom = currentLatLng ? 15 : 2;

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (currentLatLng) {
        const marker = L.marker([currentLatLng.lat, currentLatLng.lng], {
          draggable: true,
        }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          reverseGeocode(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }

      // Click to place/move marker
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        placeMarker(L, map, e.latlng.lat, e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      leafletMap.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      leafletMap.current?.remove();
      leafletMap.current = null;
      markerRef.current = null;
      initLock.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync marker when lat/lng props change externally ────────────────
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    if (!latitude || !longitude) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    import("leaflet").then((L) => {
      placeMarker(L, leafletMap.current!, lat, lng);
      leafletMap.current!.setView([lat, lng], 15, { animate: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, mapReady]);

  // ── Nominatim search ────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=6&addressdetails=1`,
      { headers: { "Accept-Language": "en" } },
    )
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        setResults(data);
        setShowDropdown(data.length > 0);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  // ── Close dropdown on outside click ────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────
  function placeMarker(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    lat: number,
    lng: number,
  ) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
  }

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { headers: { "Accept-Language": "en" } },
        );
        const data = await r.json();
        const displayName: string = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setQuery(displayName);
        onLocationChange(lat.toFixed(7), lng.toFixed(7), displayName);
      } catch {
        onLocationChange(lat.toFixed(7), lng.toFixed(7), query);
      }
    },
    [onLocationChange, query],
  );

  function selectResult(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setQuery(result.display_name);
    setShowDropdown(false);
    setResults([]);
    onLocationChange(lat.toFixed(7), lng.toFixed(7), result.display_name);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        reverseGeocode(lat, lng).then(() => {
          if (leafletMap.current) {
            leafletMap.current.setView([lat, lng], 16, { animate: true });
          }
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === 1
            ? "Location access denied. Allow it in your browser settings."
            : "Could not get your location. Try searching instead.",
          { duration: 5000 },
        );
      },
      // No timeout — let the browser permission dialog take as long as needed.
      // maximumAge allows reusing a recent cached fix.
      { maximumAge: 60000 },
    );
  }

  function clearLocation() {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    onLocationChange("", "", "");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
          Location
        </label>
        {currentLatLng && (
          <span className="text-[10px] text-[#5A5A60] font-mono">
            {currentLatLng.lat.toFixed(5)}, {currentLatLng.lng.toFixed(5)}
          </span>
        )}
      </div>

      {/* Search input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative flex items-center">
          <MapPin className="absolute left-3 h-4 w-4 text-[#5A5A60] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) clearLocation();
            }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search for an address or place…"
            className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] pl-9 pr-20 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {searching && (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-[#A8821F] border-t-transparent animate-spin" />
            )}
            {query && !searching && (
              <button
                type="button"
                onClick={clearLocation}
                className="p-1 text-[#5A5A60] hover:text-[#8E8E93] transition-colors"
                aria-label="Clear location"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              title="Use my current location"
              className="flex items-center gap-1 h-7 rounded-[6px] border border-[#2E2E33] bg-[#232327] px-2 text-[11px] text-[#C7C7CC] hover:border-[#A8821F]/50 hover:text-[#A8821F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locating ? (
                <div className="h-3 w-3 rounded-full border-2 border-[#A8821F] border-t-transparent animate-spin" />
              ) : (
                <MapsArrow className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">My location</span>
            </button>
          </div>
        </div>

        {/* Dropdown results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => selectResult(r)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#232327] transition-colors border-b border-[#232327] last:border-0"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A8821F]" />
                <span className="text-xs text-[#C7C7CC] leading-relaxed line-clamp-2">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-[10px] border border-[#2E2E33]">
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <div
          ref={mapRef}
          className="h-[260px] w-full bg-[#1C1C1F]"
          style={{ zIndex: 0 }}
        />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1F]">
            <div className="h-5 w-5 rounded-full border-2 border-[#A8821F] border-t-transparent animate-spin" />
          </div>
        )}
        {!currentLatLng && mapReady && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#2E2E33] bg-[#141416]/90 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[11px] text-[#8E8E93]">
              Search above or click the map to pin your location
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#5A5A60]">
        Drag the pin or click anywhere on the map to adjust the exact position.
      </p>
    </div>
  );
}
