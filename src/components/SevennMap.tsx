import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle as CircleIcon,
  Dot,
  Home,
  Layers,
  Menu,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Search,
  Settings,
  Slash,
  Square,
  Type,
  Upload,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface SevennMapProps {
  open: boolean;
  onClose: () => void;
}

const PURPLE = "#8b5cf6";
const NL_PROVINCES_URL =
  "https://cartomap.github.io/nl/wgs84/provincie_2020.geojson";

type PanelKey = "home" | "layers" | "upload" | "bookmark" | "draw" | "settings";

export default function SevennMap({ open, onClose }: SevennMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const [zoom, setZoom] = useState(7.5);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

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

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

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

  const toolbarIcons: { key: PanelKey; Icon: any; label: string }[] = [
    { key: "home", Icon: Home, label: "Home" },
    { key: "layers", Icon: Layers, label: "Layers" },
    { key: "upload", Icon: Upload, label: "Upload" },
    { key: "bookmark", Icon: Bookmark, label: "Bookmark" },
    { key: "draw", Icon: MousePointer2, label: "Draw" },
    { key: "settings", Icon: Settings, label: "Settings" },
  ];

  const togglePanel = (key: PanelKey) => {
    if (activePanel === key) {
      setActivePanel(null);
    } else {
      setActivePanel(key);
      setPanelCollapsed(false);
    }
  };

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

          {/* Top-left: menu + toolbar + search */}
          <div className="absolute top-4 left-4 z-[1000] flex items-start gap-3">
            <div className="bg-white rounded-full shadow-md py-2 flex flex-col items-center gap-1 w-12">
              <button
                onClick={() => setActivePanel(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
                aria-label="Close panels"
              >
                <X size={20} />
              </button>
              {toolbarIcons.map(({ key, Icon, label }) => {
                const active = activePanel === key;
                return (
                  <button
                    key={key}
                    onClick={() => togglePanel(key)}
                    aria-label={label}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition ${
                      active
                        ? "bg-[#3b39e8] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
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

          {/* Right side panel */}
          {activePanel && (
            <SidePanel
              panel={activePanel}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  panel,
  collapsed,
  onToggleCollapse,
  onClose,
}: {
  panel: PanelKey;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex items-start">
      {/* Collapse tab */}
      <button
        onClick={onToggleCollapse}
        className="mt-44 -mr-px w-6 h-10 bg-white rounded-l-md shadow-md flex items-center justify-center text-gray-500 hover:text-gray-800"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
      >
        {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {!collapsed && (
        <div className="w-[340px] mt-14 bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">
              {panelTitle(panel)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 pb-6">{renderPanelBody(panel)}</div>
        </div>
      )}
    </div>
  );
}

function panelTitle(panel: PanelKey) {
  switch (panel) {
    case "home":
      return "Home";
    case "layers":
      return "Layers";
    case "upload":
      return "Upload";
    case "bookmark":
      return "Bookmark's";
    case "draw":
      return "Draw";
    case "settings":
      return "Settings";
  }
}

function renderPanelBody(panel: PanelKey) {
  switch (panel) {
    case "draw":
      return <DrawPanel />;
    case "bookmark":
      return <BookmarkPanel />;
    case "layers":
      return <PlaceholderPanel text="Toggle map layers here." />;
    case "upload":
      return <PlaceholderPanel text="Drop or pick a file to upload." />;
    case "home":
      return <PlaceholderPanel text="Reset map to default view." />;
    case "settings":
      return <PlaceholderPanel text="Map preferences." />;
  }
}

function PlaceholderPanel({ text }: { text: string }) {
  return <p className="text-sm text-gray-500">{text}</p>;
}

function DrawPanel() {
  const [tab, setTab] = useState<"draw" | "styles">("draw");
  const [tool, setTool] = useState<string | null>(null);

  const tools = [
    { key: "point", label: "Point", Icon: Dot },
    { key: "polyline", label: "Polyline", Icon: Slash },
    { key: "text", label: "Text", Icon: Type },
    { key: "polygon", label: "Polygon", Icon: Pencil },
    { key: "circle", label: "Circle", Icon: CircleIcon },
    { key: "rectangle", label: "Rectangle", Icon: Square },
  ];

  return (
    <div>
      <div className="bg-gray-100 rounded-full p-1 flex mb-5">
        <button
          onClick={() => setTab("draw")}
          className={`flex-1 h-9 rounded-full text-sm font-medium transition ${
            tab === "draw" ? "bg-[#3b39e8] text-white" : "text-gray-700"
          }`}
        >
          Draw
        </button>
        <button
          onClick={() => setTab("styles")}
          className={`flex-1 h-9 rounded-full text-sm font-medium transition ${
            tab === "styles" ? "bg-[#3b39e8] text-white" : "text-gray-700"
          }`}
        >
          Styles
        </button>
      </div>

      {tab === "draw" ? (
        <div className="grid grid-cols-3 gap-3">
          {tools.map(({ key, label, Icon }) => {
            const active = tool === key;
            return (
              <button
                key={key}
                onClick={() => setTool(active ? null : key)}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition ${
                  active
                    ? "border-[#3b39e8] bg-[#3b39e8]/5 text-[#3b39e8]"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <PlaceholderPanel text="Customize stroke, fill, and opacity." />
      )}
    </div>
  );
}

function BookmarkPanel() {
  const [bookmarks, setBookmarks] = useState<{ id: string; name: string }[]>([]);

  if (bookmarks.length === 0) {
    return (
      <div className="bg-[#f5f6ff] rounded-xl py-8 px-4 flex flex-col items-center text-center">
        <Bookmark size={28} className="text-[#3b39e8] fill-[#3b39e8]" />
        <p className="mt-3 font-semibold text-gray-900">No Bookmarks</p>
        <p className="mt-1 text-xs text-gray-500 max-w-[220px]">
          Add bookmarks to your map and they will appear here.
        </p>
        <button
          onClick={() =>
            setBookmarks([
              { id: crypto.randomUUID(), name: `Bookmark ${bookmarks.length + 1}` },
            ])
          }
          className="mt-5 px-5 h-10 rounded-full bg-[#3b39e8] text-white text-sm font-medium hover:opacity-90 transition"
        >
          + Add Bookmark
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {bookmarks.map((b) => (
        <li
          key={b.id}
          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm"
        >
          <span>{b.name}</span>
          <button
            onClick={() => setBookmarks((bs) => bs.filter((x) => x.id !== b.id))}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </li>
      ))}
      <button
        onClick={() =>
          setBookmarks((bs) => [
            ...bs,
            { id: crypto.randomUUID(), name: `Bookmark ${bs.length + 1}` },
          ])
        }
        className="w-full mt-2 h-10 rounded-full bg-[#3b39e8] text-white text-sm font-medium hover:opacity-90 transition"
      >
        + Add Bookmark
      </button>
    </ul>
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
