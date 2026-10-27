"""Runs in GitHub Actions right after `npx cap add android`.
Makes the Android project game-ready: portrait, fullscreen, AdMob app id, app icons, version number.
"""
import base64, io, os, re, math, pathlib

APP_ID = "com.alxmobileapps.circusclown"
A = pathlib.Path("android/app/src/main")
RES = A / "res"

def edit(path, fn):
    p = pathlib.Path(path); s = p.read_text(); n = fn(s)
    if n == s: print("WARNING: no change in", path)
    p.write_text(n)

# 1) Portrait only + AdMob app id (read from www/ads-config.js)
ads_cfg = pathlib.Path("www/ads-config.js").read_text()
m = re.search(r"appId:\s*'([^']+)'", ads_cfg)
ADMOB_APP_ID = m.group(1) if m else "ca-app-pub-3940256099942544~3347511713"
cfg_child = bool(re.search(r"childDirected:\s*true", ads_cfg))

def manifest(s):
    if "screenOrientation" not in s:
        s = s.replace('android:name=".MainActivity"',
                      'android:name=".MainActivity"\n            android:screenOrientation="portrait"', 1)
    if cfg_child and "permission.AD_ID" not in s:
        # Families policy: no advertising ID for a kids audience
        if 'xmlns:tools' not in s:
            s = s.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ', 1)
        s = s.replace('</manifest>', '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>\n</manifest>', 1)
    if "<queries>" not in s:
        pk = ["com.facebook.katana", "com.facebook.lite", "com.whatsapp", "com.whatsapp.w4b", "com.twitter.android",
              "com.instagram.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill"]
        q = "    <queries>\n" + "".join(f'        <package android:name="{x}"/>\n' for x in pk) + "    </queries>\n"
        s = s.replace('</manifest>', q + '</manifest>', 1)
    if "gms.ads.APPLICATION_ID" not in s:
        s = re.sub(r"(<application\b[^>]*>)", lambda m: m.group(1) +
                   '\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="'
                   + ADMOB_APP_ID + '"/>', s, count=1)
    return s
edit(A / "AndroidManifest.xml", manifest)
print("AdMob app id:", ADMOB_APP_ID)

# 2) Fullscreen theme (no status bar), draw under the camera cutout
def styles(s):
    extra = ('<item name="android:windowFullscreen">true</item>\n'
             '        <item name="android:windowLayoutInDisplayCutoutMode" tools:targetApi="p">shortEdges</item>\n        ')
    s = re.sub(r'(<style name="AppTheme.NoActionBar"[^>]*>\s*)', lambda m: m.group(1) + extra, s)
    s = re.sub(r'(<style name="AppTheme.NoActionBarLaunch"[^>]*>\s*)', lambda m: m.group(1) + extra, s)
    if 'xmlns:tools' not in s:
        s = s.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">', 1)
    return s
edit(RES / "values/styles.xml", styles)

# 3) Immersive mode (hide navigation bar too)
java = A / "java" / pathlib.Path(*APP_ID.split(".")) / "MainActivity.java"
java.write_text(f"""package {APP_ID};

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {{
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {{
        registerPlugin(AppSharePlugin.class);
        super.onCreate(savedInstanceState);
    }}

    @Override
    public void onResume() {{ super.onResume(); hideBars(); }}

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {{
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }}

    private void hideBars() {{
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }}
}}
""")

