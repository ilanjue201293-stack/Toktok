'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type VideoItem = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  views: string;
  duration: string;
  url: string;
};

export default function Home() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [keyword, setKeyword] = useState('vidéos populaires');
  const [activeKeyword, setActiveKeyword] = useState('vidéos populaires');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const loadVideos = useCallback(async (reset = false) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const start = reset ? 0 : offset;
      const response = await fetch(`/api/feed?keyword=${encodeURIComponent(activeKeyword)}&offset=${start}&count=10`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les vidéos.');
      const incoming = (data.items || []) as VideoItem[];
      setItems((previous) => reset ? incoming : [...previous, ...incoming.filter((video) => !previous.some((item) => item.id === video.id))]);
      setOffset(data.nextOffset ?? start);
      hasMoreRef.current = data.nextOffset !== null && incoming.length > 0;
      setHasMore(hasMoreRef.current);
      if (reset && incoming[0]) setActiveId(incoming[0].id);
      if (!incoming.length && reset) setError('Aucune vidéo trouvée. Essaie une autre recherche.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activeKeyword, offset]);

  useEffect(() => { loadVideos(true); }, [activeKeyword]); // initial load and new searches

  useEffect(() => {
    const root = document.querySelector('.feed');
    if (!root) return;
    const activeObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveId((entry.target as HTMLElement).dataset.id || '');
      }
    }, { root, threshold: 0.65 });
    root.querySelectorAll('.video-card').forEach((card) => activeObserver.observe(card));

    const moreObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadVideos(false);
    }, { root, rootMargin: '700px 0px' });
    if (sentinelRef.current) moreObserver.observe(sentinelRef.current);
    return () => { activeObserver.disconnect(); moreObserver.disconnect(); };
  }, [items, loadVideos]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = keyword.trim();
    if (next) {
      setItems([]);
      setOffset(0);
      hasMoreRef.current = true;
      setHasMore(true);
      setActiveId('');
      setActiveKeyword(next);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">tok<span>tok</span></a>
        <form className="search" onSubmit={submitSearch}>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Rechercher des vidéos YouTube…" aria-label="Rechercher des vidéos YouTube" />
          <button type="submit" aria-label="Rechercher">⌕</button>
        </form>
        <div className="youtube-label"><span /> YOUTUBE</div>
      </header>

      <section className="feed" aria-label="Flux de vidéos YouTube">
        {items.map((video) => (
          <article className="video-card" data-id={video.id} key={video.id}>
            <iframe
              className="youtube-player"
              src={`https://www.youtube.com/embed/${video.id}?playsinline=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
              title={video.title}
              loading={items[0]?.id === video.id ? "eager" : "lazy"}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
            <div className="video-vignette" />
            <div className="video-info">
              <div className="creator">{video.author}</div>
              <p>{video.title}</p>
              <div className="video-meta">
                {video.views && <span>{video.views} vues</span>}
                {video.duration && <span>{video.duration}</span>}
              </div>
              <a className="watch-video" href={video.url} target="_blank" rel="noreferrer">Ouvrir sur YouTube ↗</a>
            </div>
          </article>
        ))}
        <div className="feed-status" ref={sentinelRef}>
          {loading && <span>Recherche de vidéos…</span>}
          {error && <span>{error}</span>}
          {!loading && !error && items.length > 0 && hasMore && <button onClick={() => loadVideos(false)}>Charger la suite</button>}
        </div>
      </section>
      <footer>Les vidéos sont lues avec le lecteur officiel YouTube intégré. Fais défiler pour passer à la suivante.</footer>
    </main>
  );
}
