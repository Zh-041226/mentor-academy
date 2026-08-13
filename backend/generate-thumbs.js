import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

async function generateThumbs() {
  console.log(`Scanning directory: ${UPLOAD_DIR}`)
  const files = fs.readdirSync(UPLOAD_DIR)
  let count = 0

  for (const file of files) {
    if (file.includes('_thumb.')) continue
    if (!file.match(/\.(jpg|jpeg|png|webp)$/i)) continue
    
    const thumbName = `${file.split('.')[0]}_thumb.webp`
    const thumbPath = path.join(UPLOAD_DIR, thumbName)
    const originalPath = path.join(UPLOAD_DIR, file)
    
    if (!fs.existsSync(thumbPath)) {
      console.log(`Generating thumb for ${file}...`)
      try {
        await sharp(originalPath)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(thumbPath)
        count++
      } catch (e) {
        console.error(`Error generating thumb for ${file}:`, e.message)
      }
    }
  }
  
  console.log(`Done. Generated ${count} thumbnails.`)
}

generateThumbs()
