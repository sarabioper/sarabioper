/* ---------- state support and tax reliefs for a travel agency in Türkiye (public information, no company data) ---------- */
// Updated by the weekly check (a scheduled task searches the news, edits this list and pushes).
// fit: 'yes' — applies to a travel agency; 'check' — may apply, ask the accountant / bank; 'no' — not for an agency (kept so nobody spends time on it)
var PERKS_AT='2026-11-22';
var PERKS=[
  {id:'kdv-incoming',fit:'yes',t:'KDV 0% на услуги иностранному туроператору (incoming)',
   d:'По KDV 11/1-a освобождается от НДС часть, которую агентство оставляет себе (наценка/комиссия), когда: счёт выставлен на иностранную фирму, оплата пришла из-за границы в валюте, услуга «используется за рубежом». Отель, трансферы, экскурсии, которые турист получает в Турции, — с обычным KDV.',
   do:'Проверить с бухгалтером, что счета зарубежным партнёрам идут с istisna, а оплата — валютой на счёт.',src:'https://www.verginet.net/dtt/4/IncomingTurlardaKdvIstisnasi_8767.aspx'},
  {id:'sgk-2puan',fit:'yes',t:'Скидка SGK работодателю (бывшие «5 пунктов»)',
   d:'С 01.01.2026 для всех, кроме производства, скидка 2 пункта (было 4–5), закон 7566. Только если декларации подаются вовремя и нет просроченного долга SGK.',
   do:'Не допускать просрочек MUHSGK и долгов SGK — иначе скидка пропадает за весь месяц.',src:'https://www.alomaliye.com/2026/07/18/5510-sayili-kanun-2-puan-5-puan-indirim-tesviki-2026/'},
  {id:'ticaret-tanitim',fit:'check',t:'Минторг: 50% расходов на рекламу и зарубежные выставки',
   d:'Программа для сферы услуг: реклама/продвижение — 50%, до 25 млн TL в год (5 лет); зарубежные выставки — до 1,5 млн TL за мероприятие (престижные до 3 млн), +20 пунктов для целевых стран. Условие: ≥51% выручки за 2 года — из этой сферы. Входит ли туристическое агентство — уточнить по списку программы.',
   do:'Спросить консультанта по экспорту услуг (hizmet ihracatı) / Минторг, подходит ли агентство.',src:'https://nexteradanismanlik.com/blog/hizmet-ihracati-tesvikleri-2026-rehberi'},
  {id:'reeskont',fit:'check',t:'Дешёвый кредит ЦБ (reeskont) за валютную выручку',
   d:'Кредиты TCMB на экспорт и «döviz kazandırıcı hizmetler». С 05.09.2026 выдаются не только через Eximbank, но и через другие банки; расширено освобождение от налогов и сборов по ним.',
   do:'Спросить в своём банке, даёт ли он reeskont под валютную выручку от иностранных туроператоров.',src:'https://www.foreks.com/haber/detay/6a9ba92e95016b5817e56636/PICNEWS/tr/reeskont-kredilerinde-kapsam-genisledi-eximbank-in-yanina-diger-bankalar-da-eklendi-05-09-26/'},
  {id:'hizmet-ihracati',fit:'check',t:'Вычет 100% прибыли от экспорта услуг',
   d:'С 2026 года вычет вырос с 80% до 100% (решение Президента 11257 от 30.04.2026). Но список услуг — ПО, инжиниринг, дизайн, медотчёты, колл-центры и т.п.; туризм там прямо не назван.',
   do:'Спросить YMM, подпадает ли что-то из работы агентства. Скорее всего — нет.',src:'https://www.vdd.com.tr/2026-2140-hizmet-ihracati-ve-yurt-disi-istirak-kazanclarina-iliskin-istisna-ve-indirim-oranlarinda-yapilan-degisiklikler.html'},
  {id:'turizm-ucret-7590',fit:'no',t:'Турпомощь по зарплатам 116,67 TL/день (закон 7590)',
   d:'Май–декабрь 2026, вычитается из взносов SGK. Только для отелей с туристическим свидетельством; турагентства, рестораны, пляжи — нет.',
   do:'Агентству не положено, если нет своего отеля.',src:'https://www.alomaliye.com/2026/09/01/7590-sayili-kanun-kapsaminda-turizm-sektoru-gecici-prim-destegi-2026/'},
  {id:'doviz-donusum',fit:'no',t:'Доплата 3% за продажу валюты (döviz dönüşüm desteği)',
   d:'Продлена до 31.01.2027. Для экспортёров товаров; про туризм и услуги не сказано.',
   do:'Агентству, скорее всего, не положено.',src:'https://www.cnnturk.com/ekonomi/tcmbden-doviz-icin-yeni-karar-sure-2027ye-kadar-uzatildi-3448992'},
  {id:'kosgeb-kapasite',fit:'no',t:'KOSGEB: кредит до 20 млн TL на рост',
   d:'Набор до 15.09.2026 закрыт. Сферы: производство, ИТ, консалтинг, R&D — турагентств в списке нет.',
   do:'Следить за новыми программами KOSGEB.',src:'https://www.alomaliye.com/2026/08/24/kobi-kapasite-destegi-basvurulari-basladi/'}
];
