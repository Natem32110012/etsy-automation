import type { AspectRatio, ImageQuality } from "./types";
import { DEFAULT_PRODUCT_QUALITY, DEFAULT_PROMO_QUALITY } from "./types";

const REPLICATE_API = "https://api.replicate.com/v1";

export const IMAGE_MODEL = process.env.REPLICATE_IMAGE_MODEL ?? "openai/gpt-image-2";
export const TEXT_MODEL = process.env.REPLICATE_TEXT_MODEL ?? "google/gemini-2.5-flash";

/**
 * Kalite arayüzden seçiliyor; bu fonksiyon sadece seçim gelmediğinde devreye
 * giren yedek. REPLICATE_IMAGE_QUALITY tanımlıysa o, yoksa ürün print'e gittiği
 * için "high", promo ekranda kaldığı için "medium".
 */
export function qualityFor(kind: "product" | "promo"): ImageQuality {
  const override = process.env.REPLICATE_IMAGE_QUALITY as ImageQuality | undefined;
  if (override) return override;
  return kind === "product" ? DEFAULT_PRODUCT_QUALITY : DEFAULT_PROMO_QUALITY;
}

function token() {
  const value = process.env.REPLICATE_API_TOKEN;
  if (!value) {
    throw new Error(
      "REPLICATE_API_TOKEN tanımlı değil. .env.local dosyasına ekleyip sunucuyu yeniden başlat.",
    );
  }
  return value;
}

export function hasToken() {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
};

/**
 * Replicate'in `Prefer: wait` başlığı tahmini senkron bekletir; süre yetmezse
 * dönen prediction'ı polling ile tamamlarız.
 */
async function runModel(model: string, input: Record<string, unknown>): Promise<Prediction> {
  const response = await startPrediction(model, input);
  let prediction = (await response.json()) as Prediction;
  const deadline = Date.now() + 10 * 60 * 1000;

  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() > deadline) throw new Error(`Replicate ${model} 10 dakikada tamamlanmadı`);
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!poll.ok) throw new Error(`Replicate polling hatası (${poll.status})`);
    prediction = (await poll.json()) as Prediction;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error ?? `Replicate ${model} durumu: ${prediction.status}`);
  }
  return prediction;
}

/**
 * Replicate hesabın kredisi $5'ın altındayken dakikada 6 istek + burst 1'e
 * düşürüyor. Konseptler parti parti, görseller sırayla üretildiği için akış bu
 * duvara doğal olarak çarpıyor; 429 bir hata değil, beklenip tekrarlanacak bir
 * durum. Bekleme süresini Replicate'in kendisi söylüyor.
 */
const RATE_LIMIT_RETRIES = 5;

async function startPrediction(model: string, input: Record<string, unknown>) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({ input }),
    });

    if (response.ok) return response;

    const body = await response.text();
    if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) {
      throw new Error(`Replicate ${model} çağrısı başarısız (${response.status}): ${body}`);
    }

    await new Promise((resolve) => setTimeout(resolve, retryAfterMs(response, body)));
  }
}

function retryAfterMs(response: Response, body: string): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return (header + 1) * 1000;

  try {
    const parsed = JSON.parse(body) as { retry_after?: unknown };
    const seconds = Number(parsed.retry_after);
    if (Number.isFinite(seconds) && seconds > 0) return (seconds + 1) * 1000;
  } catch {
    // Gövde JSON değilse sabit beklemeye düşülüyor.
  }
  return 12_000;
}

function firstUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  throw new Error(
    `Replicate çıktısı beklenen formatta değil: ${JSON.stringify(output)?.slice(0, 200)}`,
  );
}

export type ImageGenerationInput = {
  prompt: string;
  /** Referans görseller (data URL). Promo kareleri onaylanan ürün görselini alıyor. */
  inputImages?: string[];
  aspectRatio: AspectRatio;
  quality?: ImageQuality;
};

