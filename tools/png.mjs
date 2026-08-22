/**
 *  PNG 를 읽고 씁니다 — 의존성을 늘리지 않으려고 직접 짭니다 (CLAUDE.md 5장).
 *
 *  ★ 쓰는 곳 둘:
 *    - gen-art.mjs 가 color_image 로 넣을 **팔레트 그림**을 만듭니다
 *    - trim-art.mjs 가 아래 여백을 **잘라냅니다**
 *
 *  8비트 RGBA 만 다룹니다. PixelLab 이 돌려주는 것이 그것이고,
 *  우리가 만드는 것도 그것뿐이라 그 이상은 일부러 안 만듭니다.
 */
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/*  CRC32 — PNG 청크마다 붙습니다  */
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 *  PNG → { width, height, data(RGBA) }.
 *
 *  ★ 팔레트(colorType 3)와 회색조도 RGBA 로 펴서 돌려줍니다 —
 *    부르는 쪽이 종류를 따지지 않게 하려는 것입니다.
 */
export function decodePNG(buf) {
  let p = 8;
  let width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];
  let palette = null;
  let trns = null;

  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('인터레이스 PNG 는 안 다룹니다');
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`비트깊이 ${depth} 는 안 다룹니다 (8 만)`);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`색종류 ${colorType} 를 모릅니다`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const flat = Buffer.alloc(height * stride);
  let q = 0;

  //  ★ PNG 는 줄마다 앞줄/왼칸을 빼서 저장합니다. 그대로 두면 잡음이 됩니다.
  for (let y = 0; y < height; y++) {
    const filter = raw[q++];
    const line = raw.subarray(q, q + stride);
    q += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? flat[y * stride + i - channels] : 0;
      const b = y > 0 ? flat[(y - 1) * stride + i] : 0;
      const c = i >= channels && y > 0 ? flat[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      flat[y * stride + i] = v & 255;
    }
  }

  // RGBA 로 폅니다
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels, d = i * 4;
    if (colorType === 6) { flat.copy(data, d, s, s + 4); }
    else if (colorType === 2) { flat.copy(data, d, s, s + 3); data[d + 3] = 255; }
    else if (colorType === 0) { data[d] = data[d+1] = data[d+2] = flat[s]; data[d+3] = 255; }
    else if (colorType === 4) { data[d] = data[d+1] = data[d+2] = flat[s]; data[d+3] = flat[s+1]; }
    else if (colorType === 3) {
      const k = flat[s];
      data[d] = palette[k*3]; data[d+1] = palette[k*3+1]; data[d+2] = palette[k*3+2];
      data[d + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { width, height, data };
}

/**  { width, height, data(RGBA) } → PNG 바이트 */
export function encodePNG({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // 필터 없음 — 작은 그림이라 굳이 줄일 것이 없습니다
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // 비트깊이
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 *  색 몇 개를 네모로 늘어놓은 그림. PixelLab 의 `color_image` 가 이것을 받습니다
 *  — "image containing colors used for palette" (openapi.json).
 *
 *  ★ 한 색을 한 픽셀로 두지 않고 16칸 네모로 두는 이유: 모델이 크기를 줄일 수 있어서
 *    1픽셀이면 이웃 색과 섞여 사라질 수 있습니다.
 */
export function palettePNG(hexes, block = 16) {
  const width = hexes.length * block;
  const height = block;
  const data = Buffer.alloc(width * height * 4);
  hexes.forEach((hex, i) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    for (let y = 0; y < height; y++)
      for (let x = i * block; x < (i + 1) * block; x++) {
        const d = (y * width + x) * 4;
        data[d] = r; data[d + 1] = g; data[d + 2] = b; data[d + 3] = 255;
      }
  });
  return encodePNG({ width, height, data });
}

/**  알파가 있는 칸의 테두리. 없으면 null */
export function opaqueBounds({ width, height, data }, cut = 16) {
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > cut) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? null : { minX, maxX, minY, maxY };
}

/**  잘라내기 */
export function crop({ width, height, data }, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    data.copy(out, y * w * 4, ((y + y0) * width + x0) * 4, ((y + y0) * width + x0 + w) * 4);
  return { width: w, height: h, data: out };
}

/**
 *  최근접으로 크기를 바꿉니다.
 *
 *  ★ 왜 최근접인가: 색을 섞으면 안 됩니다. 이 그림은 **스타일 기준**으로 쓰이는데
 *    보간을 하면 팔레트에 없던 중간색이 생겨서, 3톤으로 맞춰놓은 것이 도로 풀립니다.
 */
export function resizeNearest({ width, height, data }, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / w));
      const sy = Math.min(height - 1, Math.floor((y * height) / h));
      data.copy(out, (y * w + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
    }
  return { width: w, height: h, data: out };
}

