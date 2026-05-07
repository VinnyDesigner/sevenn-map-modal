import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Home,
  Layers,
  Menu,
  Minus,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  X,
  ChevronDown,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface SevennMapProps {
  open: boolean;
  onClose: () => void;
}

const PURPLE = "#8b5cf6";
const NL_PROVINCES_URL =
  "https://cartomap.github.io/nl/wgs84/provincie_2020.geojson";

export default function SevennMap({ open, onClose }: SevennMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [zoom, setZoom] = useState(7.5);

  useEffect(() => {
    if (!open || !mapRef.current || leafletMapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [52.3, 5.5],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });
      leafletMapRef.current = map;

      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 },
      ).addTo(map);

      map.on("zoomend", () =>
        setZoom(Math.round(map.getZoom() * 10) / 10),
      );

      try {
        const res = await fetch(NL_PROVINCES_URL);
        const geo = await res.json();
        if (cancelled) return;
        L.geoJSON(geo, {
          style: {
            color: PURPLE,
            weight: 2,
            fillColor: PURPLE,
            fillOpacity: 0.35,
          },
        }).addTo(map);
      } catch (e) {
        console.error("Failed to load NL provinces", e);
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const handleZoom = (delta: number) => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.setZoom(leafletMapRef.current.getZoom() + delta);
  };

  const toolbarIcons = [
    { Icon: Home, label: "Home" },
    { Icon: Layers, label: "Layers" },
    { Icon: Share2, label: "Share" },
    { Icon: Bookmark, label: "Bookmark" },
    { Icon: Pencil, label: "Draw" },
    { Icon: Settings, label: "Settings" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f3f4f6]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white">
        <h2 className="text-base font-semibold text-foreground">Sevenn Map</h2>
        <button
          onClick={onClose}
          className="text-foreground hover:opacity-70 transition"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 p-4 pt-0">
        <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-md bg-white">
          <div ref={mapRef} className="absolute inset-0" />

          {/* Top-left: menu + search */}
          <div className="absolute top-4 left-4 z-[1000] flex items-start gap-3">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setToolbarOpen((v) => !v)}
                className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition"
                aria-label="Menu"
              >
                {toolbarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* Expandable toolbar */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  toolbarOpen
                    ? "max-h-[400px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="bg-white rounded-full shadow-md py-3 flex flex-col items-center gap-4 w-12">
                  {toolbarIcons.map(({ Icon, label }) => (
                    <button
                      key={label}
                      aria-label={label}
                      className="w-8 h-8 flex items-center justify-center text-gray-700 hover:text-foreground hover:bg-gray-100 rounded-full transition"
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-12 w-[320px] bg-white rounded-full shadow-md flex items-center px-5 gap-3">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Top-right: dropdowns */}
          <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3">
            <DropdownPill label="Country" />
            <DropdownPill label="EN" compact />
          </div>

          {/* Bottom-left: zoom */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-full shadow-md flex flex-col overflow-hidden">
            <button
              onClick={() => handleZoom(1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition"
              aria-label="Zoom in"
            >
              <Plus size={18} />
            </button>
            <div className="h-px bg-gray-200 mx-2" />
            <button
              onClick={() => handleZoom(-1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition"
              aria-label="Zoom out"
            >
              <Minus size={18} />
            </button>
          </div>

          {/* Bottom status bar */}
          <div className="absolute bottom-4 left-20 z-[1000] bg-white rounded-full shadow-md px-5 h-10 flex items-center gap-4 text-xs text-gray-700">
            <StatusItem label="Zoom" value={String(zoom)} />
            <Divider />
            <StatusItem label="Resolution" value="873.53" />
            <Divider />
            <StatusItem label="Scale" value="1:31,19,737" />
            <Divider />
            <StatusItem label="Legend(s)" value="" />
            <span
              className="inline-block w-4 h-4 rounded-sm border-2"
              style={{ borderColor: PURPLE, background: `${PURPLE}40` }}
            />
            <span>Councils</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownPill({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      className={`h-12 bg-white rounded-full shadow-md flex items-center justify-between gap-3 px-5 text-sm text-gray-700 hover:shadow-lg transition ${
        compact ? "w-24" : "w-36"
      }`}
    >
      <span>{label}</span>
      <ChevronDown size={16} className="text-gray-400" />
    </button>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-gray-500">{label}:</span>
      {value && <span className="font-medium text-gray-800">{value}</span>}
    </span>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-gray-200" />;
}
