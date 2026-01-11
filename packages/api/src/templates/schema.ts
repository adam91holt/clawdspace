import { z } from 'zod';

export const TemplateName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'name must be alphanumeric and may include . _ -');

const BytesLike = z.union([
  z.number().int().positive(),
  z
    .string()
    .trim()
    .regex(/^\d+(k|m|g|t)?$/i, 'memory must look like 2g / 512m / 1024')
]);

export const SpaceTemplateSchema = z
  .object({
    name: TemplateName,
    description: z.string().max(200).optional(),

    resources: z
      .object({
        memory: BytesLike.optional(),
        cpus: z.number().positive().max(64).optional(),
        gpu: z.boolean().optional(),
        image: z.string().min(1).max(200).optional()
      })
      .optional(),

    security: z
      .object({
        writableRootfs: z.boolean().optional()
      })
      .optional(),

    network: z
      .object({
        mode: z.enum(['none', 'internet', 'lan']).optional(),
        blockCidrs: z.array(z.string().min(3).max(64)).optional()
      })
      .optional(),

    workspace: z
      .object({
        defaultRepoDest: z.string().max(128).optional()
      })
      .optional()
  })
  .strict();

export type SpaceTemplate = z.infer<typeof SpaceTemplateSchema>;