/**
 *  비율을 지킨 채 w×h 안에 넣고 남는 곳은 투명으로 둡니다.
 *
 *  ★ 필요한 이유: bitforge 는 style_image 가 image_size 와 **정확히 같은 크기**여야
 *    합니다 (openapi 에는 안 적혀 있고, 다르면 HTTP 500 으로
 *    "style_image must be size (H, W)" 가 옵니다). 그렇다고 늘려 찌그러뜨리면
 *    기준 그림의 획 두께가 물건마다 달라져서 일관성을 만들려던 것이 반대가 됩니다.
 */
export function fitInto(img, w, h) {
  const k = Math.min(w / img.width, h / img.height);
  const iw = Math.max(1, Math.round(img.width * k));
  const ih = Math.max(1, Math.round(img.height * k));
  const small = resizeNearest(img, iw, ih);
  const data = Buffer.alloc(w * h * 4);
  const ox = ((w - iw) >> 1), oy = ((h - ih) >> 1);
  for (let y = 0; y < ih; y++)
    small.data.copy(data, ((y + oy) * w + ox) * 4, y * iw * 4, (y + 1) * iw * 4);
  return { width: w, height: h, data };
}

/* ===========================================================================
 *  APNG — 반복 애니메이션 한 파일
 * ---------------------------------------------------------------------------
 *  ★ 왜 APNG 인가. 실제 박자로 도는 것을 파일 하나로 남겨야 하는데
 *    GIF 는 LZW 를 직접 짜야 하고 256색으로 줄어듭니다. APNG 는 이미 있는
 *    PNG 인코더에 청크 셋(acTL·fcTL·fdAT)을 더하면 되고 색이 안 줄어듭니다.
 *    의존성도 안 늘어납니다 (CLAUDE.md 5장).
 *
 *  ★ 폰과 요즘 브라우저에서 그대로 돕니다.
 * ======================================================================== */

const SIG_A = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_A = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_A[n] = c;
}
function crcA(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_A[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunkA(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crcA(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** 한 장을 IDAT 용 raw 로 (필터 없음) */
function rawOf({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return raw;
}

/**
 *  프레임들을 APNG 한 장으로. 모든 프레임은 크기가 같아야 합니다.
 *
 *  @param frames  [{ width, height, data }, …]
 *  @param delays  프레임마다 머무는 시간(밀리초). 하나만 주면 전부 같습니다.
 *  @param loops   0 이면 무한 반복
 */
export function encodeAPNG(frames, delays, loops = 0) {
  if (!frames.length) throw new Error('프레임이 없습니다');
  const { width, height } = frames[0];
  for (const f of frames)
    if (f.width !== width || f.height !== height)
      throw new Error('APNG 은 모든 프레임 크기가 같아야 합니다');
  const ms = Array.isArray(delays) ? delays : frames.map(() => delays);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(loops, 4);

  const parts = [SIG_A, chunkA('IHDR', ihdr), chunkA('acTL', actl)];
  let seq = 0;

  frames.forEach((frame, i) => {
    //  ★ 지연은 분수(delay_num / delay_den)입니다. 분모를 1000 으로 두면
    //    밀리초를 그대로 쓸 수 있습니다 — 82.5ms 같은 값이 반올림 없이 들어갑니다.
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(width, 4);
    fctl.writeUInt32BE(height, 8);
    fctl.writeUInt32BE(0, 12);          // x
    fctl.writeUInt32BE(0, 16);          // y
    fctl.writeUInt16BE(Math.round(ms[i]), 20);
    fctl.writeUInt16BE(1000, 22);
    fctl[24] = 1;                        // dispose: 배경으로 지움
    fctl[25] = 0;                        // blend: 덮어쓰기
    parts.push(chunkA('fcTL', fctl));

    const z = deflateSync(rawOf(frame), { level: 9 });
    if (i === 0) {
      parts.push(chunkA('IDAT', z));
    } else {
      const fdat = Buffer.alloc(4 + z.length);
      fdat.writeUInt32BE(seq++, 0);
      z.copy(fdat, 4);
      parts.push(chunkA('fdAT', fdat));
    }
  });

  parts.push(chunkA('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
