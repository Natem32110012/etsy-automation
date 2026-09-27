/**
 * Metin modelleri JSON isterken bile araya markdown çiti veya bir cümle
 * koyabiliyor. İlk `{` ile son `}` arasını alıp ayrıştırmak, "sadece JSON
 * döndür" talimatına güvenmekten daha dayanıklı.
 */
export function parseJson<T>(raw: string, what: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) {
    throw new Error(`${what} modeli JSON döndürmedi: ${raw.slice(0, 200)}`);
  }

  const body = cleaned.slice(start);
  const end = body.lastIndexOf("}");
  if (end !== -1) {
    try {
      return JSON.parse(body.slice(0, end + 1)) as T;
    } catch {
      // Aşağıdaki kurtarma denenecek.
    }
  }

  // Model token sınırına çarptığında çıktı cümlenin ortasında kesiliyor.
  // Tamamlanmış girdileri kurtarmak, bütün partiyi çöpe atmaktan iyi.
  const repaired = repairTruncatedJson(body);
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch {
      // Kurtarma da tutmadıysa hatayı bildir.
    }
  }

  throw new Error(
    `${what} modeli geçerli JSON döndürmedi (${body.length} karakter, büyük olasılıkla kesildi): ${body.slice(0, 160)}`,
  );
}

/**
 * Yarıda kesilmiş JSON'u son tamamlanmış girdiye kadar geri sarıp açık kalan
 * parantezleri kapatır. Örnek: 5 konseptin 4'ü tamamlandıysa 4'ü kurtarılıyor,
 * eksik olan çağıran tarafta "eksik üretildi" olarak raporlanıyor.
 */
export function repairTruncatedJson(text: string): string | null {
  const open: string[] = [];
  let inString = false;
  let escaped = false;
  /** En son tamamlanmış iç değerin bittiği konum ve o andaki açık parantezler. */
  let safeEnd = -1;
  let safeOpen: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      open.push(char);
    } else if (char === "}" || char === "]") {
      open.pop();
      // Kök nesne kapanmadan önceki her kapanış güvenli bir kesme noktası.
      if (open.length > 0) {
        safeEnd = i;
        safeOpen = [...open];
      }
    }
  }

  // Çıktı zaten dengeli ya da kurtarılacak tamamlanmış girdi yok.
  if (open.length === 0 || safeEnd === -1) return null;

  const closing = safeOpen
    .reverse()
    .map((char) => (char === "{" ? "}" : "]"))
    .join("");

  return text.slice(0, safeEnd + 1) + closing;
}
