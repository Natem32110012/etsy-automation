import sharp from "sharp";
import { PROMO_SIZE, type PrintSize } from "./types";

/**
 * Model en fazla ~1536px kenar üretiyor, hedef 300dpi print boyutları 2480-3300px.
 * Büyütme lanczos3 ile yapılıyor: çizgi sanatı bunu yumuşama olmadan kaldırıyor.
 *
 * A4 (0.707) ve Letter (0.773) oranları modelin desteklediği oranların hiçbirine
 * denk gelmediği için görsel kırpılmıyor, `contain` ile beyaz kenar eklenerek
 * oturtuluyor — planner grid'i veya davetiye metin alanı kenardan kesilmesin.
 */
export async function fitToPrint(
  generated: Buffer,
  print: PrintSize,
  options: { pageFrame?: boolean } = {},
): Promise<Buffer> {
  const fitted = await sharp(generated)
    .resize(print.width, print.height, {
      fit: "contain",
      kernel: "lanczos3",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .withMetadata({ density: print.dpi })
    .png()
    .toBuffer();

  if (!options.pageFrame) return fitted;
  return addThinPageFrame(fitted, print.width, print.height, print.dpi);
}

/**
 * Boyama ve doodle sayfasını bitiren ince siyah dikdörtgen: çizgi sınırdır.
 * Dışarı taşan çizim beyaza kesilir; kenarda yalnızca pay kalır.
 */
async function addThinPageFrame(input: Buffer, width: number, height: number, dpi: number) {
  const inset = Math.round((dpi / 25.4) * 6);
  const stroke = Math.max(4, Math.round((dpi / 25.4) * 0.6));
  const innerLeft = inset;
  const innerTop = inset;
  const innerRight = width - inset;
  const innerBottom = height - inset;
  const x = inset + stroke / 2;
  const y = inset + stroke / 2;
  const w = width - inset * 2 - stroke;
  const h = height - inset * 2 - stroke;
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<path fill-rule="evenodd" fill="#ffffff" d="M0 0H${width}V${height}H0Z M${innerLeft} ${innerTop}H${innerRight}V${innerBottom}H${innerLeft}Z"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000000" stroke-width="${stroke}"/>` +
      `</svg>`,
  );

  return sharp(input)
    .composite([{ input: svg, top: 0, left: 0 }])
    .withMetadata({ density: dpi })
    .png()
    .toBuffer();
}

/**
 * Promo görseli 2:3 üretildiği için hedef 1000x1500'e birebir oturuyor; `cover`
 * sadece modelin 1024x1536 çıktısındaki 24px fazlayı temizliyor.
 */
export async function fitToPromo(generated: Buffer): Promise<Buffer> {
  return sharp(generated)
    .resize(PROMO_SIZE.width, PROMO_SIZE.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

export async function toDataUrl(buffer: Buffer, mime = "image/png"): Promise<string> {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * Referans olarak gönderilen ürün görseli 2550x3300 PNG; olduğu gibi data URL'e
 * çevirmek istek gövdesini onlarca megabayta çıkarıyor. Model referansı sadece
 * kompozisyon için kullandığı için 1024px yeterli.
 */
export async function toReferenceDataUrl(buffer: Buffer): Promise<string> {
  const small = await sharp(buffer)
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return toDataUrl(small);
}

export async function readSize(input: Buffer) {
  const meta = await sharp(input).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}
