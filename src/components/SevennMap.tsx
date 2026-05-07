import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
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
const ACCENT = "#3b39e8";
const NL_PROVINCES_URL =
  "https://cartomap.github.io/nl/wgs84/provincie_2020.geojson";

type PanelKey = "home" | "layers" | "upload" | "bookmark" | "draw" | "settings";

const COUNTRIES = [
  { code: "NL", name: "Netherlands", center: [52.3, 5.5], zoom: 7 },
  { code: "DE", name: "Germany", center: [51.0, 10.5], zoom: 6 },
  { code: "BE", name: "Belgium", center: [50.6, 4.5], zoom: 7 },
  { code: "FR", name: "France", center: [46.5, 2.5], zoom: 6 },
  { code: "GB", name: "United Kingdom", center: [54.5, -2.5], zoom: 6 },
] as const;

const LANGUAGES = [
  { code: "EN", name: "English" },
  { code: "NL", name: "Nederlands" },
  { code: "DE", name: "Deutsch" },
  { code: "FR", name: "Français" },
] as const;

export default function SevennMap({ open, onClose }: SevennMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const provincesLayerRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);

  const [zoom, setZoom] = useState(7);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);

  const [country, setCountry] = useState<typeof COUNTRIES[number]>(COUNTRIES[0]);
  const [language, setLanguage] = useState<typeof LANGUAGES[number]>(LANGUAGES[0]);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [provinceNames, setProvinceNames] = useState<
    { name: string; latlng: [number, number] }[]
  >([]);

  // Init map
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
        const layer = L.geoJSON(geo, {
          style: {
            color: PURPLE,
            weight: 2,
            fillColor: PURPLE,
            fillOpacity: 0.35,
          },
          onEachFeature: (feature, lyr: any) => {
            const name =
              feature.properties?.statnaam ||
              feature.properties?.name ||
              "Region";
            lyr.bindTooltip(name, { sticky: true });
          },
        }).addTo(map);
        provincesLayerRef.current = layer;

        const names: { name: string; latlng: [number, number] }[] = [];
        layer.eachLayer((lyr: any) => {
          const c = lyr.getBounds().getCenter();
          const name =
            lyr.feature.properties?.statnaam ||
            lyr.feature.properties?.name ||
            "Region";
          names.push({ name, latlng: [c.lat, c.lng] });
        });
        setProvinceNames(names);
      } catch (e) {
        console.error("Failed to load NL provinces", e);
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        provincesLayerRef.current = null;
        searchMarkerRef.current = null;
      }
    };
  }, [open]);

  // Country change → fly map
  useEffect(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.flyTo(country.center, country.zoom, { duration: 0.8 });
  }, [country]);

  if (!open) return null;

  const handleZoom = (delta: number) => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.setZoom(leafletMapRef.current.getZoom() + delta);
  };

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return provinceNames
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, provinceNames]);

  const handleSelectResult = async (r: { name: string; latlng: [number, number] }) => {
    const L = (await import("leaflet")).default;
    const map = leafletMapRef.current;
    if (!map) return;
    map.flyTo(r.latlng, 9, { duration: 0.8 });
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    searchMarkerRef.current = L.circleMarker(r.latlng, {
      radius: 8,
      color: ACCENT,
      fillColor: ACCENT,
      fillOpacity: 0.6,
    })
      .addTo(map)
      .bindPopup(r.name)
      .openPopup();
    setSearch(r.name);
    setSearchOpen(false);
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
    if (key === "home") {
      leafletMapRef.current?.flyTo(country.center, country.zoom, { duration: 0.8 });
      setActivePanel(null);
      return;
    }
    if (activePanel === key) setActivePanel(null);
    else {
      setActivePanel(key);
      setPanelCollapsed(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f3f4f6] animate-fade-in">
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
            <div className="bg-white rounded-full shadow-md py-1.5 flex flex-col items-center gap-1 w-10">
              <button
                onClick={() => {
                  setToolbarOpen((v) => !v);
                  if (toolbarOpen) setActivePanel(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
                aria-label="Toggle menu"
              >
                {toolbarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out flex flex-col items-center gap-1 ${
                  toolbarOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {toolbarIcons.map(({ key, Icon, label }) => {
                  const active = activePanel === key;
                  return (
                    <button
                      key={key}
                      onClick={() => togglePanel(key)}
                      aria-label={label}
                      title={label}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
                        active
                          ? "bg-[#3b39e8] text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <div className="h-9 w-[180px] sm:w-[240px] md:w-[300px] bg-white rounded-full shadow-md flex items-center px-4 gap-2">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Search"
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-gray-400"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      searchMarkerRef.current?.remove();
                      searchMarkerRef.current = null;
                    }}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {searchOpen && filteredResults.length > 0 && (
                <ul className="absolute top-11 left-0 w-full bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in">
                  {filteredResults.map((r) => (
                    <li key={r.name}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectResult(r)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Search size={14} className="text-gray-400" />
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchOpen && search && filteredResults.length === 0 && (
                <div className="absolute top-11 left-0 w-full bg-white rounded-2xl shadow-lg px-4 py-3 text-sm text-gray-500 animate-fade-in">
                  No results
                </div>
              )}
            </div>
          </div>

          {/* Top-right: dropdowns */}
          <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 sm:gap-3">
            <Dropdown
              width="w-28 sm:w-36"
              value={country.name}
              options={COUNTRIES.map((c) => ({ key: c.code, label: c.name }))}
              onSelect={(key) => {
                const c = COUNTRIES.find((x) => x.code === key);
                if (c) setCountry(c);
              }}
              activeKey={country.code}
            />
            <Dropdown
              width="w-20 sm:w-24"
              value={language.code}
              options={LANGUAGES.map((l) => ({
                key: l.code,
                label: `${l.code} — ${l.name}`,
              }))}
              onSelect={(key) => {
                const l = LANGUAGES.find((x) => x.code === key);
                if (l) setLanguage(l);
              }}
              activeKey={language.code}
            />
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

function Dropdown({
  value,
  options,
  onSelect,
  activeKey,
  width,
}: {
  value: string;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
  activeKey: string;
  width: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`h-9 ${width} bg-white rounded-full shadow-md flex items-center justify-between gap-2 px-4 text-sm text-gray-700 hover:shadow-lg transition`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="absolute top-11 right-0 min-w-full w-max bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in z-10">
          {options.map((o) => (
            <li key={o.key}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(o.key);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-3 ${
                  activeKey === o.key ? "text-[#3b39e8] font-medium" : "text-gray-700"
                }`}
              >
                <span>{o.label}</span>
                {activeKey === o.key && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
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
  // Default position: top-right area inside the map container
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Initialize position once mounted (relative to parent)
  useEffect(() => {
    if (pos || !panelRef.current) return;
    const parent = panelRef.current.offsetParent as HTMLElement | null;
    if (!parent) return;
    const pw = parent.clientWidth;
    setPos({ x: pw - 280 - 16, y: 64 });
  }, [pos]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current || !pos) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const parent = panelRef.current?.offsetParent as HTMLElement | null;
      const maxX = parent ? parent.clientWidth - (panelRef.current?.offsetWidth ?? 0) : 9999;
      const maxY = parent ? parent.clientHeight - (panelRef.current?.offsetHeight ?? 0) : 9999;
      const nx = Math.max(0, Math.min(maxX, ev.clientX - dragRef.current.dx));
      const ny = Math.max(0, Math.min(maxY, ev.clientY - dragRef.current.dy));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-[1000] w-[260px] animate-fade-in select-none"
      style={pos ? { left: pos.x, top: pos.y } : { right: 16, top: 64, visibility: "hidden" }}
    >
      {/* External collapse tab */}
      <button
        onClick={onToggleCollapse}
        className="absolute -left-7 top-3 w-7 h-9 bg-white rounded-l-lg shadow-md flex items-center justify-center text-gray-500 hover:text-gray-800"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {!collapsed && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div
            onMouseDown={onMouseDown}
            className="flex items-center justify-between px-4 py-2.5 cursor-move"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {panelTitle(panel)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800 p-1"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-4">{renderPanelBody(panel)}</div>
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
      return <LayersPanel />;
    case "upload":
      return <UploadPanel />;
    case "home":
      return <PlaceholderPanel text="Reset map to default view." />;
    case "settings":
      return <SettingsPanel />;
  }
}

function PlaceholderPanel({ text }: { text: string }) {
  return <p className="text-sm text-gray-500">{text}</p>;
}

function LayersPanel() {
  const [layers, setLayers] = useState([
    { key: "councils", label: "Councils", on: true },
    { key: "roads", label: "Roads", on: true },
    { key: "labels", label: "Labels", on: true },
    { key: "satellite", label: "Satellite", on: false },
  ]);
  return (
    <ul className="space-y-2">
      {layers.map((l) => (
        <li
          key={l.key}
          className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
        >
          <span className="text-sm text-gray-800">{l.label}</span>
          <button
            onClick={() =>
              setLayers((ls) =>
                ls.map((x) => (x.key === l.key ? { ...x, on: !x.on } : x)),
              )
            }
            className={`w-10 h-6 rounded-full relative transition ${
              l.on ? "bg-[#3b39e8]" : "bg-gray-300"
            }`}
            aria-label={`Toggle ${l.label}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                l.on ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function UploadPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center text-gray-500 hover:border-[#3b39e8] hover:text-[#3b39e8] transition"
      >
        <Upload size={24} />
        <span className="mt-2 text-sm">Click to upload files</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) =>
          setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])
        }
      />
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsPanel() {
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">Units</p>
        <div className="bg-gray-100 rounded-full p-1 flex">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 h-8 rounded-full text-xs font-medium capitalize transition ${
                units === u ? "bg-[#3b39e8] text-white" : "text-gray-700"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">Theme</p>
        <div className="bg-gray-100 rounded-full p-1 flex">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 h-8 rounded-full text-xs font-medium capitalize transition ${
                theme === t ? "bg-[#3b39e8] text-white" : "text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawPanel() {
  const [tab, setTab] = useState<"draw" | "styles">("draw");
  const [tool, setTool] = useState<string | null>(null);
  const [stroke, setStroke] = useState("#3b39e8");
  const [opacity, setOpacity] = useState(50);

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
        {(["draw", "styles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full text-sm font-medium capitalize transition ${
              tab === t ? "bg-[#3b39e8] text-white" : "text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
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
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Stroke color</p>
            <div className="flex gap-2">
              {["#3b39e8", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  onClick={() => setStroke(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    stroke === c ? "border-gray-900 scale-110" : "border-white"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">
              Fill opacity: {opacity}%
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(+e.target.value)}
              className="w-full accent-[#3b39e8]"
            />
          </div>
        </div>
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
              { id: crypto.randomUUID(), name: `Bookmark 1` },
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
    <div>
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
      </ul>
      <button
        onClick={() =>
          setBookmarks((bs) => [
            ...bs,
            { id: crypto.randomUUID(), name: `Bookmark ${bs.length + 1}` },
          ])
        }
        className="w-full mt-3 h-10 rounded-full bg-[#3b39e8] text-white text-sm font-medium hover:opacity-90 transition"
      >
        + Add Bookmark
      </button>
    </div>
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
