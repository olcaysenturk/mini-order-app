// lib/validation.ts
import { z } from 'zod'

export const lineStatusEnum = z.enum(['pending','processing','completed','cancelled'])

export const orderItemInput = z.object({
  id: z.string().optional(),           // PATCH update için
  _action: z.literal('delete').optional(),

  categoryId: z.string().optional(),
  variantId: z.string().optional(),
  qty: z.number().int().min(1).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  unitPrice: z.number().optional(),
  note: z.string().nullable().optional(),
  fileDensity: z.number().min(0).optional(),
  lineStatus: lineStatusEnum.optional(), // ✅ yeni
})

export const createOrderInput = z.object({
  dealerId: z.string(),
  customerId: z.string().optional(),
  customerName: z.string(),
  customerPhone: z.string(),
  note: z.string().optional().default(''),
  status: z.enum(['pending','processing','completed','cancelled']),
  discount: z.number().min(0).optional().default(0),
  items: z.array(
    z.object({
      categoryId: z.string(),
      variantId: z.string(),
      qty: z.number().int().min(1),
      width: z.number().int().min(0),
      height: z.number().int().min(0),
      unitPrice: z.number(),
      note: z.string().nullable().optional(),
      fileDensity: z.number().min(0).default(1),
      lineStatus: lineStatusEnum.optional().default('processing'), // ✅
    })
  ).min(1),
})

export const patchOrderInput = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  note: z.string().nullable().optional(),
  status: z.enum(['pending','processing','completed','cancelled']).optional(),
  discount: z.number().min(0).optional(),
  items: z.array(orderItemInput).optional(), // create/update/delete karışık gelebilir
})
