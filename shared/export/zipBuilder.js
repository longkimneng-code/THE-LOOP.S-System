// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — ZERO-DEPENDENCY PKZIP ARCHIVE BUILDER
// Generates valid standard ZIP files for OpenXML (.xlsx and .docx) documents
// ============================================================================

const zlib = require('zlib');

// CRC32 Table & Calculator
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function calculateCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

class ZipBuilder {
  constructor() {
    this.files = [];
  }

  addFile(filename, content) {
    const rawBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = zlib.deflateRawSync(rawBuffer);
    const crc = calculateCrc32(rawBuffer);

    this.files.push({
      name: filename,
      raw: rawBuffer,
      compressed,
      crc,
      uncompressedSize: rawBuffer.length,
      compressedSize: compressed.length
    });
  }

  build() {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const f of this.files) {
      const nameBuf = Buffer.from(f.name, 'utf8');

      // Local File Header (30 bytes + name)
      const lh = Buffer.alloc(30 + nameBuf.length);
      lh.writeUInt32LE(0x04034b50, 0); // Signature PK\x03\x04
      lh.writeUInt16LE(20, 4);         // Version needed: 2.0
      lh.writeUInt16LE(0, 6);          // General purpose bit flag
      lh.writeUInt16LE(8, 8);          // Compression method: Deflate (8)
      lh.writeUInt16LE(0, 10);         // Last mod time
      lh.writeUInt16LE(0, 12);         // Last mod date
      lh.writeUInt32LE(f.crc, 14);     // CRC-32
      lh.writeUInt32LE(f.compressedSize, 18);   // Compressed size
      lh.writeUInt32LE(f.uncompressedSize, 22); // Uncompressed size
      lh.writeUInt16LE(nameBuf.length, 26);     // File name length
      lh.writeUInt16LE(0, 28);                  // Extra field length
      nameBuf.copy(lh, 30);

      localHeaders.push(lh, f.compressed);

      // Central Directory Header (46 bytes + name)
      const ch = Buffer.alloc(46 + nameBuf.length);
      ch.writeUInt32LE(0x02014b50, 0); // Signature PK\x01\x02
      ch.writeUInt16LE(20, 4);         // Version made by
      ch.writeUInt16LE(20, 6);         // Version needed
      ch.writeUInt16LE(0, 8);          // Flags
      ch.writeUInt16LE(8, 10);         // Compression method: Deflate
      ch.writeUInt16LE(0, 12);         // Mod time
      ch.writeUInt16LE(0, 14);         // Mod date
      ch.writeUInt32LE(f.crc, 16);     // CRC-32
      ch.writeUInt32LE(f.compressedSize, 20);   // Compressed size
      ch.writeUInt32LE(f.uncompressedSize, 24); // Uncompressed size
      ch.writeUInt16LE(nameBuf.length, 28);     // File name length
      ch.writeUInt16LE(0, 30);                  // Extra field length
      ch.writeUInt16LE(0, 32);                  // File comment length
      ch.writeUInt16LE(0, 34);                  // Disk number start
      ch.writeUInt16LE(0, 36);                  // Internal file attributes
      ch.writeUInt32LE(0, 38);                  // External file attributes
      ch.writeUInt32LE(offset, 42);             // Relative offset of local header
      nameBuf.copy(ch, 46);

      centralHeaders.push(ch);

      offset += lh.length + f.compressed.length;
    }

    const centralDirBuffer = Buffer.concat(centralHeaders);
    const centralDirOffset = offset;
    const centralDirSize = centralDirBuffer.length;

    // End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature PK\x05\x06
    eocd.writeUInt16LE(0, 4);          // Disk number
    eocd.writeUInt16LE(0, 6);          // Start disk
    eocd.writeUInt16LE(this.files.length, 8);  // Entries on this disk
    eocd.writeUInt16LE(this.files.length, 10); // Total entries
    eocd.writeUInt32LE(centralDirSize, 12);    // Size of central directory
    eocd.writeUInt32LE(centralDirOffset, 16);  // Offset of central directory
    eocd.writeUInt16LE(0, 20);                 // Comment length

    return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
  }
}

module.exports = { ZipBuilder };

