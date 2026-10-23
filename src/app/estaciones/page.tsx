"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, AudioLines, Check, ChevronDown, Compass, Heart,
  Home, LoaderCircle, MapPin, Pause, Play, Radio, Search, SkipBack, SkipForward,
  Volume2, VolumeX, Waves,
} from "lucide-react";

type City = "Ciudad de México" | "Monterrey" | "Guadalajara";
type Station = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  bitrate: number;
  codec: string;
  votes: number;
  city: string;
  country?: string;
  state?: string;
  recommendationType?: "local" | "nearby";
  recommendationCountryCode?: string;
};

type UserLocation = { countryName: string; countryCode: string; region: string; city: string };
type Country = { name: string; iso_3166_1: string; stationcount: number };

const cities: City[] = ["Ciudad de México", "Monterrey", "Guadalajara"];
const radioApi = "https://de1.api.radio-browser.info/json/stations/search";
const pageSize = 6;
const nearbyCountryCodes: Record<string, string[]> = {
  MX: ["US", "GT", "BZ"], US: ["CA", "MX"], CA: ["US"], GT: ["MX", "BZ", "SV", "HN"],
  AR: ["CL", "BO", "PY", "UY", "BR"], CL: ["AR", "BO", "PE"], CO: ["VE", "EC", "PE", "BR"],
  ES: ["PT", "FR", "AD"], PT: ["ES"], FR: ["ES", "BE", "DE", "IT", "CH"],
  DE: ["DK", "PL", "CZ", "AT", "CH", "FR", "LU", "BE", "NL"], IT: ["FR", "CH", "AT", "SI"],
  NL: ["BE", "DE"], BE: ["FR", "DE", "LU", "NL"], CH: ["FR", "DE", "AT", "IT"],
  AT: ["DE", "CZ", "SK", "HU", "SI", "IT", "CH"], PL: ["DE", "CZ", "SK", "UA", "BY", "LT"],
  CZ: ["DE", "PL", "SK", "AT"], GB: ["IE", "FR"], IE: ["GB"],
  BR: ["AR", "BO", "CO", "PY", "UY", "VE"], JP: ["KR", "CN"], KR: ["KP", "JP", "CN"],
  IN: ["PK", "CN", "NP", "BT", "BD", "MM"], CN: ["IN", "RU", "MN", "KP", "KR", "VN", "LA", "MM", "PK"],
  TH: ["MM", "LA", "KH", "MY"], VN: ["CN", "LA", "KH"], ID: ["MY", "PG", "TL"],
  ZA: ["NA", "BW", "ZW", "MZ", "LS", "SZ"], EG: ["LY", "SD", "IL"], KE: ["ET", "SO", "TZ", "UG"],
  NG: ["NE", "TD", "CM", "BJ"], MA: ["DZ", "MR", "ES"],
};
const accents = ["#bda2ff", "#caff64", "#f6aa89", "#84d4cc", "#ffcf7a", "#f28faf"];
const genres = [
  { label: "Todos", terms: [] },
  { label: "Deportes", terms: ["sports", "sport", "deportes", "deporte"] },
  { label: "Música", terms: ["music", "musica", "rock", "pop", "jazz", "salsa", "cumbia", "latin", "regional", "banda", "grupera", "clasica", "electronic", "indie", "metal", "hip hop", "reggae", "blues", "folk"] },
  { label: "Rock", terms: ["rock"] },
  { label: "Pop", terms: ["pop"] },
  { label: "Jazz", terms: ["jazz"] },
  { label: "Regional mexicana", terms: ["regional", "grupera", "banda", "nortena", "ranchera"] },
  { label: "Debate", terms: ["talk", "debate", "discussion", "opinion"] },
  { label: "Noticias", terms: ["news", "noticias", "informacion", "information"] },
  { label: "Niños", terms: ["children", "kids", "infantil", "ninos"] },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export default function HomePage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [city, setCity] = useState<City>("Ciudad de México");
  const [exploreMode, setExploreMode] = useState<"city" | "country">("city");
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState<Country | null>(null);
  const [region, setRegion] = useState("*");
  const [countryStations, setCountryStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(0.72);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [genre, setGenre] = useState("Todos");
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "detecting" | "ready" | "error">("idle");
  const [locationError, setLocationError] = useState("");
  const [recommendations, setRecommendations] = useState<Station[]>([]);
  const locationAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://de1.api.radio-browser.info/json/countries?order=stationcount&reverse=true")
      .then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Country[]>; })
      .then((data) => { if (!cancelled) setCountries(data.filter((item) => item.iso_3166_1 && item.stationcount > 0)); })
      .catch(() => { if (!cancelled) setError("No se pudo cargar la lista de países. Inténtalo de nuevo."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setRegion("*");
    const params = new URLSearchParams({ countrycode: country.iso_3166_1, hidebroken: "true", order: "votes", reverse: "true", limit: "1000" });
    fetch(`${radioApi}?${params}`)
      .then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<(Omit<Station, "city"> & { city?: string })[]>; })
      .then((data) => {
        if (cancelled) return;
        const normalized = data.filter((station) => station.url_resolved?.startsWith("http"))
          .map((station) => ({ ...station, city: station.state || station.city || country.name }));
        setCountryStations(normalized);
        if (!normalized.length) setError("No encontramos estaciones disponibles para este país.");
      })
      .catch(() => { if (!cancelled) setError("No se pudieron cargar las estaciones de este país."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("Gugli-favorite-stations");
      if (saved) {
        const ids: unknown = JSON.parse(saved);
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) setFavorites(ids);
      }
    } catch {
      // Storage can be disabled by the browser; favorites still work for this session.
    }
    setFavoritesLoaded(true);
  }, []);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Este navegador no permite detectar la ubicación. Puedes seguir explorando las ciudades.");
      setLocationStatus("error");
      return;
    }
    setLocationStatus("detecting");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), localityLanguage: "es" });
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
        if (!response.ok) throw new Error();
        const place = await response.json() as { countryName?: string; countryCode?: string; principalSubdivision?: string; city?: string; locality?: string };
        if (!place.countryName || !place.countryCode) throw new Error();
        const location = { countryName: place.countryName, countryCode: place.countryCode.toUpperCase(), region: place.principalSubdivision || "", city: place.city || place.locality || "" };
        setUserLocation(location);
        let nearbyCodes = nearbyCountryCodes[location.countryCode] || [];
        try {
          const countryResponse = await fetch(`https://restcountries.com/v3.1/alpha/${location.countryCode}?fields=borders`);
          if (countryResponse.ok) {
            const countryResult = await countryResponse.json() as { borders?: string[] } | { borders?: string[] }[];
            const alpha3Codes = (Array.isArray(countryResult) ? countryResult[0]?.borders : countryResult.borders) || [];
            if (alpha3Codes.length) {
              const neighborResponse = await fetch(`https://restcountries.com/v3.1/alpha?codes=${alpha3Codes.join(",")}&fields=cca2,cca3`);
              if (neighborResponse.ok) {
                const neighborData = await neighborResponse.json() as { cca2?: string }[];
                nearbyCodes = neighborData.flatMap((item) => item.cca2 ? [item.cca2] : []);
              }
            }
          }
        } catch {
          // Keep the built-in nearby-country suggestions if the borders catalog is unavailable.
        }
        const searches = [
          ...(location.city ? [{ countryCode: location.countryCode, state: location.city, type: "local" as const }] : []),
          ...(location.region ? [{ countryCode: location.countryCode, state: location.region, type: "local" as const }] : []),
          { countryCode: location.countryCode, type: "local" as const },
          ...nearbyCodes.slice(0, 3).map((countryCode) => ({ countryCode, type: "nearby" as const })),
        ];
        const results = await Promise.all(searches.map(async ({ countryCode, state, type }) => {
          const search = new URLSearchParams({ countrycode: countryCode, hidebroken: "true", order: "votes", reverse: "true", limit: type === "local" ? "12" : "8" });
          if (state) search.set("state", state);
          const result = await fetch(`${radioApi}?${search}`);
          if (!result.ok) return [];
          const data = await result.json() as Omit<Station, "city">[];
          return data.filter((station) => station.url_resolved?.startsWith("http")).map((station) => ({
            ...station,
            city: station.state || (type === "local" ? location.region || location.city : station.country) || location.countryName,
            recommendationType: type,
            recommendationCountryCode: countryCode,
          }));
        }));
        const unique = new Map<string, Station>();
        results.flat().forEach((station) => unique.set(station.stationuuid, station));
        const allStations = [...unique.values()];
        const nearbyLeaders = nearbyCodes.slice(0, 3)
          .map((countryCode) => allStations.find((station) => station.recommendationType === "nearby" && station.recommendationCountryCode === countryCode))
          .filter((station): station is Station => Boolean(station));
        const nearbyIds = new Set(nearbyLeaders.map((station) => station.stationuuid));
        setRecommendations([
          ...allStations.filter((station) => station.recommendationType === "local"),
          ...nearbyLeaders,
          ...allStations.filter((station) => station.recommendationType === "nearby" && !nearbyIds.has(station.stationuuid)),
        ]);
        setLocationStatus("ready");
      } catch {
        setLocationError("No pudimos encontrar estaciones para tu ubicación. Intenta de nuevo.");
        setLocationStatus("error");
      }
    }, () => {
      setLocationError("No se pudo acceder a tu ubicación. Revisa el permiso del navegador o elige una ciudad.");
      setLocationStatus("error");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }, []);

  useEffect(() => {
    if (locationAttempted.current) return;
    locationAttempted.current = true;
    detectLocation();
  }, [detectLocation]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      window.localStorage.setItem("Gugli-favorite-stations", JSON.stringify(favorites));
    } catch {
      // Favorites remain available for the current session when storage is unavailable.
    }
  }, [favorites, favoritesLoaded]);

  useEffect(() => {
    let cancelled = false;
    const loadStations = async () => {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.all(cities.map(async (targetCity) => {
          const params = new URLSearchParams({
            country: "Mexico",
            state: targetCity === "Monterrey" ? "Nuevo León" : targetCity === "Guadalajara" ? "Jalisco" : "Mexico City",
            hidebroken: "true",
            order: "votes",
            reverse: "true",
            limit: "100",
          });
          const response = await fetch(`${radioApi}?${params}`);
          if (!response.ok) throw new Error("No pudimos conectar con el catálogo de estaciones.");
          const data = (await response.json()) as (Omit<Station, "city"> & { city?: string })[];
          const cityAliases: Record<City, string[]> = {
            "Ciudad de México": ["ciudad de méxico", "mexico city", "cdmx"],
            Monterrey: ["monterrey", "san nicolás", "san nicolas", "guadalupe"],
            Guadalajara: ["guadalajara", "zapopan", "tlaquepaque", "tonala", "tonalá"],
          };
          return data
            .filter((station) => station.url_resolved?.startsWith("http") &&
              (!station.city || cityAliases[targetCity].some((alias) => station.city!.toLocaleLowerCase("es").includes(alias))))
            .map((station) => ({ ...station, city: targetCity }));
        }));
        if (!cancelled) {
          const unique = new Map<string, Station>();
          results.flat().forEach((station) => unique.set(station.stationuuid, station));
          setStations([...unique.values()]);
          if (!unique.size) setError("Todavía no hay estaciones disponibles para estas ciudades.");
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadStations();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const visibleStations = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const selectedGenre = genres.find((item) => item.label === genre);
    const catalog = showFavorites
      ? [...new Map([...stations, ...recommendations].map((station) => [station.stationuuid, station] as const)).values()]
      : exploreMode === "country" ? countryStations : stations;
    return catalog.filter((station) => {
      const matchesView = showFavorites ? favorites.includes(station.stationuuid) : exploreMode === "country"
        ? (region === "*" || station.city === region)
        : station.city === city;
      const searchContent = normalize(`${station.name} ${station.tags || ""}`);
      const matchesQuery = !normalizedQuery || searchContent.includes(normalizedQuery);
      const matchesGenre = !selectedGenre?.terms.length || selectedGenre.terms.some((term) => searchContent.includes(normalize(term)));
      return matchesView && matchesQuery && matchesGenre;
    });
  }, [city, countryStations, exploreMode, favorites, genre, query, recommendations, region, showFavorites, stations]);

  const pageCount = Math.max(1, Math.ceil(visibleStations.length / pageSize));
  const pageStations = visibleStations.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [city, genre, query, showFavorites, exploreMode, country, region]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const playStation = async (station: Station) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (selected?.stationuuid === station.stationuuid && playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    setError("");
    setSelected(station);
    audio.src = station.url_resolved;
    audio.load();
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError(`No se pudo reproducir ${station.name}. Puede que su stream esté fuera de línea.`);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !selected) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
      setError("");
    } catch {
      setError("Esta estación no está disponible ahora. Prueba otra emisora.");
    }
  };

  const moveStation = (direction: -1 | 1) => {
    const currentList = selected?.recommendationType ? recommendations : visibleStations;
    if (currentList.length < 2) return;
    const currentIndex = currentList.findIndex((station) => station.stationuuid === selected?.stationuuid);
    const nextIndex = currentIndex === -1
      ? direction === 1 ? 0 : currentList.length - 1
      : (currentIndex + direction + currentList.length) % currentList.length;
    void playStation(currentList[nextIndex]);
  };

  const toggleFavorite = (station: Station) => setFavorites((current) =>
    current.includes(station.stationuuid)
      ? current.filter((id) => id !== station.stationuuid)
      : [...current, station.stationuuid],
  );

  return (
    <main className="radio-app radio-page">
      <audio ref={audioRef} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError("No se pudo conectar con la transmisión. Prueba otra estación."); }} />
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Gugli, inicio"><span className="brand-mark"><Waves size={21} strokeWidth={2.5} /></span><span>Gugli<span className="brand-dot">.</span></span></Link>
        <div className="side-label">EXPLORA</div>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link className="nav-item" href="/"><Home size={19} /><span>Inicio</span></Link>
          <Link className={`nav-item ${showFavorites ? "" : "active"}`} href="/estaciones" onClick={() => setShowFavorites(false)}><Compass size={19} /><span>Estaciones</span></Link>
          <a className="nav-item" href="#estaciones" onClick={() => { setShowFavorites(false); setSearchOpen(true); }}><Search size={19} /><span>Buscar</span></a>
          
        </nav>
        <div className="side-divider" />
        <div className="library-heading"><span className="side-label">TU Gugli</span></div>
        <button className={`library-card ${showFavorites ? "library-card-active" : ""}`} onClick={() => setShowFavorites(true)}><span className="library-icon favorites-library-icon"><Heart size={17} fill="currentColor" /></span><span><b>Mis favoritas</b><small>{favorites.length} estaciones guardadas</small></span></button>
        <button className={`library-card ${exploreMode === "country" ? "library-card-active" : ""}`} onClick={() => { setShowFavorites(false); setExploreMode("country"); setCountry(null); }}><span className="library-icon"><MapPin size={17} /></span><span><b>Explorar por país</b><small>País, estado o región</small></span></button>
        <div className="oss-card"><span className="oss-symbol">✳</span><b>Radio libre para todos.</b><p>Sin planes de pago. Sin barreras. Solo estaciones y comunidad.</p><span className="oss-label"><Check size={12} /> CÓDIGO ABIERTO</span></div>
        <div className="sidebar-bottom"><span className="oss-avatar"><Waves size={15}/></span><span className="profile-text"><b>Gugli Radio</b><small>Proyecto comunitario</small></span></div>
      </aside>

      <section className="main-column" id="inicio">
        <header className="topbar"><div className="history-buttons"><button aria-label="Atrás" onClick={() => window.history.back()}><ArrowLeft size={18} /></button><button aria-label="Adelante" onClick={() => window.history.forward()}><ArrowRight size={18} /></button></div><div className="topbar-right"><span className="live-pill"><i /> RADIO EN VIVO</span><a className="github-link" href="https://github.com/marcelosg-dev/RadioProject" target="_blank" rel="noreferrer">Código abierto <ArrowRight size={13}/></a></div></header>
        <div className="content radio-content">
          <div className="greeting"><div><p className="eyebrow">RADIO LOCAL, SIN FRONTERAS</p><h1>Tu ciudad, <span>tu frecuencia.</span></h1><p className="greeting-sub">Sintoniza estaciones reales de México. Gratis y en vivo.</p></div><div className="greeting-art"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><AudioLines size={39} /></div></div>
          <section className="section-block location-recommendations" aria-labelledby="location-heading">
            <div className="section-heading"><div><p className="eyebrow">FRECUENCIAS A TU ALREDEDOR</p><h2 id="location-heading">Recomendadas para ti</h2></div>{locationStatus !== "ready" && <button className="text-link location-detect" onClick={detectLocation} disabled={locationStatus === "detecting"}><MapPin size={14}/>{locationStatus === "detecting" ? "Detectando…" : "Detectar ubicación"}</button>}</div>
            {userLocation && locationStatus === "ready" && <p className="location-result"><MapPin size={13}/>{[userLocation.city, userLocation.region, userLocation.countryName].filter(Boolean).join(" · ")}</p>}
            {locationStatus === "idle" && <p className="location-help">Tu navegador pedirá permiso para sugerirte radios de tu zona.</p>}
            {locationError && <div className="station-error" role="status">{locationError}</div>}
            {locationStatus === "ready" && recommendations.length > 0 && <>
              <p className="recommendation-label">TU CIUDAD, PAÍS Y REGIÓN</p>
              <div className="real-station-grid">{recommendations.filter((station) => station.recommendationType === "local").slice(0, 3).map((station, index) => <article className={`real-station ${selected?.stationuuid === station.stationuuid ? "selected" : ""}`} key={station.stationuuid} style={{ "--station-accent": accents[index % accents.length] } as CSSProperties}><button className="real-station-play" onClick={() => void playStation(station)} aria-label={`Escuchar ${station.name}`}>{selected?.stationuuid === station.stationuuid && playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button><div className="real-station-top"><span className="station-wave"><AudioLines size={19}/></span><button className={`station-favorite ${favorites.includes(station.stationuuid) ? "liked" : ""}`} onClick={() => toggleFavorite(station)} aria-label="Añadir a favoritas"><Heart size={17} fill={favorites.includes(station.stationuuid) ? "currentColor" : "none"}/></button></div><span className="real-station-city"><i/>{station.state || station.city}</span><h3>{station.name}</h3><p className="real-station-tags">{station.tags?.split(",").slice(0, 3).join(" · ") || "Radio en vivo"}</p><div className="real-station-meta"><span>{station.country || userLocation.countryName}</span><span>{station.votes} <Heart size={11}/></span></div></article>)}</div>
              {recommendations.some((station) => station.recommendationType === "nearby") && <><p className="recommendation-label nearby-label">PAÍSES CERCANOS</p><div className="real-station-grid">{recommendations.filter((station) => station.recommendationType === "nearby").slice(0, 3).map((station, index) => <article className={`real-station ${selected?.stationuuid === station.stationuuid ? "selected" : ""}`} key={station.stationuuid} style={{ "--station-accent": accents[(index + 3) % accents.length] } as CSSProperties}><button className="real-station-play" onClick={() => void playStation(station)} aria-label={`Escuchar ${station.name}`}>{selected?.stationuuid === station.stationuuid && playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button><div className="real-station-top"><span className="station-wave"><AudioLines size={19}/></span><button className={`station-favorite ${favorites.includes(station.stationuuid) ? "liked" : ""}`} onClick={() => toggleFavorite(station)} aria-label="Añadir a favoritas"><Heart size={17} fill={favorites.includes(station.stationuuid) ? "currentColor" : "none"}/></button></div><span className="real-station-city"><i/>{station.country || station.city}</span><h3>{station.name}</h3><p className="real-station-tags">{station.tags?.split(",").slice(0, 3).join(" · ") || "Radio en vivo"}</p><div className="real-station-meta"><span>{station.state || "País cercano"}</span><span>{station.votes} <Heart size={11}/></span></div></article>)}</div></>}
            </>}
            {locationStatus === "ready" && recommendations.length === 0 && <div className="empty-stations"><Radio size={24}/><span>No encontramos estaciones para esta zona por ahora.</span></div>}
          </section>
          <section className="section-block" id="estaciones">
            <div className="section-heading"><div><p className="eyebrow">{showFavorites ? "TU COLECCIÓN PERSONAL" : exploreMode === "country" ? "EXPLORA EL CATÁLOGO GLOBAL" : "DESCUBRE LO QUE SUENA"}</p><h2>{showFavorites ? "Mis estaciones favoritas" : exploreMode === "country" ? "Explorar por país" : "Estaciones cerca de ti"}</h2></div><span className="catalog-badge"><span/> CATÁLOGO ABIERTO</span></div>
            {!showFavorites && exploreMode === "city" && <div className="city-tabs" role="tablist" aria-label="Filtrar por ciudad">{cities.map((cityName, index) => <button key={cityName} role="tab" aria-selected={city === cityName} className={`city-tab ${city === cityName ? "active" : ""}`} onClick={() => { setCity(cityName); setQuery(""); }}><span className="city-tab-number">0{index + 1}</span><span>{cityName}</span><ChevronDown size={13}/></button>)}</div>}
            {!showFavorites && exploreMode === "country" && <div className="country-explorer">
              <button className="country-explorer-back" onClick={() => setExploreMode("city")}><ArrowLeft size={13}/> Explorar por ciudad</button>
              <label>País disponible<select value={country?.iso_3166_1 || ""} onChange={(event) => { const next = countries.find((item) => item.iso_3166_1 === event.target.value) || null; setCountry(next); setCountryStations([]); setQuery(""); }}><option value="">Selecciona un país…</option>{countries.map((item) => <option key={item.iso_3166_1} value={item.iso_3166_1}>{item.name} · {item.stationcount.toLocaleString("es-MX")} estaciones</option>)}</select></label>
              {country && <label>Estado, ciudad o región<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="*">Todas las estaciones de {country.name}</option>{[...new Set(countryStations.map((station) => station.city).filter((place) => place !== country.name))].sort((a, b) => a.localeCompare(b, "es")).map((place) => <option key={place} value={place}>{place}</option>)}</select></label>}
            </div>}
            <div className="station-tools"><span className="station-location"><MapPin size={14}/>{showFavorites ? "Todas tus ciudades" : exploreMode === "country" ? (region === "*" ? country?.name || "Selecciona un país" : `${region}, ${country?.name}`) : city}<span className="location-count">{loading ? "···" : `${visibleStations.length} estaciones`}</span></span><div className={`station-search ${searchOpen ? "open" : ""}`}><Search size={15}/><input aria-label="Buscar estación" placeholder="Buscar estación o género" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => { if (!query) setSearchOpen(false); }}/>{query && <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda">×</button>}</div></div>
            <div className="genre-filters" role="group" aria-label="Filtrar por tipo de programa o género">{genres.map((item) => <button key={item.label} className={`genre-chip ${genre === item.label ? "active" : ""}`} aria-pressed={genre === item.label} onClick={() => setGenre(item.label)}>{item.label}</button>)}</div>
            {error && <div className="station-error" role="status">{error}</div>}
            {loading ? <div className="station-loading"><LoaderCircle size={22}/><span>Buscando frecuencias en {showFavorites ? "tus favoritas" : city}…</span></div> : visibleStations.length ? <div className="real-station-grid">{pageStations.map((station, index) => <article className={`real-station ${selected?.stationuuid === station.stationuuid ? "selected" : ""}`} key={station.stationuuid} style={{ "--station-accent": accents[index % accents.length] } as CSSProperties}><button className="real-station-play" onClick={() => void playStation(station)} aria-label={`${selected?.stationuuid === station.stationuuid && playing ? "Pausar" : "Escuchar"} ${station.name}`}>{selected?.stationuuid === station.stationuuid && playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button><div className="real-station-top"><span className="station-wave"><AudioLines size={19}/></span><button className={`station-favorite ${favorites.includes(station.stationuuid) ? "liked" : ""}`} onClick={() => toggleFavorite(station)} aria-label="Añadir a favoritos"><Heart size={17} fill={favorites.includes(station.stationuuid) ? "currentColor" : "none"}/></button></div><span className="real-station-city"><i/>{station.city.toUpperCase()}</span><h3>{station.name}</h3><p className="real-station-tags">{station.tags?.split(",").slice(0, 3).join(" · ") || "Radio en vivo"}</p><div className="real-station-meta"><span>{station.codec || "STREAM"}{station.bitrate ? ` · ${station.bitrate} KBPS` : ""}</span><span>{station.votes} <Heart size={11}/></span></div>{station.homepage && <a className="station-homepage" href={station.homepage} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Sitio de la estación <ArrowRight size={12}/></a>}</article>)}</div> : <div className="empty-stations"><Radio size={26}/><b>{showFavorites && !favorites.length ? "Aún no guardas estaciones favoritas." : "No encontramos estaciones con estos filtros."}</b><span>{showFavorites && !favorites.length ? "Toca el corazón de una estación para guardarla aquí." : "Prueba con otra ciudad, género o búsqueda."}</span></div>}
            {!loading && visibleStations.length > pageSize && <nav className="station-pagination" aria-label="Paginación de estaciones"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleStations.length)} de {visibleStations.length} estaciones</span><div><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Anterior</button><b>Página {page} de {pageCount}</b><button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Siguiente</button></div></nav>}
          </section>
          <section className="community-card"><div className="community-mark"><Waves size={26}/></div><div><span className="eyebrow">LA RADIO ES DE TODOS</span><h2>Un proyecto abierto, hecho para escuchar.</h2><p>Las estaciones pertenecen a sus emisoras. Gugli reúne sus transmisiones públicas en un solo lugar.</p></div><a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Conocer el catálogo <ArrowRight size={14}/></a></section>
          <footer className="footer-note"><span>Gugli conecta con transmisiones públicas de las emisoras.</span><span>Hecho con ♥ y código abierto.</span></footer>
        </div>
      </section>

      <aside className="now-playing radio-player" id="reproductor"><div className="now-header"><span><i className={`equalizer ${playing ? "is-playing" : ""}`}><b/><b/><b/><b/></i> REPRODUCTOR</span><span className="player-live-tag"><i/> EN VIVO</span></div><div className="player-art"><span className="player-art-orbit player-orbit-one"/><span className="player-art-orbit player-orbit-two"/><Waves size={52}/><span className="player-art-signal">◖)))</span><span className="player-art-caption">LA FRECUENCIA<br/>DE TU CIUDAD</span></div><div className="now-track"><div><span className="eyebrow">{selected ? selected.city.toUpperCase() : "AÚN SIN SINTONIZAR"}</span><h3>{selected?.name || "Elige una estación"}</h3><p>{selected ? (selected.tags?.split(",").slice(0,2).join(" · ") || "Transmisión en vivo") : "Tu próximo descubrimiento te espera."}</p></div>{selected && <button className={`heart-button ${favorites.includes(selected.stationuuid) ? "liked" : ""}`} onClick={() => toggleFavorite(selected)} aria-label="Añadir estación a favoritos"><Heart size={20} fill={favorites.includes(selected.stationuuid) ? "currentColor" : "none"}/></button>}</div><div className="player-status"><span className={`player-status-dot ${playing ? "active" : ""}`}/><span>{playing ? "Estás escuchando en vivo" : selected ? "Transmisión pausada" : "Selecciona una frecuencia"}</span></div><div className="radio-controls"><button className="station-skip" onClick={() => moveStation(-1)} disabled={!selected || visibleStations.length < 2} aria-label="Estación anterior"><SkipBack size={18}/></button><button className="radio-main-control" onClick={() => void togglePlay()} disabled={!selected} aria-label={playing ? "Pausar estación" : "Reproducir estación"}>{playing ? <Pause size={21} fill="currentColor"/> : <Play size={21} fill="currentColor"/>}</button><button className="station-skip" onClick={() => moveStation(1)} disabled={!selected || visibleStations.length < 2} aria-label="Siguiente estación"><SkipForward size={18}/></button></div><div className="volume-control"><button aria-label={volume === 0 ? "Activar sonido" : "Silenciar"} onClick={() => setVolume(volume === 0 ? 0.72 : 0)}>{volume === 0 ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button><input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} style={{ "--volume-level": `${volume * 100}%` } as CSSProperties} onChange={(event) => setVolume(Number(event.target.value))}/><span>{Math.round(volume * 100)}%</span></div><div className="player-info"><span><Check size={14}/> Reproducción gratuita</span><p>El audio se transmite directamente desde cada estación.</p></div><div className="player-source"><span className="source-icon"><Radio size={16}/></span><span><b>Fuente abierta</b><small>Radio Browser · comunidad</small></span><a href="https://www.radio-browser.info/" aria-label="Catálogo Radio Browser" target="_blank" rel="noreferrer"><ArrowRight size={15}/></a></div></aside>

      <div className="mobile-player"><span className="mobile-cover"><Waves size={18}/></span><span className="mobile-track-copy"><b>{selected?.name || "Gugli Radio"}</b><small>{playing ? "En vivo · " : "Gratis · "}{selected?.city || "elige una estación"}</small></span><label className="mobile-volume" aria-label="Volumen"><Volume2 size={14}/><input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} style={{ "--volume-level": `${volume * 100}%` } as CSSProperties} onChange={(event) => setVolume(Number(event.target.value))}/></label><button className="mobile-skip" onClick={() => moveStation(-1)} disabled={!selected || visibleStations.length < 2} aria-label="Estación anterior"><SkipBack size={15}/></button><button onClick={() => void togglePlay()} disabled={!selected} aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><button className="mobile-skip" onClick={() => moveStation(1)} disabled={!selected || visibleStations.length < 2} aria-label="Siguiente estación"><SkipForward size={15}/></button></div>
    </main>
  );
}