function replicateAspect(aspect: AspectRatio): string {
  const model = IMAGE_MODEL;
  if (model.includes("gpt-image-2.5")) {
    if (aspect === "1152x1536" || aspect === "1024x1536" || aspect === "2:3" || aspect === "9:16") return "2:3";
    if (aspect === "1536x1152" || aspect === "1536x1024" || aspect === "3:2") return "3:2";
    if (aspect === "1:1" || aspect === "1024x1024" || aspect === "2048x2048") return "1:1";
    return aspect;
  }
  if (aspect === "1:1" || aspect === "1024x1024" || aspect === "2048x2048") return "1:1";
  if (
    aspect === "3:2" ||
    aspect === "4:3" ||
    aspect === "16:9" ||
    aspect === "1536x1024" ||
    aspect === "1536x1152"
  ) {
    return "3:2";
  }
  return "2:3";
}

export async function generateImage(input: ImageGenerationInput): Promise<Buffer> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Görsel promptu boş — üretim gönderilmedi.");

  const payload: Record<string, unknown> = {
    prompt,
    aspect_ratio: replicateAspect(input.aspectRatio),
    quality: input.quality ?? "medium",
    output_format: "png",
    number_of_images: 1,
    background: "opaque",
  };
  const images = (input.inputImages ?? []).filter((value) => typeof value === "string" && value.length > 0);
  if (images.length > 0) payload.input_images = images;
  if (process.env.OPENAI_API_KEY) payload.openai_api_key = process.env.OPENAI_API_KEY;

  const prediction = await runModel(IMAGE_MODEL, payload);
  const url = firstUrl(prediction.output);

  const image = await fetch(url);
  if (!image.ok) throw new Error(`Üretilen görsel indirilemedi (${image.status})`);
  return Buffer.from(await image.arrayBuffer());
}

/**
 * gpt-image-2 seed parametresi almıyor; "yeniden üret" zaten farklı bir çıktı
 * veriyor ama promptun sonuna bir varyasyon jetonu eklemek modeli aynı
 * kompozisyonu tekrarlamaktan uzaklaştırıyor. Jeton `seed` olarak loglanıyor.
 */
export function variationSuffix(seed: number) {
  return `\n\nVariation token: ${seed}. Produce a fresh alternative composition; do not repeat earlier attempts for this brief.`;
}

function textFromOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((part) => textFromOutput(part)).join("");
  if (output && typeof output === "object") {
    const rec = output as Record<string, unknown>;
    if (typeof rec.text === "string") return rec.text;
    if (typeof rec.content === "string") return rec.content;
    if (rec.content !== undefined) return textFromOutput(rec.content);
  }
  throw new Error("Metin modeli beklenen formatta çıktı vermedi");
}

/**
 * Çıktı dizi veya string olabilir. `maxTokens` çağırana bırakılıyor: 13 tag +
 * 300 kelime açıklama tek konsept için ~900 token, 5 konsept aynı tavana
 * sığmıyor ve çıktı cümlenin ortasında kesiliyor.
 */
export async function generateText(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const text = String(prompt ?? "").trim();
  if (!text) throw new Error("Metin promptu boş — istek gönderilmedi.");

  const maxTokens = options.maxTokens ?? 4096;
  const temperature = options.temperature ?? 0.8;
  const payload: Record<string, unknown> = { prompt: text, temperature };

  if (TEXT_MODEL.includes("gemini")) {
    // Düşünme token'ı max_output_tokens'tan düşülüyor. Tema çağrısı 500
    // verdiğinde JSON ~62 karakterde kesiliyordu.
    payload.max_output_tokens = Math.max(maxTokens, 8192);
    payload.thinking_budget = 0;
    payload.system_instruction = "Return only the requested output. No markdown fences, no preamble.";
  } else {
    payload.max_tokens = maxTokens;
    // deepseek-v3 Replicate'te GMICloud/SiliconFlow'a gidiyor; prompt tek başına
    // content part'ı null bırakıyor. Chat formatında string content şart.
    if (!TEXT_MODEL.includes("v3.1")) {
      payload.messages = [{ role: "user", content: text }];
    }
  }

  const prediction = await runModel(TEXT_MODEL, payload);
  return textFromOutput(prediction.output);
}
