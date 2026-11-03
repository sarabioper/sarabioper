// Adds what background location needs to the generated Android project (run after `npx cap add android`).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
const man = "android/app/src/main/AndroidManifest.xml";
let m = readFileSync(man, "utf8");
const perms = ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_LOCATION", "POST_NOTIFICATIONS", "WAKE_LOCK"];
const add = perms.filter((p) => !m.includes("android.permission." + p)).map((p) => `    <uses-permission android:name="android.permission.${p}" />`).join("\n");
m = m.replace("</manifest>", `${add}\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>`);
writeFileSync(man, m);
// notification texts and colour of the "location is shared" notification
const res = "android/app/src/main/res/values/strings.xml";
let s = readFileSync(res, "utf8");
if (!s.includes("capacitor_background_geolocation_notification_channel_name"))
  s = s.replace("</resources>", `    <string name="capacitor_background_geolocation_notification_channel_name">Konum paylaşımı</string>\n    <string name="capacitor_background_geolocation_notification_color">#E8A317</string>\n</resources>`);
writeFileSync(res, s);
console.log("android patched");
