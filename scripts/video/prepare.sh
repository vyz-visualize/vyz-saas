#!/bin/sh
# Prepara o vídeo "Veja por dentro" a partir dos arquivos brutos:
#   npm run video:prepare -- bruto-16x9.mov [bruto-4x5.mov]
# Gera em public/video/ (ou em VIDEO_OUT), para cada versão, o MP4 (H.264, alvo de até ~15 MB
# por minuto), o WebM (VP9) e a capa (frame dos 2 s):
#   vyz-por-dentro.{mp4,webm,jpg}          16:9, até 1920x1080
#   vyz-por-dentro-celular.{mp4,webm,jpg}  4:5, 1080x1350 (corta o que não couber, pelo centro)
set -eu

wide="${1:-}"
tall="${2:-}"
out="${VIDEO_OUT:-public/video}"

if [ -z "$wide" ]; then
  echo "Uso: npm run video:prepare -- bruto-16x9.mov [bruto-4x5.mov]" >&2
  exit 2
fi
for f in "$wide" ${tall:+"$tall"}; do
  if [ ! -f "$f" ]; then
    echo "Arquivo não encontrado: $f" >&2
    exit 2
  fi
done
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Precisa do ffmpeg. No Mac: brew install ffmpeg" >&2
  exit 2
fi

mkdir -p "$out"

# encode <bruto> <nome> <filtro de escala>
encode() {
  input="$1"
  name="$2"
  scale="$3"

  echo "== $name: MP4 (H.264)"
  ffmpeg -hide_banner -loglevel error -y -i "$input" \
    -vf "$scale" -c:v libx264 -preset slow -crf 23 -maxrate 1850k -bufsize 3700k \
    -profile:v high -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart "$out/$name.mp4"

  echo "== $name: WebM (VP9)"
  ffmpeg -hide_banner -loglevel error -y -i "$input" \
    -vf "$scale" -c:v libvpx-vp9 -crf 33 -b:v 1600k -row-mt 1 -deadline good -cpu-used 2 \
    -pix_fmt yuv420p -c:a libopus -b:a 96k -ac 2 "$out/$name.webm"

  echo "== $name: capa (frame dos 2 s)"
  ffmpeg -hide_banner -loglevel error -y -ss 2 -i "$input" -frames:v 1 -vf "$scale" -q:v 3 "$out/$name.jpg"

  # tamanho e MB por minuto (o MP4 tem o alvo de ~15 MB por minuto)
  seconds=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$name.mp4")
  for f in "$out/$name.mp4" "$out/$name.webm" "$out/$name.jpg"; do
    bytes=$(wc -c <"$f" | tr -d ' ')
    awk -v f="$f" -v b="$bytes" -v s="$seconds" 'BEGIN { mb = b / 1048576; if (f ~ /\.jpg$/) printf "%s: %.2f MB\n", f, mb; else printf "%s: %.1f MB (%.1f MB/min)\n", f, mb, mb / (s / 60) }'
  done
}

# 16:9: 1080p no máximo (não amplia), largura par
encode "$wide" "vyz-por-dentro" "scale='min(1920,iw)':-2"
# 4:5: sempre 1080x1350, preenchendo e cortando pelo centro
if [ -n "$tall" ]; then
  encode "$tall" "vyz-por-dentro-celular" "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350"
fi

echo
echo "Pronto. Para o vídeo aparecer no site, defina no .env.local e na Vercel:"
echo "  NEXT_PUBLIC_DEMO_VIDEO_URL=/video/vyz-por-dentro.mp4"
if [ -n "$tall" ]; then
  echo "  NEXT_PUBLIC_DEMO_VIDEO_MOBILE_URL=/video/vyz-por-dentro-celular.mp4"
fi
echo "e faça um novo build (os valores são lidos no build)."
