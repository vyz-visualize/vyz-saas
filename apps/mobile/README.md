# VYZ · app (Expo)

App nativo do VYZ para iOS e Android: Expo SDK 58, Expo Router, React Native. Versão atual: 1.0.0, build 10 (`app.json`).

Arquitetura, planos na loja e checklist de envio: [docs/MOBILE.md](../../docs/MOBILE.md). Publicação nas lojas: [store/LOJAS.md](store/LOJAS.md).

## Rodar

```bash
npm install
cp .env.example .env      # preencher
npm run ios               # expo run:ios: gera a pasta nativa, compila e abre no simulador
npm run android           # expo run:android
npm start                 # só o servidor do Metro
```

`ios/` e `android/` não vão para o git: são gerados pelo `expo prebuild`. Mudança nativa vai no `app.json` ou no `app.config.js`.

## Conferir

```bash
npm run lint              # expo lint
npm run typecheck         # tsc --noEmit
node scripts/audit-bundle.mjs ios   # termos proibidos no iOS, antes de cada envio
```

Para instalar biblioteca, use `npx expo install <pacote>` (versão compatível com o SDK).

## Builds das lojas

Locais, sem EAS, pelo `store/gerar/build.sh` (`android`, `ios` ou `ios-check`). A cada envio, suba `ios.buildNumber` e `android.versionCode` no `app.json`. As chaves de publicação ficam fora do git, em `~/Documents/VYZ/Publicar`.

## Pastas

- `src/app/`: telas (Expo Router): `entrar`, abas Início, Análises, VYZ e Conta, A Fazer e o dashboard.
- `src/lib/`: sessão (Supabase, Keychain/Keystore), API do site, login, compras (RevenueCat) e push.
- `src/ui/`: componentes.
- `store/`: textos, imagens, produtos e scripts das lojas.
