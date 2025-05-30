import { Tile, BoundingBox } from './types';
import sharp from 'sharp';

/**
 * Splits an image into overlapping tiles asynchronously.
 * @param image - The image buffer.
 * @param tileSize - Size of each tile (width, height).
 * @param overlap - Overlap ratio (0-1).
 * @returns Promise resolving to an array of tiles with image data and bounding boxes.
 */
export async function tileImage(
  image: Buffer,
  tileSize: { width: number; height: number },
  overlap: number
): Promise<Tile[]> {
  return await splitImageIntoTiles(image, tileSize, overlap);
}

/**
 * Helper function to split an image buffer into overlapping tiles using sharp (async).
 * @param image - The image buffer.
 * @param tileSize - Tile size.
 * @param overlap - Overlap ratio.
 * @returns Promise resolving to an array of Tile objects.
 */
async function splitImageIntoTiles(
  image: Buffer,
  tileSize: { width: number; height: number },
  overlap: number
): Promise<Tile[]> {
  const meta = await sharp(image).metadata();
  const imgWidth = meta.width || 0;
  const imgHeight = meta.height || 0;
  const stepX = Math.floor(tileSize.width * (1 - overlap));
  const stepY = Math.floor(tileSize.height * (1 - overlap));
  const tilePromises: Promise<Tile>[] = [];

  for (let y = 0; y < imgHeight; y += stepY) {
    for (let x = 0; x < imgWidth; x += stepX) {
      const width = Math.min(tileSize.width, imgWidth - x);
      const height = Math.min(tileSize.height, imgHeight - y);
      if (width <= 0 || height <= 0) continue;
      const bbox: BoundingBox = { x, y, width, height };
      const tileBufferPromise = sharp(image)
        .extract({ left: x, top: y, width, height })
        .toBuffer()
        .then(buffer => ({ image: buffer, bbox }));
      tilePromises.push(tileBufferPromise);
    }
  }
  return Promise.all(tilePromises);
} 