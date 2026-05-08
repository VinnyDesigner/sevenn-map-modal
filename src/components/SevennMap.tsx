import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  MapPin,
  MousePointer2,
  Pencil,
  Plus,
  Search,
  Settings,
  Slash,
  Square,
  Trash2,
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
type DrawTool =
  | "point"
  | "polyline"
  | "text"
  | "polygon"
  | "circle"
  | "rectangle";

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

interface DrawStyle {
  stroke: string;
  opacity: number;
}

interface MapCtxValue {
  L: any;
  map: any;
  provincesLayerRef: React.MutableRefObject<any>;
  baseLayerRef: React.MutableRefObject<any>;
  satelliteLayerRef: React.MutableRefObject<any>;
  labelsLayerRef: React.MutableRefObject<any>;
  uploadGroupRef: React.MutableRefObject<any>;
  drawGroupRef: React.MutableRefObject<any>;
  layersOn: Record<string, boolean>;
  setLayersOn: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  drawTool: DrawTool | null;
  setDrawTool: (t: DrawTool | null) => void;
  drawStyle: DrawStyle;
  setDrawStyle: React.Dispatch<React.SetStateAction<DrawStyle>>;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  units: "metric" | "imperial";
  setUnits: (u: "metric" | "imperial") => void;
  clearDrawings: () => number;
  drawCount: number;
}

const MapCtx = createContext<MapCtxValue | null>(null);
const useMapCtx = () => {
  const v = useContext(MapCtx);
  if (!v) throw new Error("MapCtx missing");
  return v;
};

