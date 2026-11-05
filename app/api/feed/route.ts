import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VideoResult = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  views: string;
  duration: string;
  url: string;
};

type LooseVideo = {
  video_id?: unknown;
  id?: unknown;
  content_id?: unknown;
  title?: unknown;
  author?: { name?: unknown } | null;
  thumbnails?: Array<{ url?: unknown }> | null;
  view_count?: unknown;
  duration?: unknown;
};

let clientPromise: ReturnType<typeof Innertube.create> | null = null;

async function getYouTube() {
  if (!clientPromise) {
    clientPromise = Innertube.create({
      lang: 'fr',
      location: 'FR',
      retrieve_player: false,
      enable_session_cache: true,
    });
  }
  return clientPromise;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'text' in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function mapVideo(raw: unknown): VideoResult | null {
  if (!raw || typeof raw !== 'object') return null;
  // Search results are a union of renderer types. Read only fields that exist
  // rather than assuming every result is a standard Video renderer.
  const video = raw as LooseVideo;
  const id = textValue(video.video_id) || textValue(video.id) || textValue(video.content_id);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;

  const thumbnails = Array.isArray(video.thumbnails) ? video.thumbnails : [];
  const thumbnail = [...thumbnails].reverse()
    .map((item) => textValue(item?.url))
    .find(Boolean) || '';

  return {
    id,
    title: textValue(video.title) || 'Vidéo YouTube',
    author: textValue(video.author?.name) || 'YouTube',
    thumbnail,
    views: textValue(video.view_count),
    duration: textValue(video.duration),
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('keyword') || 'vidéos populaires').trim().slice(0, 100);
  const offset = Math.max(0, Math.min(100, Number.parseInt(request.nextUrl.searchParams.get('offset') || '0', 10) || 0));
  const count = Math.min(20, Math.max(5, Number.parseInt(request.nextUrl.searchParams.get('count') || '10', 10) || 10));

  try {
    const youtube = await getYouTube();
    let results = await youtube.search(query, { type: 'video' });
    let videos = [...results.videos];

    const pagesToSkip = Math.floor(offset / 20);
    for (let page = 0; page < pagesToSkip && results.has_continuation; page += 1) {
      results = await results.getContinuation();
      videos = [...results.videos];
    }

    const items = videos
      .slice(offset % 20, (offset % 20) + count)
      .map(mapVideo)
      .filter((video): video is VideoResult => video !== null);

    return NextResponse.json({
      items,
      nextOffset: items.length === count ? offset + count : null,
      query,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('YouTube search failed:', error);
    return NextResponse.json({
      error: `YouTube n'a pas répondu correctement : ${message}`,
    }, { status: 502 });
  }
}
