import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export const GET: APIRoute = async () => {
  const guides = await getCollection('guides');

  const siteUrl = import.meta.env.SITE_URL ?? 'https://techmoelectronics.lk';

  const manifest = guides.map((g: CollectionEntry<'guides'>) => ({
    title:         g.data.title,
    slug:          g.slug,
    device:        g.data.device,
    difficulty:    g.data.difficulty,
    estimatedTime: g.data.estimatedTime,
    url:           `${siteUrl}/guides/${g.slug}`,
  }));

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
