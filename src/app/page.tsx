"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight, AudioLines, Check, Compass, Globe2, Headphones, Home, LoaderCircle,
  MapPin, Pause, Play, Radio, Search, SkipBack, SkipForward, Volume2, VolumeX, Waves,
} from "lucide-react";

type Station = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  votes: number;
  clickcount: number;
};

const apiRoot = "https://de1.api.radio-browser.info/json/stations";
const accents = ["#bda2ff", "#caff64", "#f6aa89", "#84d4cc", "#ffcf7a", "#f28faf"];
const countries = [
  { label: "México", api: "Mexico", flag: "\u{1F1F2}\u{1F1FD}", note: "De aquí cerca" },
  { label: "Argentina", api: "Argentina", flag: "\u{1F1E6}\u{1F1F7}", note: "Nuevas voces" },
  { label: "Colombia", api: "Colombia", flag: "\u{1F1E8}\u{1F1F4}", note: "Ritmos y noticias" },
  { label: "España", api: "Spain", flag: "\u{1F1EA}\u{1F1F8}", note: "Al otro lado" },
  { label: "Brasil", api: "Brazil", flag: "\u{1F1E7}\u{1F1F7}", note: "Siente el ritmo" },
  { label: "Japón", api: "Japan", flag: "\u{1F1EF}\u{1F1F5}", note: "Una señal distinta" },
];

