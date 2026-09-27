# Etsy Dijital Ürün Fabrikası

Etsy'de satılacak dijital ürünlerin konseptini, SEO metnini ve görsellerini üretip
export eden, ardından Pinterest'te tanıtımını hazırlayan yerel üretim aracı.

Metin üretimi `deepseek-ai/deepseek-v3`, görsel üretimi `openai/gpt-image-2` —
ikisi de Replicate üzerinden.

## Kurulum

```bash
npm install
cp .env.example .env.local   # REPLICATE_API_TOKEN doldur
npm run live:up
```

`http://localhost:3001` — Mac açılınca kendiliğinden kalkar. Durdurmak: `npm run live:down`.
Geliştirirken önce `live:down`, sonra `npm run dev` (yine 3001).

`.env.local` içinde Replicate token'ı zorunlu. Pinterest alanları boşken sistem
çalışmaya devam eder: pin metinleri üretilir ama pin atılmaz (dry-run).

## Akış

**Adım 0 — Kurulum.** Ürün tipini seç, adet ve promo görseli sayısını gir.
"Tema öner" geçmişe bakıp henüz denenmemiş temalardan chip'ler üretir; birine
tıklamak konseptleri o temanın etrafında kurar.

**Adım 1 — Konsept onayı.** Her konsept bir kart: ürün görseli promptu, promo
sahneleri, Etsy başlık/açıklama/etiket önizlemesi. Kart bazında onayla, reddet
veya yeniden üret. Reddedilen konsept silinmez; log'da kalır ve bir daha
üretilmemesi için `avoid_list`'e girer.

**Adım 2 — Görsel onayı.** Önce ürün görseli üretilir. Onaylandıktan sonra promo
kareleri açılır, çünkü promo görselleri onaylanan ürün dosyasını referans alarak
üretiliyor — aksi hâlde model tanıtım görselinde başka bir ürün çiziyor. Her kare
için ayrı ayrı onayla, yeniden üret ya da sahne talimatını düzenleyip yeniden
üret. Eski denemeler `v1`, `v2` olarak kartta durur.

**Adım 3 — Export.** Bütün kareler onaylanınca klasör yazılır:

```
data/exports/01-{etsy-baslik-slug}-{YYYY-MM-DD}-{boyut}/
├── product/    ürün görseli (print-ready)
├── promo/      01.png, 02.png ... (1000x1500)
├── rejected/   onaylanmayan bütün denemeler
├── copy.md     Etsy başlık, açıklama, etiketler
└── copy.json   aynı içerik makine okunur hâlde
```

**Adım 4 — Pinterest.** Ürünü Etsy'ye elle yükleyip linki karta yapıştır. Link
gönderildiğinde ayrı bir LLM çağrısı Pinterest'e özel başlık (≤100 karakter) ve
açıklama (≤500 karakter) üretir, ardından seçtiğin promo görselleriyle pin
oluşturulur. Hangi promo görsellerinin pinleneceğini kartta sen seçersin;
seçmezsen ilk onaylı promo kullanılır.

## Görsel boyutları

| Tip | Ürün görseli | Promo |
| --- | --- | --- |
| Doodle, Boyama, Parti | Letter 2550x3300 @300dpi | 1000x1500 |
| Planner, Davetiye | A4 2480x3508 @300dpi | 1000x1500 |

`gpt-image-2` en fazla ~1536px kenar üretiyor, yani print dosyaları modelden en
yakın oranda alınıp `sharp` ile hedef boyuta büyütülüyor. A4 ve Letter oranları
modelin desteklediği oranların hiçbirine tam denk gelmediği için görsel
kırpılmıyor, beyaz kenar eklenerek oturtuluyor — planner grid'i veya davetiye
metin alanı kenardan kesilmesin diye.

Promo görselleri tam 2:3 olduğu için hem Etsy galerisinde hem Pinterest pininde
aynı dosya kullanılıyor, ayrı crop gerekmiyor.

## Ürün tipleri ve promptlar

Beş tipin sanat yönetmenliği birbirine karışmasın diye her biri kendi
dosyasında:

```
src/lib/prompts/doodle.ts       yetişkin doodle — yoğun, detaylı çizgi sanatı
src/lib/prompts/coloring.ts     çocuk boyama — kalın kontur, geniş alanlar
src/lib/prompts/planner.ts      planner — grid ve layout odaklı
src/lib/prompts/invitation.ts   davetiye — metin alanlı şablon
src/lib/prompts/party.ts        parti — banner/etiket/topper seti tek sayfada
```

Ortak kalan tek şey `shared.ts` içindeki JSON sözleşmesi ve Etsy alan kuralları;
parser tek yerden okuduğu için tipler arası kayma olmuyor. Yeni tip eklemek =
yeni prompt dosyası + `prompts/index.ts`'e bir satır + `config/product-types.json`
kaydı.

Sayfa boyutlarını değiştirmek için kod düzenlemeye gerek yok,
`config/product-types.json` yeterli.

## Tekrar önleme

`data/concepts.json` her konsepti tip, başlık, tema, tarih ve durumla loglar.
Konsept üretiminde aynı tipin son 30 kaydı `avoid_list` olarak prompta girer —
sadece başlık ve tema, tüm JSON değil. Aynı çalışmada üretilen konseptler de
listeye ekleniyor, yani tek seferde 5 konsept isterken ikisi aynı fikir çıkmıyor.

## Dashboard

`/dashboard` aynı log dosyasını okuyup tip ve duruma göre gruplar: tip başına
onaylanan ürün sayısı, kaç ürün export edilip Pinterest'i beklediği, ve tipe göre
filtrelenebilen tarih sıralı tablo. Ayrı bir veri toplama mekanizması yok.

## Bilinen sınırlar

- **Replicate hız limiti:** hesap kredisi $5'ın altındayken dakikada 6 istek ve
  burst 1 uygulanıyor. İstemci 429 aldığında Replicate'in söylediği süre kadar
  bekleyip 5 kereye kadar tekrar deniyor, ama düşük kredide toplu üretim yavaş
  ilerler.
- **Pinterest:** Business hesap ve claim edilmiş Etsy mağaza domaini gerekiyor.
  Board id'leri `.env.local` içinde tipe göre eşleşiyor. Görseller base64 olarak
  gönderiliyor, yani dosyaları public bir yere host etmeye gerek yok.
- Üretilen hiçbir dosya silinmiyor; onaylanmayan kareler export klasöründeki
  `rejected/` altına kopyalanıyor.
