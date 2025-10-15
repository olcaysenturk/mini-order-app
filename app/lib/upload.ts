import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export type SavedFile = {
  url: string
  key: string
  width?: number
  height?: number
  contentType?: string
}

// Basit içerik tipi => uzantı map'i
const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export async function saveDealerLogoLocal(
  dealerId: string,
  file: File
): Promise<SavedFile> {
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)

  const contentType = file.type || 'image/png'
  const ext = EXT_BY_MIME[contentType] || path.extname(file.name) || '.png'
  const id = randomUUID()

  // /public/uploads/dealers/<dealerId>_<uuid>.<ext>
  const dir = path.join(process.cwd(), 'public', 'uploads', 'dealers')
  await fs.mkdir(dir, { recursive: true })
  const filename = `${dealerId}_${id}${ext}`
  const filepath = path.join(dir, filename)

  await fs.writeFile(filepath, buf)

  // public URL
  const url = `/uploads/dealers/${filename}`

  // (Opsiyonel) görüntü boyutu okumak istersen sharp kullanabilirsin
  // ama bağımlılık eklememek adına geçiyorum.
  return { url, key: filename, contentType }
}

export async function deleteDealerLogoLocal(key?: string) {
  if (!key) return
  try {
    const p = path.join(process.cwd(), 'public', 'uploads', 'dealers', key)
    await fs.unlink(p)
  } catch {
    // yoksa sessiz geç
  }
}
