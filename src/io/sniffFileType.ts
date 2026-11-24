export type ScoreFileType = "native" | "musicxml" | "mxl" | "midi" | "ascii" | "guitar-pro" | "unknown";

export const UNSUPPORTED_GUITAR_PRO_MESSAGE =
  "Guitar Pro files cannot be opened directly. Export MusicXML from Guitar Pro, then choose Import → MusicXML in TabScore.";

const MXL_CONTAINER = "META-INF/container.xml";
const decoder = new TextDecoder("utf-8");

export function sniffFileType(bytes: Uint8Array, filename = ""): ScoreFileType {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return /\.mxl$/i.test(filename) || hasMxlContainer(bytes) ? "mxl" : "guitar-pro";
  }

  const signature = decoder.decode(bytes.subarray(0, 24));
  if (signature.startsWith("BCFS") || signature.startsWith("BCFZ") || signature.startsWith("FICHIER GUITAR PRO", 1)) {
    return "guitar-pro";
  }
  if (signature.startsWith("MThd")) {
    return "midi";
  }

  const prefix = decoder.decode(bytes.subarray(0, 8192)).trimStart();
  if (prefix.startsWith("{")) {
    return "native";
  }
  if (/^(?:<\?xml\b|<score-partwise\b|<!DOCTYPE\s+score-partwise\b)/.test(prefix)) {
    return "musicxml";
  }
  return prefix && !/[\u0000-\u0008\u000e-\u001f\ufffd]/.test(prefix) ? "ascii" : "unknown";
}

function hasMxlContainer(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record may have a comment of up to 65,535 bytes.
  const endRecordLength = 22;
  const recordStart = Math.max(0, bytes.length - endRecordLength - 65535);

  for (let end = bytes.length - endRecordLength; end >= recordStart; end--) {
    if (view.getUint32(end, true) !== 0x06054b50 || end + endRecordLength + view.getUint16(end + 20, true) !== bytes.length) {
      continue;
    }

    let offset = view.getUint32(end + 16, true);
    const entries = view.getUint16(end + 10, true);

    for (let index = 0; index < entries && offset + 46 <= end; index++) {
      if (view.getUint32(offset, true) !== 0x02014b50) {
        break;
      }

      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const nameStart = offset + 46;
      if (nameStart + nameLength <= end && decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)) === MXL_CONTAINER) {
        return true;
      }
      offset = nameStart + nameLength + extraLength + commentLength;
    }

    break;
  }

  // A caller can sniff only the leading bytes. Check names of complete local
  // headers in this prefix, without interpreting compressed data as text.
  for (let offset = 0; offset + 30 <= bytes.length;) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      break;
    }
    const nameStart = offset + 30;
    const nameLength = view.getUint16(offset + 26, true);
    const nameEnd = nameStart + nameLength;
    if (nameEnd <= bytes.length && decoder.decode(bytes.subarray(nameStart, nameEnd)) === MXL_CONTAINER) {
      return true;
    }
    if (view.getUint16(offset + 6, true) & 0x08) {
      break; // Size follows the compressed data, so this prefix cannot locate the next header.
    }
    offset = nameEnd + view.getUint16(offset + 28, true) + view.getUint32(offset + 18, true);
  }
  return false;
}
