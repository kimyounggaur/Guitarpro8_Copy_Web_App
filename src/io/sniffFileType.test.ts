import { expect, it } from "vitest";
import { sniffFileType } from "./sniffFileType";

const encoder = new TextEncoder();

it("[B16] recognizes the file signature before consulting its filename", () => {
  expect(sniffFileType(encoder.encode("\uFEFF  {}"), "old-score.gp")).toBe("native");
  expect(sniffFileType(encoder.encode("MThd"), "misnamed.gp")).toBe("midi");
  expect(sniffFileType(encoder.encode(" BCFS"))).toBe("ascii");
  expect(sniffFileType(encoder.encode("BCFS"), "old.gpx")).toBe("guitar-pro");
  expect(sniffFileType(encoder.encode("BCFZ"), "old.gpx")).toBe("guitar-pro");
  expect(sniffFileType(encoder.encode("\u0016FICHIER GUITAR PRO v5.10"), "old.gp5")).toBe("guitar-pro");
  expect(sniffFileType(encoder.encode("  <?xml version=\"1.0\"?>"), "misnamed.txt")).toBe("musicxml");
  expect(sniffFileType(encoder.encode("  <score-partwise>"))).toBe("musicxml");
  expect(sniffFileType(encoder.encode("e|---0---|"))).toBe("ascii");
  expect(sniffFileType(new Uint8Array([0, 3, 1]))).toBe("unknown");
});

it("[B16] distinguishes GP7/8 ZIP data from a compressed MusicXML container", () => {
  const gp = Uint8Array.of(0x50, 0x4b, 0x03, 0x04);
  const name = encoder.encode("META-INF/container.xml");
  const withContainer = new Uint8Array(30 + name.length);
  withContainer.set(gp);
  new DataView(withContainer.buffer).setUint16(26, name.length, true);
  withContainer.set(name, 30);

  expect(sniffFileType(gp, "old.gp")).toBe("guitar-pro");
  expect(sniffFileType(gp, "compressed.MXL")).toBe("mxl");
  expect(sniffFileType(withContainer, "renamed.gp")).toBe("mxl");
});
