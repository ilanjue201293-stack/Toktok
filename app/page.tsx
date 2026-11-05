'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LiveItem = {
  id: string;
  roomId: string;
  title: string;
  author: string;
  authorName: string;
  cover: string;
  viewers: number | null;
  shareUrl: string;
};

function formatViewers(value: number | null) {
  if (value === null) return '';
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export default function Home() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [keyword, setKeyword] = useState('live');
  const [activeKeyword, setActiveKeyword] = useState('live');
  const [offset, setOffset] = useState(0);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const loadLives = useCallback(async (reset = false) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const start = reset ? 0 : offset;
      const cursor = reset ? '' : searchId;
      const response = await fetch(`/api/feed?keyword=${encodeURIComponent(activeKeyword)}&offset=${start}&count=10&searchId=${encodeURIComponent(cursor)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les lives.');
      const incoming = (data.items || []) as LiveItem[];
      setItems((previous) => reset ? incoming : [...previous, ...incoming.filter((live) => !previous.some((item) => item.id === live.id))]);
      setOffset(data.nextOffset ?? start);
      setSearchId(data.searchId || cursor);
      hasMoreRef.current = incoming.length > 0 && data.nextOffset !== null;
      setHasMore(hasMoreRef.current);
      if (reset && incoming[0]) setActiveId(incoming[0].id);
      if (!incoming.length && reset) setError('Aucun live trouvé. Essaie un autre mot-clé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activeKeyword, offset, searchId]);

  useEffect(() => { loadLives(true); }, [activeKeyword]); // initial load and keyword changes

  useEffect(() => {
    const root = document.querySelector('.feed');
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveId((entry.target as HTMLElement).dataset.id || '');
      }
    }, { root, threshold: 0.7 });
    root.querySelectorAll('.live-card').forEach((card) => observer.observe(card));
    const moreObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadLives(false);
    }, { root, rootMargin: '700px 0px' });
    if (sentinelRef.current) moreObserver.observe(sentinelRef.current);
    return () => { observer.disconnect(); moreObserver.disconnect(); };
  }, [items, loadLives]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = keyword.trim();
    if (next) {
      setItems([]);
      setOffset(0);
      setSearchId('');
      hasMoreRef.current = true;
      setHasMore(true);
      setActiveKeyword(next);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">tok<span>tok</span></a>
        <form className="search" onSubmit={submitSearch}>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Rechercher des lives…" aria-label="Rechercher des lives TikTok" />
          <button type="submit" aria-label="Rechercher">⌕</button>
        </form>
        <div className="live-label"><span /> LIVE</div>
      </header>

      <section className="feed" aria-label="Flux de lives TikTok">
        {items.map((live) => (
          <article className="live-card" data-id={live.id} key={live.id}>
            {live.cover ? (
              // TikHub provides live-room cover images, not a playable broadcast stream.
              // The card links to the actual live on TikTok.
              <img className="live-cover" src={live.cover} alt="" loading={live.id === activeId ? 'eager' : 'lazy'} />
            ) : <div className="live-cover live-cover-placeholder"><span>toktok</span></div>}
            <div className="live-vignette" />
            <div className="live-badge"><span /> EN DIRECT</div>
            <div className="live-info">
              <div className="creator">@{live.author || live.authorName}</div>
              <p>{live.title}</p>
              <div className="live-meta">
                {live.viewers !== null && <span>◉ {formatViewers(live.viewers)} spectateurs</span>}
                <span>Live TikTok</span>
              </div>
              <a className="watch-live" href={live.shareUrl} target="_blank" rel="noreferrer">Regarder le live ↗</a>
            </div>
            <div className="live-side">
              <div className="avatar">{(live.authorName || live.author || 'T').slice(0, 1).toUpperCase()}</div>
              <span>LIVE</span>
            </div>
          </article>
        ))}
        <div className="feed-status" ref={sentinelRef}>
          {loading && <span>Recherche de lives…</span>}
          {error && <span>{error}</span>}
          {!loading && !error && items.length > 0 && hasMore && <button onClick={() => loadLives(false)}>Charger la suite</button>}
        </div>
      </section>
      <footer>Toktok affiche les informations des lives publics. Ouvre TikTok pour regarder la diffusion en direct.</footer>
    </main>
  );
}
