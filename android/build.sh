#!/usr/bin/env bash
# Builds public/downloads/tradesim5.apk from this folder.
# Needs: JAVA_HOME (JDK 17) and ANDROID_SDK with build-tools;34.0.0 and platforms;android-34.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
SDK="${ANDROID_SDK:?set ANDROID_SDK}"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
VERSION_CODE="$(grep -o 'VERSION_CODE = [0-9]*' "$HERE/src/app/tradesim/five/MainActivity.java" | grep -o '[0-9]*$')"
OUT="$(mktemp -d)"

"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest "$HERE/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_CODE.0" \
  --java "$OUT/gen" "$OUT/res.zip"
javac -source 1.8 -target 1.8 -bootclasspath "$JAR:$BT/core-lambda-stubs.jar" -nowarn -d "$OUT/classes" \
  $(find "$HERE/src" "$OUT/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q -j "$OUT/base.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$HERE/release.keystore" --ks-pass pass:tradesim5 --key-pass pass:tradesim5 \
  --out "$ROOT/public/downloads/tradesim5.apk" "$OUT/aligned.apk"
printf '{"versionCode":%s,"url":"/downloads/tradesim5.apk"}\n' "$VERSION_CODE" > "$ROOT/public/downloads/app.json"
rm -f "$ROOT/public/downloads/tradesim5.apk.idsig"
echo "Built public/downloads/tradesim5.apk (version $VERSION_CODE)"
