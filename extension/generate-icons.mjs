/**
 * Generate proper PNG icons for the OFFO Chrome extension.
 * Creates solid indigo squares at 16x16, 48x48, and 128x128.
 * No dependencies — uses raw PNG encoding.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// Minimal PNG encoder — creates uncompressed PNG
function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk("IHDR", ihdrData);

  // IDAT chunk — raw image data with zlib wrapper
  // Each row: filter byte (0 = None) + RGB pixels
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const offset = y * rowSize + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }

  // Wrap in zlib (deflate with no compression)
  const zlibData = deflateNoCompression(rawData);
  const idat = makeChunk("IDAT", zlibData);

  // IEND chunk
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 for PNG chunks
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c;
}

// Minimal zlib deflate with no compression (store blocks)
function deflateNoCompression(data) {
  const maxBlockSize = 65535;
  const blocks = [];

  // Zlib header: CMF=0x78 (deflate, window 32k), FLG=0x01 (no dict, check bits)
  blocks.push(Buffer.from([0x78, 0x01]));

  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, maxBlockSize);
    const isLast = offset + blockSize >= data.length;

    // Block header: BFINAL (1 bit) + BTYPE=00 (2 bits) = stored
    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(blockSize, 1);
    header.writeUInt16LE(blockSize ^ 0xffff, 3);

    blocks.push(header);
    blocks.push(data.subarray(offset, offset + blockSize));
    offset += blockSize;
  }

  // Adler32 checksum
  let a = 1,
    b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((b << 16) | a) >>> 0, 0);
  blocks.push(adler);

  return Buffer.concat(blocks);
}

// Generate icons — indigo color (#4F46E5)
const sizes = [16, 48, 128];
const iconsDir = join(import.meta.dirname, "icons");
mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const png = createPNG(size, size, 79, 70, 229); // #4F46E5
  const outPath = join(iconsDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes, ${size}x${size})`);
}

console.log("Icons generated.");