export default function HomePage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<(typeof countries)[number] | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchedTerm, setSearchedTerm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiRoot}/topclick/50?hidebroken=true`)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo conectar con el catálogo.");
        return response.json() as Promise<Station[]>;
      })
      .then((data) => {
        if (!cancelled) setStations(data.filter((station) => station.url_resolved));
      })
      .catch(() => {
        if (!cancelled) setError("No pudimos cargar las tendencias. Intenta de nuevo en un momento.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const findStations = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setError("");
    setSelectedCountry(null);
    setSearchedTerm(term);
    try {
      const params = new URLSearchParams({ name: term, order: "clickcount", reverse: "true", limit: "50", hidebroken: "true" });
      const response = await fetch(`${apiRoot}/search?${params}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Station[];
      setStations(data.filter((station) => station.url_resolved));
      if (!data.length) setError(`No encontramos estaciones para “${term}”. Prueba con otro nombre.`);
    } catch {
      setError("No se pudo completar la búsqueda. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setLoading(false);
    }
  };

  const exploreCountry = async (country: (typeof countries)[number]) => {
    setSelectedCountry(country);
    setQuery("");
    setSearchedTerm("");
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ country: country.api, order: "clickcount", reverse: "true", limit: "50", hidebroken: "true" });
      const response = await fetch(`${apiRoot}/search?${params}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Station[];
      setStations(data.filter((station) => station.url_resolved));
      if (!data.length) setError(`Aún no hay estaciones disponibles de ${country.label}.`);
    } catch {
      setError("No se pudo cargar esta selección. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const resetTrending = async () => {
    setSelectedCountry(null);
    setQuery("");
    setSearchedTerm("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiRoot}/topclick/50?hidebroken=true`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Station[];
      setStations(data.filter((station) => station.url_resolved));
    } catch {
      setError("No pudimos cargar las tendencias. Intenta de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  };

  const playStation = async (station: Station) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (selected?.stationuuid === station.stationuuid && playing) {
      audio.pause();
      return;
    }
    setSelected(station);
    setError("");
    audio.src = station.url_resolved;
    audio.load();
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setError(`No se pudo reproducir ${station.name}. Prueba otra emisora.`);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !selected) return;
    if (playing) { audio.pause(); return; }
    try { await audio.play(); setError(""); }
    catch { setError("Esta estación no está disponible ahora. Prueba otra emisora."); }
  };

  const moveStation = (direction: -1 | 1) => {
    if (stations.length < 2) return;
    const currentIndex = stations.findIndex((station) => station.stationuuid === selected?.stationuuid);
    const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : stations.length - 1) : (currentIndex + direction + stations.length) % stations.length;
    void playStation(stations[nextIndex]);
  };

  const title = searchedTerm && !selectedCountry
    ? `Resultados para “${searchedTerm}”`
    : selectedCountry ? `Sonidos de ${selectedCountry.label}` : "Lo que más se escucha";

  return (
    <main className="radio-app radio-page radio-home">
      <audio ref={audioRef} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError("La transmisión no está disponible ahora. Prueba otra estación."); }} />
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Onda, inicio"><span className="brand-mark"><Waves size={21} strokeWidth={2.5} /></span><span>onda<span className="brand-dot">.</span></span></Link>
        <div className="side-label">EXPLORA</div>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link className="nav-item active" href="/"><Home size={19} /><span>Inicio</span></Link>
          <Link className="nav-item" href="/estaciones"><Compass size={19} /><span>Estaciones</span></Link>
          <a className="nav-item" href="#busqueda" onClick={() => document.getElementById("station-search")?.focus()}><Search size={19} /><span>Buscar</span></a>
          <a className="nav-item" href="#tendencias"><Radio size={19} /><span>En tendencia</span></a>
        </nav>
        <div className="side-divider" />
        <div className="library-heading"><span className="side-label">DESCUBRIR</span></div>
        <Link className="library-card" href="/estaciones"><span className="library-icon"><MapPin size={17} /></span><span><b>Mi ciudad</b><small>CDMX· Monterrey· GDL</small></span></Link>
        <div className="oss-card"><span className="oss-symbol">✳</span><b>La radio es de todos.</b><p>Explora señales de todo el mundo. Gratis, sin barreras.</p><span className="oss-label"><Waves size={12} /> CÓDIGO ABIERTO</span></div>
        <div className="sidebar-bottom"><span className="oss-avatar"><Waves size={15}/></span><span className="profile-text"><b>Onda Radio</b><small>Proyecto comunitario</small></span></div>
      </aside>

      <section className="main-column home-main" id="inicio">
        <header className="topbar"><div className="history-buttons"><span className="home-date-pill"><Globe2 size={14}/> UNA RADIO, MUCHOS MUNDOS</span></div><div className="topbar-right"><span className="live-pill"><i /> EN VIVO</span><a className="github-link" href="https://github.com/marcelosg-dev/RadioProject" target="_blank" rel="noreferrer">Código abierto <ArrowRight size={13}/></a></div></header>
        <div className="content radio-content home-content">
          <section className="home-hero" id="busqueda"><div className="home-hero-copy"><p className="eyebrow">SINTONIZA ALGO NUEVO</p><h1>Hay todo un mundo<br/>sonando <span>ahí fuera.</span></h1><p>Encuentra tu próxima estación favorita, desde tu ciudad hasta el otro lado del mundo.</p></div><div className="home-hero-art"><span className="hero-orbit hero-orbit-a"/><span className="hero-orbit hero-orbit-b"/><AudioLines size={44}/><span className="hero-art-dot"/></div>
            <form className="home-search" onSubmit={findStations}><Search size={19}/><input id="station-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca una estación por nombre" aria-label="Buscar una estación"/><button type="submit" disabled={loading || !query.trim()}><span>Buscar</span><ArrowRight size={16}/></button></form>
          </section>

          <section className="country-section"><div className="home-section-heading"><div><p className="eyebrow">CAMBIA DE HORIZONTE</p><h2>Países para descubrir</h2></div><span>Una señal distinta en cada lugar</span></div><div className="country-grid">{countries.map((country, index) => <button key={country.api} className={`country-card country-card-${index + 1} ${selectedCountry?.api === country.api ? "active" : ""}`} onClick={() => void exploreCountry(country)}><span className="country-flag">{country.flag}</span><span className="country-copy"><b>{country.label}</b><small>{country.note}</small></span><ArrowRight size={15}/></button>)}</div></section>

          <section className="trending-section" id="tendencias"><div className="home-section-heading"><div><p className="eyebrow">LAS FRECUENCIAS DEL MOMENTO</p><h2>{title}</h2></div>{selectedCountry || query ? <button className="home-reset" onClick={() => void resetTrending()}>Ver tendencias <ArrowRight size={14}/></button> : <span className="trending-live"><span/> ACTUALIZADO DESDE EL CATÁLOGO</span>}</div><p className="trend-caption">Estaciones con más sintonizaciones registradas en Radio Browser.</p>
            {error && <div className="station-error" role="status">{error}</div>}
            {loading ? <div className="station-loading"><LoaderCircle size={23}/><span>Buscando buenas señales…</span></div> : stations.length ? <div className="home-station-grid">{stations.slice(0, 6).map((station, index) => <article className={`home-station-card ${selected?.stationuuid === station.stationuuid ? "selected" : ""}`} key={station.stationuuid} style={{ "--station-accent": accents[index % accents.length] } as CSSProperties}><div className="home-station-card-top"><span className="trend-rank">{String(index + 1).padStart(2, "0")}</span><span className="home-station-wave"><AudioLines size={21}/></span><button className="home-station-play" onClick={() => void playStation(station)} aria-label={`${selected?.stationuuid === station.stationuuid && playing ? "Pausar" : "Escuchar"} ${station.name}`}>{selected?.stationuuid === station.stationuuid && playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button></div><span className="home-station-country"><Globe2 size={12}/>{station.country || selectedCountry?.label || "RADIO GLOBAL"}</span><h3>{station.name}</h3><p>{station.tags?.split(",").slice(0, 3).join(" · ") || "Radio en vivo"}</p><div className="home-station-card-footer"><span><Headphones size={13}/> {station.clickcount?.toLocaleString("es-MX") || "En tendencia"}</span>{station.homepage && <a href={station.homepage} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Emisora <ArrowRight size={12}/></a>}</div></article>)}</div> : <div className="empty-stations"><Radio size={26}/><b>No encontramos estaciones.</b><span>Prueba con otro nombre o país.</span></div>}
          </section>

          <section className="home-city-banner"><span className="home-city-icon"><MapPin size={20}/></span><div><b>¿Buscas las estaciones de tu ciudad?</b><small>Explora la radio local de Ciudad de México, Monterrey y Guadalajara.</small></div><Link href="/estaciones">Explorar estaciones locales <ArrowRight size={14}/></Link></section>
          <footer className="footer-note"><span>Onda conecta con transmisiones públicas de todo el mundo.</span><span>Hecho con ♥ y código abierto.</span></footer>
        </div>
      </section>

      <aside className="now-playing radio-player" id="reproductor">
        <div className="now-header"><span><i className={`equalizer ${playing ? "is-playing" : ""}`}><b/><b/><b/><b/></i> REPRODUCTOR</span><span className="player-live-tag"><i/> EN VIVO</span></div>
        <div className="player-art"><span className="player-art-orbit player-orbit-one"/><span className="player-art-orbit player-orbit-two"/><Waves size={52}/><span className="player-art-signal">◖)))</span><span className="player-art-caption">UNA RADIO<br/>MUCHOS MUNDOS</span></div>
        <div className="now-track"><div><span className="eyebrow">{selected?.country?.toUpperCase() || "AÚN SIN SINTONIZAR"}</span><h3>{selected?.name || "Elige una estación"}</h3><p>{selected ? (selected.tags?.split(",").slice(0, 2).join(" · ") || "Transmisión en vivo") : "Tu próximo descubrimiento te espera."}</p></div></div>
        <div className="player-status"><span className={`player-status-dot ${playing ? "active" : ""}`}/><span>{playing ? "Estás escuchando en vivo" : selected ? "Transmisión pausada" : "Selecciona una frecuencia"}</span></div>
        <div className="radio-controls"><button className="station-skip" onClick={() => moveStation(-1)} disabled={!selected || stations.length < 2} aria-label="Estación anterior"><SkipBack size={18}/></button><button className="radio-main-control" onClick={() => void togglePlay()} disabled={!selected} aria-label={playing ? "Pausar estación" : "Reproducir estación"}>{playing ? <Pause size={21} fill="currentColor"/> : <Play size={21} fill="currentColor"/>}</button><button className="station-skip" onClick={() => moveStation(1)} disabled={!selected || stations.length < 2} aria-label="Siguiente estación"><SkipForward size={18}/></button></div>
        <div className="volume-control"><button aria-label={volume === 0 ? "Activar sonido" : "Silenciar"} onClick={() => setVolume(volume === 0 ? 0.72 : 0)}>{volume === 0 ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button><input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} style={{ "--volume-level": `${volume * 100}%` } as CSSProperties} onChange={(event) => setVolume(Number(event.target.value))}/><span>{Math.round(volume * 100)}%</span></div>
        <div className="player-info"><span><Check size={14}/> Reproducción gratuita</span><p>El audio se transmite directamente desde cada estación.</p></div>
        <div className="player-source"><span className="source-icon"><Radio size={16}/></span><span><b>Fuente abierta</b><small>Radio Browser · comunidad</small></span><a href="https://www.radio-browser.info/" aria-label="Catálogo Radio Browser" target="_blank" rel="noreferrer"><ArrowRight size={15}/></a></div>
      </aside>
      <div className="mobile-player"><span className="mobile-cover"><Waves size={18}/></span><span className="mobile-track-copy"><b>{selected?.name || "Onda Radio"}</b><small>{playing ? "En vivo · " : "Gratis · "}{selected?.country || "elige una estación"}</small></span><label className="mobile-volume" aria-label="Volumen"><Volume2 size={14}/><input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/></label><button className="mobile-skip" onClick={() => moveStation(-1)} disabled={!selected || stations.length < 2} aria-label="Estación anterior"><SkipBack size={15}/></button><button onClick={() => void togglePlay()} disabled={!selected} aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><button className="mobile-skip" onClick={() => moveStation(1)} disabled={!selected || stations.length < 2} aria-label="Siguiente estación"><SkipForward size={15}/></button></div>
    </main>
  );
}
