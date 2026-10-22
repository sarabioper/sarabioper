// Assembles public/index.html from the source parts in src/.
import { readFileSync, writeFileSync } from "node:fs";
const r = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = r("src/style.html").replace(/<title>[\s\S]*?<\/title>\s*<meta name="claude:viewport-fit-sides" content="cover">/, "");
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Sarabi Ops</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0F1E2E">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Sarabi Ops">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
${css}
<style>html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${r("src/body.html")}
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>
${r("src/i18n.js")}
${r("src/parser.js")}
${r("src/tourists.js")}
${r("src/docs.js")}
${r("src/app.js")}
${r("src/extra.js")}
${r("src/tours.js")}
${r("src/scan.js")}
</script>
</body>
</html>
`;
writeFileSync(new URL("public/index.html", import.meta.url), html);
console.log("public/index.html", html.length, "bytes");