# 3b) AppShare plugin: send the score picture + message straight to a chosen app
(java.parent / "AppSharePlugin.java").write_text('''package APP_ID_HERE;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.LabeledIntent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import java.util.ArrayList;
import java.util.List;
import android.net.Uri;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "AppShare")
public class AppSharePlugin extends Plugin {
    @PluginMethod
    public void chooser(PluginCall call) {
        try {
            String text = call.getString("text", "");
            String path = call.getString("path");
            JSArray pk = call.getArray("packages");
            Context ctx = getContext();
            try {
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("Circus Clown", text));
            } catch (Exception e) { }
            Uri uri = null;
            if (path != null) {
                File f = new File(Uri.parse(path).getPath());
                uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            }
            Intent base = new Intent(Intent.ACTION_SEND);
            base.setType(uri != null ? "image/png" : "text/plain");
            base.putExtra(Intent.EXTRA_TEXT, text);
            if (uri != null) {
                base.putExtra(Intent.EXTRA_STREAM, uri);
                base.setClipData(ClipData.newRawUri("", uri));
                base.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            PackageManager pm = ctx.getPackageManager();
            List<Intent> first = new ArrayList<>();
            for (int n = 0; n < pk.length(); n++) {
                String pkg = pk.getString(n);
                Intent probe = new Intent(base);
                probe.setPackage(pkg);
                List<ResolveInfo> ris = pm.queryIntentActivities(probe, 0);
                if (ris.isEmpty()) continue;
                ResolveInfo ri = ris.get(0);
                Intent it = new Intent(base);
                it.setComponent(new ComponentName(ri.activityInfo.packageName, ri.activityInfo.name));
                first.add(new LabeledIntent(it, ri.activityInfo.packageName, ri.loadLabel(pm), ri.getIconResource()));
            }
            Intent chooser = Intent.createChooser(base, call.getString("title", "Share your score"));
            if (!first.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, first.toArray(new Intent[0]));
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            getActivity().runOnUiThread(() -> Toast.makeText(ctx,
                "Message copied - paste it as your caption", Toast.LENGTH_LONG).show());
            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed: " + e);
        }
    }

    @PluginMethod
    public void shareTo(PluginCall call) {
        try {
            String text = call.getString("text", "");
            String path = call.getString("path");
            JSArray pk = call.getArray("packages");
            Context ctx = getContext();
            // Facebook, Instagram and TikTok ignore pre-written text, so also copy it for pasting
            try {
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("Circus Clown", text));
            } catch (Exception e) { }
            Uri uri = null;
            if (path != null) {
                File f = new File(Uri.parse(path).getPath());
                uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            }
            for (int n = 0; n < pk.length(); n++) {
                String pkg = pk.getString(n);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(uri != null ? "image/png" : "text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                if (uri != null) {
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.setClipData(ClipData.newRawUri("", uri));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
                i.setPackage(pkg);
                try {
                    getActivity().startActivity(i);
                    getActivity().runOnUiThread(() -> Toast.makeText(ctx,
                        "Message copied - paste it as your caption", Toast.LENGTH_LONG).show());
                    call.resolve();
                    return;
                } catch (Exception e) { /* app not installed, try next */ }
            }
            call.reject("App not installed");
        } catch (Exception e) {
            call.reject("Share failed: " + e);
        }
    }
}
'''.replace("APP_ID_HERE", APP_ID))

# 3c) Google Play requires targeting API level 36
vg = pathlib.Path("android/variables.gradle")
edit(vg, lambda t: re.sub(r"(targetSdkVersion\s*=\s*)\d+", r"\g<1>36", re.sub(r"(compileSdkVersion\s*=\s*)\d+", r"\g<1>36", t)))
edit(vg, lambda t: re.sub(r"(minSdkVersion\s*=\s*)\d+", r"\g<1>24", t))   # Play automatic protection needs minSdk 24+
gp = pathlib.Path("android/gradle.properties")
gp.write_text(gp.read_text().rstrip("\n") + "\nandroid.suppressUnsupportedCompileSdk=36\n")
print(vg.read_text())

# 4) Version from the GitHub run number
vc = os.environ.get("VERSION_CODE", "1")
edit("android/app/build.gradle", lambda s: re.sub(r'versionName "[^"]*"', f'versionName "1.0.{vc}"',
                                                  re.sub(r"versionCode \d+", f"versionCode {vc}", s)))

# 5) App icons from resources/app-icon.png (square artwork, 1024x1024)
from PIL import Image, ImageDraw
art = Image.open("resources/app-icon.png").convert("RGBA")
BG = (179, 138, 242, 255)   # purple behind the artwork on adaptive icons

dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for d, m in dens.items():
    folder = RES / f"mipmap-{d}"; folder.mkdir(parents=True, exist_ok=True)
    a, l = int(108 * m), int(48 * m)
    # adaptive icon: artwork fills the visible 72dp square of the 108dp layer
    fg = Image.new("RGBA", (a, a), (0, 0, 0, 0))
    inner = art.resize((int(a * 72 / 108),) * 2, Image.LANCZOS)
    off = (a - inner.width) // 2; fg.alpha_composite(inner, (off, off))
    fg.save(folder / "ic_launcher_foreground.png")
    Image.new("RGBA", (a, a), BG).save(folder / "ic_launcher_background.png")
    # legacy icons (older phones)
    full = art.resize((l, l), Image.LANCZOS)
    full.convert("RGB").save(folder / "ic_launcher.png")
    mask = Image.new("L", (l * 4, l * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, l * 4 - 1, l * 4 - 1), fill=255)
    rnd = full.copy(); rnd.putalpha(mask.resize((l, l), Image.LANCZOS)); rnd.save(folder / "ic_launcher_round.png")

any_dpi = RES / "mipmap-anydpi-v26"; any_dpi.mkdir(parents=True, exist_ok=True)
xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
       '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
       '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
       '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
       '</adaptive-icon>\n')
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (any_dpi / name).write_text(xml)
for p in RES.glob("drawable*/ic_launcher_foreground.xml"):
    p.unlink()

# 512px Play Store icon (32-bit PNG)
os.makedirs("dist", exist_ok=True)
art.resize((512, 512), Image.LANCZOS).save("dist/playstore-icon-512.png")
print("Android project patched: portrait, fullscreen, AdMob, icons, version", vc)
