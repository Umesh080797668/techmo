import { defineCollection, z } from 'astro:content';

const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    device: z.string(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    estimatedTime: z.string(),
    tools: z.array(z.string()),
    parts: z.array(
      z.object({
        sku: z.string(),
        name: z.string(),
      })
    ).default([]),
    warnings: z.array(z.string()).default([]),
    updatedAt: z.string(),
    author: z.string(),
  }),
});

export const collections = { guides };
