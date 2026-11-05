'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type VideoItem = {
  id: string;
  description: string;
  author: string;
  authorName: string;
  cover: string;
  videoUrl: string;
  shareUrl: string;
  likes: number | null;
};

export default function Home() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [keyword, setKeyword] = useState('fyp');
  const [activeKeyword, setActiveKeyword] = useState('fyp');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const loadVideos = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const start = reset ? 0 : offset;
      const response = await fetch(`/api/feed?keyword=${encodeURIComponent(activeKeyword)}&offset=${start}&count=10`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les vidéos.');
      const incoming = (data.items || []) as VideoItem[];
      setItems((previous) => reset ? incoming : [...previous, ...incoming.filter((v) => !previous.some((p) => p.id === v.id))]);
      setOffset(data.nextOffset ?? start + 10);
      if (reset && incoming[0]) setActiveId(incoming[0].id);
      if (!incoming.length && reset) setError('Aucune vidéo trouvée pour ce mot-clé. Essaie « funny », « gaming » ou « roblox ».');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activeKeyword, offset]);

  useEffect(() => { loadVideos(true); }, [activeKeyword]); // initial load and keyword changes

  useEffect(() => {
    const root = document.querySelector('.feed');
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.id || '';
          setActiveId(id);
          const video = entry.target.querySelector('video');
          if (video) video.play().catch(() => {});
          document.querySelectorAll<HTMLVideoElement>('.video-player').forEach((other) => {
            if (other !== video) other.pause();
          });
        }
      }
    }, { root, threshold: 0.7 });
    root.querySelectorAll('.video-card').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (items.length && items.length < 5 && !loading) loadVideos(false);
  }, [items.length, loading, loadVideos]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = keyword.trim();
    if (next) {
      setItems([]);
      setOffset(0);
      setActiveKeyword(next);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">tok<span>tok</span></a>
        <form className="search" onSubmit={submitSearch}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Rechercher un thème…" aria-label="Rechercher des vidéos" />
          <button type="submit" aria-label="Rechercher">⌕</button>
        </form>
        <button className="sound-toggle" onClick={() => setMuted((value) => !value)}>{muted ? 'Son coupé' : 'Son activé'}</button>
      </header>

      <section className="feed" aria-label="Flux de vidéos">
        {items.map((item) => (
          <article className="video-card" data-id={item.id} key={item.id}>
            <video
              className="video-player"
              src={item.videoUrl}
              poster={item.cover || undefined}
              playsInline
              loop
              muted={muted}
              autoPlay={item.id === activeId}
              preload="metadata"
              onClick={(event) => {
                const video = event.currentTarget;
                if (video.paused) video.play().catch(() => {});
                else video.pause();
              }}
            />
            <div className="video-shade" />
            <div className="video-info">
              <div className="creator">@{item.author}</div>
              <p>{item.description || 'Vidéo TikTok'}</p>
              <a href={item.shareUrl || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!item.shareUrl) e.preventDefault(); }}>Voir sur TikTok ↗</a>
            </div>
            <div className="video-actions">
              <button onClick={() => setMuted((value) => !value)} aria-label="Activer ou couper le son">{muted ? '🔇' : '🔊'}</button>
              {item.likes !== null && <span>♥ {item.likes.toLocaleString('fr-FR')}</span>}
            </div>
          </article>
        ))}
        <div className="feed-status" ref={sentinelRef}>
          {loading && <span>Chargement des vidéos…</span>}
          {error && <span>{error}</span>}
          {!loading && !error && items.length > 0 && <button onClick={() => loadVideos(false)}>Charger la suite</button>}
        </div>
      </section>
      <footer>Les vidéos restent hébergées par TikTok/TikHub. Toktok est un lecteur indépendant non affilié à TikTok.</footer>
    </main>
  );
}
