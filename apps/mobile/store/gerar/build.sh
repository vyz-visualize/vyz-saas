#!/bin/zsh
# Builds de loja do VYZ, sem EAS.
#
#   store/gerar/build.sh android          → store/build/vyz-<versão>-<code>.aab (assinado com a chave de envio)
#   TEAM_ID=XXXXXXXXXX store/gerar/build.sh ios
#                                         → store/build/VYZ.xcarchive e o .ipa para enviar
#   store/gerar/build.sh ios-check        → só compila o iOS em Release, sem assinar
#
# Antes: preencher .env.production.local (inclusive EXPO_PUBLIC_REVENUECAT_*),
# pôr google-services.json nesta pasta (push no Android) e subir buildNumber /
# versionCode no app.json a cada envio.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=store/build
mkdir -p $OUT
set -a; source ./.env.production.local; set +a

case "${1:-}" in
  android)
    export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
    export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
    KS="${VYZ_KEYSTORE:-$HOME/.vyz/vyz-upload.jks}"
    PW="${VYZ_KEYSTORE_PASSWORD:-$(grep '^senha=' $HOME/.vyz/vyz-upload.txt | cut -d= -f2)}"
    CI=1 npx expo prebuild --platform android --clean
    (cd android && ./gradlew bundleRelease -q \
      -Pandroid.injected.signing.store.file="$KS" -Pandroid.injected.signing.store.password="$PW" \
      -Pandroid.injected.signing.key.alias=vyz-upload -Pandroid.injected.signing.key.password="$PW")
    V=$(node -p "require('./app.json').expo.version"); C=$(node -p "require('./app.json').expo.android.versionCode")
    cp android/app/build/outputs/bundle/release/app-release.aab "$OUT/vyz-$V-$C.aab"
    echo "✓ $OUT/vyz-$V-$C.aab"
    ;;
  ios|ios-check)
    node scripts/audit-bundle.mjs ios || { echo "Revise a auditoria (os \"Android\" de bibliotecas são esperados)."; }
    CI=1 npx expo prebuild --platform ios --clean
    (cd ios && pod install --repo-update --silent)
    if [[ "$1" == "ios-check" ]]; then
      xcodebuild -workspace ios/Vyzualize.xcworkspace -scheme Vyzualize -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO -quiet build
      echo "✓ iOS compila em Release"
      exit 0
    fi
    : "${TEAM_ID:?Defina TEAM_ID (time da Apple dono do app)}"
    xcodebuild -workspace ios/Vyzualize.xcworkspace -scheme Vyzualize -configuration Release -destination 'generic/platform=iOS' \
      -archivePath "$OUT/VYZ.xcarchive" DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates -quiet archive
    cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>$TEAM_ID</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>${DESTINATION:-export}</string>
</dict></plist>
PLIST
    # DESTINATION=upload envia direto para o App Store Connect (Xcode logado na conta)
    xcodebuild -exportArchive -archivePath "$OUT/VYZ.xcarchive" -exportPath "$OUT/ios" -exportOptionsPlist "$OUT/ExportOptions.plist" -allowProvisioningUpdates
    echo "✓ $OUT/ios"
    ;;
  *) echo "uso: build.sh android | ios | ios-check"; exit 1 ;;
esac
