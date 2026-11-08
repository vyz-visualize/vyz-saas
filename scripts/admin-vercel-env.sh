#!/bin/sh
# Sobe na Vercel (Production, Sensitive) as variáveis do painel interno, lendo
# do .env.local e convertendo o JSON e o .p8 em base64. Não imprime nenhum valor.
# Uso, na raiz do projeto, depois de "npx vercel login" e "npx vercel link":
#   sh scripts/admin-vercel-env.sh
set -eu
val() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }
put() { printf '%s' "$2" | npx vercel env add "$1" production --sensitive --force >/dev/null && echo "ok  $1"; }
for k in ADMIN_EMAILS GA4_PROPERTY_ID PLAY_REPORTS_BUCKET PLAY_PACKAGE_NAME APPSTORE_ISSUER_ID APPSTORE_VENDOR_NUMBER APPSTORE_KEY_ID REVENUECAT_PROJECT_ID REVENUECAT_API_V2_KEY RESEND_API_KEY; do
  v=$(val "$k")
  if [ -n "$v" ]; then put "$k" "$v"; else echo "falta $k no .env.local"; fi
done
put GOOGLE_SERVICE_ACCOUNT_JSON_B64 "$(base64 < "$(val GOOGLE_SERVICE_ACCOUNT_PATH)" | tr -d '\n')"
put APPSTORE_KEY_P8_B64 "$(base64 < "$(val APPSTORE_KEY_P8_PATH)" | tr -d '\n')"
echo "Pronto. Faça um novo deploy (ou um push) para as variáveis valerem."
