# Telar — set de marca

Todo trazado a curvas. Ningún archivo depende de que haya una fuente instalada.

## Dónde vive cada cosa en el repo

| Uso | Archivo |
|---|---|
| Componente React (icono + lockups) | `frontend/src/components/Logo.tsx` |
| Favicon / iconos de PWA que usa la app | `frontend/public/favicon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |
| Manifest | `frontend/public/site.webmanifest` |
| Header del README | `brand/telar-horizontal-light.svg` / `-dark.svg` (variantes con color fijo para que se vean bien en los dos temas de GitHub) |

> **Nota:** el favicon/ícono que usa la app (`frontend/public/favicon.png` y
> los `icon-*.png`) es una pieza aparte que trajiste vos (la burbuja de chat
> con la trama en rejilla) — no el `telar-favicon.svg` de este set, que quedó
> acá como referencia sin usar. Si en algún momento querés unificar los dos
> diseños, este es el lugar.

## Archivos de este set

| Archivo | Uso |
|---|---|
| `telar-mark.svg` | Icono completo, coral fijo |
| `telar-mark-mono.svg` | Icono a una tinta (todo `currentColor`) |
| `telar-mark-simple.svg` | Icono simplificado para 16–32 px |
| `telar-horizontal.svg` | Lockup principal, `currentColor` (hereda del contenedor) |
| `telar-horizontal-light.svg` / `-dark.svg` | Mismo lockup con color fijo, para README/Markdown donde no hay CSS que herede |
| `telar-vertical.svg` | Lockup para login, splash, footer centrado |
| `telar-favicon.svg` | Favicon original del set, con fondo `#0C0C0C` (sin usar en la app — ver nota arriba) |
| `telar-icon-512.png` / `-192.png` | Íconos de referencia del set original |
| `telar-apple-touch-icon.png` | 180×180, iOS — versión del set original |
| `telar-avatar-400.png` | Avatar de la organización en GitHub |
| `telar-brandsheet.svg` | Hoja de contacto: lockups, versiones, tamaños, paleta |
| `Logo.reference.tsx` | Copia de referencia del componente original (la que corre en la app está en `frontend/src/components/Logo.tsx`) |
| `telar-tokens.css` | Tokens de Tailwind v4 — de referencia; el frontend ya define su propia paleta equivalente en `frontend/src/index.css` |

## Componente

```tsx
import { Logo } from '@/components/Logo'

<Logo variant="horizontal" size={32} />        // header
<Logo variant="mark" size={40} />              // sidebar colapsado
<Logo variant="icon" size={20} />              // favicon inline, badges, nodos
<Logo variant="vertical" size={120} />         // login, splash
<Logo variant="mark" size={40} accent="#FFB4A2" /> // estado hover / deshabilitado
```

El icono hereda `currentColor`, así que el color lo controla el contenedor.
Solo el hilo coral está fijo. Para una tinta plana (impresión, sello,
watermark) pasá `accent="currentColor"` — así se usa en el panel de marca
de `LoginPage.tsx`.

## Reglas de uso

- **Área de respeto**: el alto de la burbuja del icono por cada lado.
- **Tamaño mínimo**: lockup horizontal a 24 px de alto; por debajo usá `variant="icon"`.
- **Fondo claro**: usá el lockup en `#171717`, nunca en negro puro.
- **No** cambies la proporción entre icono y logotipo, ni recolorees el hilo salvo
  a `#FFB4A2` o a una tinta plana.
- El hilo coral siempre sale por la derecha. Si necesitás espejarlo para un layout
  RTL, espejá el bloque completo, no solo el icono.

## Tipografía

Logotipo: **Sora 600**, tracking -2.5%, trazado a curvas — ya viene vectorizado
en `Logo.tsx`, no depende de tener la fuente instalada. Si en algún momento
querés usar Sora como fuente de display en la UI (títulos, no el logo):

```bash
npm i @fontsource-variable/sora
```

```ts
import '@fontsource-variable/sora'
```

`telar-tokens.css` ya la declara como `--font-display` de referencia.
