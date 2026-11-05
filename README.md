# Toktok

A tiny vertical TikTok-style feed powered by TikHub's public TikTok search API.

## Requirements

- Node.js 20+
- A TikHub API key

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Put your key in `TIKHUB_API_KEY`.
3. Run `npm install`, then `npm run dev`.
4. Open http://localhost:3000.

## Deploy

Deploy this repository to Vercel and add `TIKHUB_API_KEY` as a server-side Environment Variable. Never put the key in a `NEXT_PUBLIC_*` variable or commit it to Git.

The feed starts with the search term `fyp`. Search for another topic using the search field. Each page requests up to 10 results. TikHub charges per API request; check your dashboard balance before repeated testing.

## Notes

- Video URLs are supplied by TikHub and may expire; fetch a fresh feed if playback stops working.
- This is an independent project, not affiliated with TikTok.
- Use only public content and respect TikTok/TikHub terms, creator rights, and applicable law.