export default function SevennMap({ open, onClose }: SevennMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const provincesLayerRef = useRef<any>(null);
  const baseLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const uploadGroupRef = useRef<any>(null);
  const drawGroupRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
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

  const [layersOn, setLayersOn] = useState<Record<string, boolean>>({
    councils: true,
    roads: true,
    labels: true,
    satellite: false,
  });
  const [drawTool, setDrawToolState] = useState<DrawTool | null>(null);
  const [drawStyle, setDrawStyle] = useState<DrawStyle>({
    stroke: ACCENT,
    opacity: 50,
  });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

  // Init map
  useEffect(() => {
    if (!open || !mapRef.current || leafletMapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      LRef.current = L;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [52.3, 5.5],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });
      leafletMapRef.current = map;

      const base = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 },
      ).addTo(map);
      baseLayerRef.current = base;

      // Satellite (Esri) - off by default
      satelliteLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      );

      // Labels overlay (Carto)
      labelsLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 },
      );

      uploadGroupRef.current = L.layerGroup().addTo(map);
      drawGroupRef.current = L.featureGroup().addTo(map);
      drawGroupRef.current.on("layeradd layerremove", () => {
        const g = drawGroupRef.current;
        let c = 0;
        g?.eachLayer(() => { c++; });
        setDrawCount(c);
      });

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
          onEachFeature: (feature: any, lyr: any) => {
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

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        provincesLayerRef.current = null;
        baseLayerRef.current = null;
        satelliteLayerRef.current = null;
        labelsLayerRef.current = null;
        uploadGroupRef.current = null;
        drawGroupRef.current = null;
        searchMarkerRef.current = null;
      }
      setReady(false);
    };
  }, [open]);

  // Country change → fly map
  useEffect(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.flyTo(country.center, country.zoom, { duration: 0.8 });
  }, [country]);

  // Apply layer toggles
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !ready) return;
    const apply = (layer: any, on: boolean) => {
      if (!layer) return;
      if (on && !map.hasLayer(layer)) map.addLayer(layer);
      if (!on && map.hasLayer(layer)) map.removeLayer(layer);
    };
    apply(provincesLayerRef.current, layersOn.councils);
    apply(baseLayerRef.current, layersOn.roads);
    apply(labelsLayerRef.current, layersOn.labels);
    apply(satelliteLayerRef.current, layersOn.satellite);
  }, [layersOn, ready]);

  // Apply theme by swapping base tile if not satellite
  useEffect(() => {
    const map = leafletMapRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    const url =
      theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    baseLayerRef.current = L.tileLayer(url, { maxZoom: 19 });
    if (layersOn.roads) baseLayerRef.current.addTo(map);
  }, [theme, ready]);

  // Drawing interactions
  const drawStateRef = useRef<{
    points: [number, number][];
    tempLayer: any;
    centerLatLng: any;
  }>({ points: [], tempLayer: null, centerLatLng: null });

  const [drawCount, setDrawCount] = useState(0);

  const resetInProgressDraw = useCallback(() => {
    drawStateRef.current.points = [];
    if (drawStateRef.current.tempLayer) {
      drawStateRef.current.tempLayer.remove();
      drawStateRef.current.tempLayer = null;
    }
    drawStateRef.current.centerLatLng = null;
  }, []);

  const setDrawTool = useCallback((t: DrawTool | null) => {
    resetInProgressDraw();
    setDrawToolState(t);
  }, [resetInProgressDraw]);

  const clearDrawings = useCallback(() => {
    const grp = drawGroupRef.current;
    let n = 0;
    if (grp) {
      grp.eachLayer(() => { n++; });
      grp.clearLayers();
    }
    resetInProgressDraw();
    setDrawCount(0);
    return n;
  }, [resetInProgressDraw]);


  useEffect(() => {
    const map = leafletMapRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;

    map.getContainer().style.cursor = drawTool ? "crosshair" : "";

    const styleOpts = () => ({
      color: drawStyle.stroke,
      fillColor: drawStyle.stroke,
      fillOpacity: drawStyle.opacity / 100,
      weight: 2,
    });

    const finishPolygonOrLine = () => {
      const pts = drawStateRef.current.points;
      if (pts.length < 2) return;
      if (drawStateRef.current.tempLayer) {
        drawStateRef.current.tempLayer.remove();
        drawStateRef.current.tempLayer = null;
      }
      const layer =
        drawTool === "polygon"
          ? L.polygon(pts, styleOpts())
          : L.polyline(pts, styleOpts());
      drawGroupRef.current?.addLayer(layer);
      drawStateRef.current.points = [];
    };

    const onClick = (e: any) => {
      if (!drawTool) return;
      const ll = [e.latlng.lat, e.latlng.lng] as [number, number];

      if (drawTool === "point") {
        const m = L.circleMarker(ll, {
          radius: 6,
          color: drawStyle.stroke,
          fillColor: drawStyle.stroke,
          fillOpacity: drawStyle.opacity / 100,
        });
        drawGroupRef.current?.addLayer(m);
      } else if (drawTool === "text") {
        const txt = window.prompt("Enter label text:");
        if (txt) {
          const icon = L.divIcon({
            className: "",
            html: `<div style="background:white;color:${drawStyle.stroke};padding:2px 6px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid ${drawStyle.stroke};white-space:nowrap;">${escapeHtml(txt)}</div>`,
          });
          drawGroupRef.current?.addLayer(L.marker(ll, { icon }));
        }
      } else if (drawTool === "rectangle") {
        if (!drawStateRef.current.points.length) {
          drawStateRef.current.points.push(ll);
        } else {
          const a = drawStateRef.current.points[0];
          drawGroupRef.current?.addLayer(
            L.rectangle([a, ll], styleOpts()),
          );
          drawStateRef.current.points = [];
        }
      } else if (drawTool === "circle") {
        if (!drawStateRef.current.centerLatLng) {
          drawStateRef.current.centerLatLng = e.latlng;
        } else {
          const radius = e.latlng.distanceTo(drawStateRef.current.centerLatLng);
          drawGroupRef.current?.addLayer(
            L.circle(drawStateRef.current.centerLatLng, {
              radius,
              ...styleOpts(),
            }),
          );
          drawStateRef.current.centerLatLng = null;
        }
      } else if (drawTool === "polyline" || drawTool === "polygon") {
        drawStateRef.current.points.push(ll);
        if (drawStateRef.current.tempLayer) {
          drawStateRef.current.tempLayer.remove();
        }
        drawStateRef.current.tempLayer =
          drawTool === "polygon"
            ? L.polygon(drawStateRef.current.points, {
                ...styleOpts(),
                dashArray: "4 4",
              }).addTo(map)
            : L.polyline(drawStateRef.current.points, {
                ...styleOpts(),
                dashArray: "4 4",
              }).addTo(map);
      }
    };

    const onDblClick = (e: any) => {
      if (drawTool === "polyline" || drawTool === "polygon") {
        e.originalEvent?.preventDefault();
        finishPolygonOrLine();
      }
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    if (drawTool === "polyline" || drawTool === "polygon") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      map.doubleClickZoom.enable();
    };
  }, [drawTool, drawStyle, ready]);

  const ctxValue: MapCtxValue | null = ready
    ? {
        L: LRef.current,
        map: leafletMapRef.current,
        provincesLayerRef,
        baseLayerRef,
        satelliteLayerRef,
        labelsLayerRef,
        uploadGroupRef,
        drawGroupRef,
        layersOn,
        setLayersOn,
        drawTool,
        setDrawTool,
        drawStyle,
        setDrawStyle,
        theme,
        setTheme,
        units,
        setUnits,
        clearDrawings,
        drawCount,
      }
    : null;

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
    const L = LRef.current ?? (await import("leaflet")).default;
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
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 bg-white">
        <h2 className="text-sm sm:text-base font-semibold text-foreground">Sevenn Map</h2>
        <button
          onClick={onClose}
          className="text-foreground hover:opacity-70 transition"
          aria-label="Close"
          title="Close"
        >
          <X size={22} />
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 p-2 sm:p-4 pt-0">
        <div className="relative w-full h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-md bg-white">
          <div ref={mapRef} className="absolute inset-0" />

          {/* Top-left: menu + toolbar + search */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-[1000] flex items-start gap-2 sm:gap-3">
            <div className="bg-white rounded-full shadow-md hover:shadow-lg transition flex flex-col items-center w-8">
              <button
                onClick={() => {
                  setToolbarOpen((v) => !v);
                  if (toolbarOpen) setActivePanel(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
                aria-label="Toggle menu"
                title={toolbarOpen ? "Close menu" : "Open menu"}
              >
                {toolbarOpen ? (
                  <X size={14} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <line x1="2.5" y1="5" x2="11.5" y2="5" />
                    <line x1="2.5" y1="9" x2="11.5" y2="9" />
                  </svg>
                )}
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
              <div className="h-8 w-[120px] xs:w-[140px] sm:w-[180px] md:w-[220px] bg-white rounded-full shadow-md hover:shadow-lg transition flex items-center px-3 gap-2">
                <Search size={14} className="text-gray-700 shrink-0" />
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
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-gray-400"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      searchMarkerRef.current?.remove();
                      searchMarkerRef.current = null;
                    }}
                    className="text-gray-400 hover:text-gray-700"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {searchOpen && filteredResults.length > 0 && (
                <ul className="absolute top-10 left-0 w-full bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in">
                  {filteredResults.map((r) => (
                    <li key={r.name}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectResult(r)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Search size={12} className="text-gray-400" />
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchOpen && search && filteredResults.length === 0 && (
                <div className="absolute top-10 left-0 w-full bg-white rounded-2xl shadow-lg px-4 py-2 text-xs text-gray-500 animate-fade-in">
                  No results
                </div>
              )}
            </div>
          </div>

          {/* Top-right: dropdowns */}
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-[1000] flex items-center gap-1.5 sm:gap-3">
            <Dropdown
              width="w-20 sm:w-28"
              value={country.name}
              options={COUNTRIES.map((c) => ({ key: c.code, label: c.name }))}
              onSelect={(key) => {
                const c = COUNTRIES.find((x) => x.code === key);
                if (c) setCountry(c);
              }}
              activeKey={country.code}
            />
            <Dropdown
              width="w-14 sm:w-16"
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
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 z-[1000] bg-white rounded-full shadow-md hover:shadow-lg transition flex flex-col overflow-hidden">
            <button
              onClick={() => handleZoom(1)}
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus size={12} />
            </button>
            <div className="h-px bg-gray-200 mx-1.5" />
            <button
              onClick={() => handleZoom(-1)}
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus size={12} />
            </button>
          </div>

          {/* Bottom status bar */}
          <div className="hidden sm:flex absolute bottom-4 left-16 z-[1000] bg-white rounded-full shadow-md hover:shadow-lg transition px-3 h-7 items-center gap-2 text-[10px] text-gray-700 overflow-x-auto whitespace-nowrap max-w-[calc(100%-5rem)] w-fit">
            <StatusItem label="Zoom" value={String(zoom)} />
            <Divider />
            <StatusItem label="Resolution" value="873.53" />
            <Divider />
            <StatusItem label="Scale" value="1:31,19,737" />
            <Divider />
            <StatusItem label="Legend(s)" value="" />
            <span
              className="inline-block w-3 h-3 rounded-sm border-2 shrink-0"
              style={{ borderColor: PURPLE, background: `${PURPLE}40` }}
            />
            <span>Councils</span>
          </div>

          {/* Mobile compact status */}
          <div className="flex sm:hidden absolute bottom-2 left-12 z-[1000] bg-white rounded-full shadow-md px-2.5 h-7 items-center gap-1.5 text-[10px] text-gray-700">
            <StatusItem label="Zoom" value={String(zoom)} />
            <Divider />
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm border-2 shrink-0"
              style={{ borderColor: PURPLE, background: `${PURPLE}40` }}
            />
            <span>Councils</span>
          </div>

          {/* Right side panel */}
          {activePanel && ctxValue && (
            <MapCtx.Provider value={ctxValue}>
              <SidePanel
                panel={activePanel}
                collapsed={panelCollapsed}
                onToggleCollapse={() => setPanelCollapsed((v) => !v)}
                onClose={() => setActivePanel(null)}
              />
            </MapCtx.Provider>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
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
        className={`h-8 ${width} bg-white rounded-full shadow-md flex items-center justify-between px-3 text-xs font-medium text-gray-900 hover:bg-gray-50 hover:shadow-lg transition`}
        style={{ gap: 8 }}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={12}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="absolute top-10 right-0 min-w-full w-max bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in z-10">
          {options.map((o) => (
            <li key={o.key}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(o.key);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-3 ${
                  activeKey === o.key ? "text-[#3b39e8] font-medium" : "text-gray-700"
                }`}
              >
                <span>{o.label}</span>
                {activeKey === o.key && <Check size={12} />}
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const parent = panelRef.current.offsetParent as HTMLElement | null;
    const rect = panelRef.current.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect();
    const startX = parentRect ? rect.left - parentRect.left : rect.left;
    const startY = parentRect ? rect.top - parentRect.top : rect.top;
    dragRef.current = { dx: e.clientX - startX, dy: e.clientY - startY };
    setPos({ x: startX, y: startY });
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !panelRef.current) return;
      const par = panelRef.current.offsetParent as HTMLElement | null;
      const maxX = par ? par.clientWidth - panelRef.current.offsetWidth : 9999;
      const maxY = par ? par.clientHeight - panelRef.current.offsetHeight : 9999;
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

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="absolute right-0 top-16 z-[1000] w-7 h-9 bg-white rounded-l-lg shadow-md flex items-center justify-center text-gray-500 hover:text-gray-800 animate-fade-in"
        aria-label="Expand panel"
        title="Expand panel"
      >
        <ChevronLeft size={14} />
      </button>
    );
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: 16, top: 56 };

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="sm:hidden absolute inset-x-0 bottom-0 z-[1000] bg-white rounded-t-2xl shadow-2xl animate-fade-in max-h-[70%] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{panelTitle(panel)}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1"
            aria-label="Close panel"
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto">{renderPanelBody(panel)}</div>
      </div>

      {/* Desktop / tablet: floating draggable panel */}
      <div
        ref={panelRef}
        className="hidden sm:block absolute z-[1000] w-[260px] md:w-[280px] animate-fade-in select-none"
        style={style}
      >
        <button
          onClick={onToggleCollapse}
          className="absolute -left-7 top-3 w-7 h-9 bg-white rounded-l-lg shadow-md flex items-center justify-center text-gray-500 hover:text-gray-800"
          aria-label="Collapse panel"
          title="Collapse panel"
        >
          <ChevronRight size={14} />
        </button>

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
              title="Close panel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">{renderPanelBody(panel)}</div>
        </div>
      </div>
    </>
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
      return <p className="text-xs text-gray-500">Reset map to default view.</p>;
    case "settings":
      return <SettingsPanel />;
  }
}

function LayersPanel() {
  const { layersOn, setLayersOn } = useMapCtx();
  const layers = [
    { key: "councils", label: "Councils (Provinces)" },
    { key: "roads", label: "Base Map" },
    { key: "labels", label: "Labels" },
    { key: "satellite", label: "Satellite" },
  ];
  return (
    <ul className="space-y-2">
      {layers.map((l) => {
        const on = !!layersOn[l.key];
        return (
          <li
            key={l.key}
            className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
          >
            <span className="text-xs text-gray-800">{l.label}</span>
            <button
              onClick={() =>
                setLayersOn((s) => ({ ...s, [l.key]: !s[l.key] }))
              }
              className={`w-9 h-5 rounded-full relative transition ${
                on ? "bg-[#3b39e8]" : "bg-gray-300"
              }`}
              aria-label={`Toggle ${l.label}`}
              title={`Toggle ${l.label}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  on ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function UploadPanel() {
  const { L, map, uploadGroupRef } = useMapCtx();
  const [files, setFiles] = useState<{ name: string; layer: any }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list)) {
      try {
        const text = await f.text();
        const geo = JSON.parse(text);
        const layer = L.geoJSON(geo, {
          style: { color: ACCENT, weight: 2, fillColor: ACCENT, fillOpacity: 0.3 },
        });
        uploadGroupRef.current?.addLayer(layer);
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40] });
        } catch {}
        setFiles((fs) => [...fs, { name: f.name, layer }]);
      } catch (e) {
        console.error("Upload failed", f.name, e);
        window.alert(`Could not parse ${f.name}. Only GeoJSON .json/.geojson supported.`);
      }
    }
  };

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center text-gray-500 hover:border-[#3b39e8] hover:text-[#3b39e8] transition"
      >
        <Upload size={20} />
        <span className="mt-2 text-xs">Upload GeoJSON</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs"
            >
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => {
                  uploadGroupRef.current?.removeLayer(f.layer);
                  setFiles((fs) => fs.filter((_, j) => j !== i));
                }}
                className="text-gray-400 hover:text-red-600"
                aria-label="Remove"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsPanel() {
  const { theme, setTheme, units, setUnits } = useMapCtx();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-800 mb-2">Units</p>
        <div className="bg-gray-100 rounded-full p-1 flex">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 h-7 rounded-full text-[11px] font-medium capitalize transition ${
                units === u ? "bg-[#3b39e8] text-white" : "text-gray-700"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-800 mb-2">Theme</p>
        <div className="bg-gray-100 rounded-full p-1 flex">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 h-7 rounded-full text-[11px] font-medium capitalize transition ${
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
  const { drawTool, setDrawTool, drawStyle, setDrawStyle, clearDrawings, drawCount } = useMapCtx();
  const [tab, setTab] = useState<"draw" | "styles">("draw");
  const [justCleared, setJustCleared] = useState(false);

  const tools: { key: DrawTool; label: string; Icon: any }[] = [
    { key: "point", label: "Point", Icon: Dot },
    { key: "polyline", label: "Polyline", Icon: Slash },
    { key: "text", label: "Text", Icon: Type },
    { key: "polygon", label: "Polygon", Icon: Pencil },
    { key: "circle", label: "Circle", Icon: CircleIcon },
    { key: "rectangle", label: "Rectangle", Icon: Square },
  ];

  return (
    <div>
      <div className="bg-gray-100 rounded-full p-1 flex mb-4">
        {(["draw", "styles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-7 rounded-full text-xs font-medium capitalize transition ${
              tab === t ? "bg-[#3b39e8] text-white" : "text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "draw" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {tools.map(({ key, label, Icon }) => {
              const active = drawTool === key;
              return (
                <button
                  key={key}
                  onClick={() => setDrawTool(active ? null : key)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                    active
                      ? "border-[#3b39e8] bg-[#3b39e8]/5 text-[#3b39e8]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
          {drawTool && (
            <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
              {drawTool === "polyline" || drawTool === "polygon"
                ? "Click to add points, double-click to finish."
                : drawTool === "rectangle"
                ? "Click two opposite corners on the map."
                : drawTool === "circle"
                ? "Click center, then click to set radius."
                : drawTool === "text"
                ? "Click on the map to place a label."
                : "Click on the map to add."}
            </p>
          )}
          <button
            onClick={() => {
              const n = clearDrawings();
              setJustCleared(true);
              window.setTimeout(() => setJustCleared(false), 1500);
              console.log("[Draw] cleared", n, "shapes");
            }}
            className="mt-3 w-full h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition flex items-center justify-center gap-1.5"
          >
            <Trash2 size={12} />
            {justCleared ? "Cleared" : `Clear drawings${drawCount ? ` (${drawCount})` : ""}`}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-800 mb-2">Stroke color</p>
            <div className="flex gap-2">
              {["#3b39e8", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  onClick={() => setDrawStyle((s) => ({ ...s, stroke: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    drawStyle.stroke === c ? "border-gray-900 scale-110" : "border-white"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-800 mb-2">
              Fill opacity: {drawStyle.opacity}%
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={drawStyle.opacity}
              onChange={(e) =>
                setDrawStyle((s) => ({ ...s, opacity: +e.target.value }))
              }
              className="w-full accent-[#3b39e8]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface BookmarkItem {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
}

function BookmarkPanel() {
  const { map } = useMapCtx();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const raw = localStorage.getItem("sevenn-bookmarks");
      return raw ? (JSON.parse(raw) as BookmarkItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sevenn-bookmarks", JSON.stringify(bookmarks));
    } catch {}
  }, [bookmarks]);

  const addBookmark = () => {
    if (!map) return;
    const c = map.getCenter();
    const name = window.prompt("Bookmark name:", `Bookmark ${bookmarks.length + 1}`);
    if (!name) return;
    setBookmarks((bs) => [
      ...bs,
      {
        id: crypto.randomUUID(),
        name,
        center: [c.lat, c.lng],
        zoom: map.getZoom(),
      },
    ]);
  };

  const goTo = (b: BookmarkItem) => {
    map?.flyTo(b.center, b.zoom, { duration: 0.8 });
  };

  if (bookmarks.length === 0) {
    return (
      <div className="bg-[#f5f6ff] rounded-xl py-6 px-4 flex flex-col items-center text-center">
        <Bookmark size={24} className="text-[#3b39e8] fill-[#3b39e8]" />
        <p className="mt-2 font-semibold text-gray-900 text-sm">No Bookmarks</p>
        <p className="mt-1 text-[11px] text-gray-500 max-w-[220px]">
          Add bookmarks to your map and they will appear here.
        </p>
        <button
          onClick={addBookmark}
          className="mt-4 px-4 h-8 rounded-full bg-[#3b39e8] text-white text-xs font-medium hover:opacity-90 transition"
        >
          + Add Bookmark
        </button>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2 max-h-[280px] overflow-y-auto">
        {bookmarks.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs"
          >
            <button
              onClick={() => goTo(b)}
              className="flex items-center gap-2 flex-1 text-left hover:text-[#3b39e8] transition min-w-0"
            >
              <MapPin size={12} className="text-[#3b39e8] shrink-0" />
              <span className="truncate">{b.name}</span>
            </button>
            <button
              onClick={() =>
                setBookmarks((bs) => bs.filter((x) => x.id !== b.id))
              }
              className="text-gray-400 hover:text-red-600 ml-2"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={addBookmark}
        className="w-full mt-3 h-8 rounded-full bg-[#3b39e8] text-white text-xs font-medium hover:opacity-90 transition"
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
  return <span className="w-px h-3 bg-gray-200" />;
}
