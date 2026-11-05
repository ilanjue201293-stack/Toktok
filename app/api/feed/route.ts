import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyObject = Record<string, unknown>;

function asObject(value: unknown): AnyObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyObject : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const found = value.find((item) => typeof item === 'string' && item.trim());
      if (typeof found === 'string') return found;
    }
  }
  return '';
}

function collectVideoObjects(root: unknown): AnyObject[] {
  const found: AnyObject[] = [];
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 9) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const obj = value as AnyObject;
    const video = asObject(obj.video) ?? asObject(obj.Video);
    if (video) {
      const play = asObject(video.play_addr) ?? asObject(video.playAddr);
      const download = asObject(video.download_addr) ?? asObject(video.downloadAddr);
      const url = firstString(play?.url_list, play?.urlList, download?.url_list, download?.urlList);
      if (url) found.push(obj);
    }
    for (const child of Object.values(obj)) visit(child, depth + 1);
  };
  visit(root);
  return found;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Configuration manquante : ajoute TIKHUB_API_KEY dans les variables d’environnement.' }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const keyword = (params.get('keyword') || 'fyp').trim().slice(0, 80);
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);
  const count = Math.min(20, Math.max(5, Number.parseInt(params.get('count') || '10', 10) || 10));

  const upstream = new URL('https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_video_search_result');
  upstream.searchParams.set('keyword', keyword);
  upstream.searchParams.set('offset', String(offset));
  upstream.searchParams.set('count', String(count));
  upstream.searchParams.set('sort_type', '0');
  upstream.searchParams.set('publish_time', '0');
  upstream.searchParams.set('region', 'FR');

  try {
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: 'TikHub a refusé la requête.', details: payload }, { status: response.status });
    }

    const root = asObject(payload);
    if (root && typeof root.code === 'number' && root.code !== 200) {
      return NextResponse.json({ error: String(root.message || 'Erreur renvoyée par TikHub.'), details: payload }, { status: 502 });
    }

    const items = collectVideoObjects(payload).map((item) => {
      const video = asObject(item.video) ?? asObject(item.Video) ?? {};
      const author = asObject(item.author) ?? asObject(item.author_info) ?? asObject(item.authorInfo) ?? {};
      const stats = asObject(item.statistics) ?? {};
      const play = asObject(video.play_addr) ?? asObject(video.playAddr) ?? {};
      const download = asObject(video.download_addr) ?? asObject(video.downloadAddr) ?? {};
      const cover = asObject(video.cover) ?? {};
      const playUrl = firstString(play.url_list, play.urlList, download.url_list, download.urlList);
      const coverUrl = firstString(cover.url_list, cover.urlList, video.origin_cover?.url_list);
      const username = firstString(author.unique_id, author.uniqueId, author.nickname, author.name);
      const id = firstString(item.aweme_id, item.awemeId, item.id, item.item_id);
      return {
        id: id || playUrl,
        description: firstString(item.desc, item.description, item.title),
        author: username || 'TikTok',
        authorName: firstString(author.nickname, author.name, username),
        cover: coverUrl,
        videoUrl: playUrl,
        shareUrl: firstString(item.share_url, item.shareUrl),
        likes: typeof stats.digg_count === 'number' ? stats.digg_count : null,
      };
    }).filter((item) => item.videoUrl);

    return NextResponse.json({ items, nextOffset: items.length ? offset + count : null, keyword });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: `Impossible de contacter TikHub : ${message}` }, { status: 502 });
  }
}
