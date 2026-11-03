# Sarabi Sürücü (driver app)

The Android app wraps `public/driver.html` with Capacitor and adds background location.
It is built by GitHub Actions (`.github/workflows/driver-apk.yml`) on every change to `app/` or `public/driver.html`;
the APK is published as the release `driver-latest`:

https://github.com/sarabioper/sarabioper/releases/download/driver-latest/sarabi-driver.apk

Drivers and their 6-digit PINs are created by the administrator in the 🔐 Admin tab.
