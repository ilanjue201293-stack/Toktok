import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyObject = Record<string, unknown>;

function asObject(value: unknown): AnyObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyObject : null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try { return JSON.parse(trimmed) as unknown; } catch { return value; }
}

function firstString(...values: unknown[]): string {
  for (const raw of values) {
    const value = parseJson(raw);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (Array.isArray(value)) {
      const found = value.map(parseJson).find((item) => (typeof item === 'string' && item.trim()) || typeof item === 'number');
      if (found !== undefined) return String(found);
    }
  }
  return '';
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

function collectLiveObjects(root: unknown): AnyObject[] {
  const found: AnyObject[] = [];
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth = 0) => {
    const parsed = parseJson(value);
    if (!parsed || typeof parsed !== 'object' || seen.has(parsed) || depth > 10) return;
    seen.add(parsed);
    if (Array.isArray(parsed)) {
      for (const item of parsed) visit(item, depth + 1);
      return;
    }
    const object = parsed as AnyObject;
    const roomId = firstString(object.room_id, object.roomId, object.live_room_id, object.liveRoomId);
    if (roomId) found.push(object);
    for (const child of Object.values(object)) visit(child, depth + 1);
  };
  visit(root);
  return found;
}

function imageUrl(value: unknown): string {
  const object = asObject(value);
  return firstString(
    object?.url_list, object?.urlList, object?.uri,
    value,
  );
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Configuration manquante : ajoute TIKHUB_API_KEY dans les variables d’environnement Vercel.' }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const keyword = (params.get('keyword') || 'live').trim().slice(0, 80);
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);
  const count = Math.min(20, Math.max(5, Number.parseInt(params.get('count') || '10', 10) || 10));
  const searchId = params.get('searchId') || '';

  const upstream = new URL('https://api.tikhub.io/api/v1/tiktok/web/fetch_search_live');
  upstream.searchParams.set('keyword', keyword);
  upstream.searchParams.set('count', String(count));
  upstream.searchParams.set('offset', String(offset));
  upstream.searchParams.set('search_id', searchId);

  try {
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: 'TikHub a refusé la recherche de lives.', details: payload }, { status: response.status });
    }

    const root = asObject(payload);
    if (root && typeof root.code === 'number' && root.code !== 200) {
      return NextResponse.json({ error: String(root.message || 'Erreur renvoyée par TikHub.'), details: payload }, { status: 502 });
    }

    const items = collectLiveObjects(payload).map((item) => {
      const liveInfo = asObject(parseJson(item.live_info)) ?? asObject(item.liveInfo) ?? {};
      const room = asObject(item.room) ?? asObject(item.live_room) ?? asObject(item.liveRoom) ?? {};
      const user = asObject(item.user) ?? asObject(item.author) ?? asObject(item.owner) ?? asObject(item.anchor) ?? {};
      const merged = { ...liveInfo, ...room, ...item };
      const roomId = firstString(merged.room_id, merged.roomId, merged.live_room_id, merged.liveRoomId, merged.id);
      const username = firstString(user.unique_id, user.uniqueId, user.uniqueIdStr, user.sec_uid, merged.unique_id, merged.uniqueId, merged.nickname);
      const nickname = firstString(user.nickname, user.nick_name, user.display_name, merged.nickname, username) || 'Créateur TikTok';
      const cover = imageUrl(merged.cover) || imageUrl(merged.room_cover) || imageUrl(merged.cover_url) || imageUrl(merged.coverUrl) || imageUrl(user.avatar_thumb);
      const title = firstString(merged.title, merged.room_title, merged.live_title, merged.description, merged.desc) || 'Live TikTok en direct';
      const viewers = firstNumber(merged.user_count, merged.viewer_count, merged.total_user, merged.online_user_count, merged.watching_count, merged.totalUser);
      const shareUrl = firstString(merged.share_url, merged.shareUrl, merged.live_url, merged.liveUrl) ||
        (username ? `https://www.tiktok.com/@${encodeURIComponent(username)}/live` : `https://www.tiktok.com/live?room_id=${encodeURIComponent(roomId)}`);
      return {
        id: roomId,
        roomId,
        title,
        author: username,
        authorName: nickname,
        cover,
        viewers,
        shareUrl,
      };
    }).filter((item) => item.id);

    const data = asObject(root?.data);
    const extra = asObject(data?.extra);
    const logPb = asObject(data?.log_pb);
    const nextSearchId = firstString(extra?.logid, logPb?.impr_id, searchId);
    return NextResponse.json({
      items,
      nextOffset: items.length ? offset + count : null,
      searchId: nextSearchId,
      keyword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: `Impossible de contacter TikHub : ${message}` }, { status: 502 });
  }
}
