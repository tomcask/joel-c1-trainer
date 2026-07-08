# Joel C1 Trainer

SPA estática y responsive para practicar Cambridge C1 Advanced Use of English Part 4.

Funciona completamente en el navegador, sin backend, sin login y sin base de datos externa. Las preguntas importadas, sesiones y resultados se guardan en `localStorage`.

## Instalar

```bash
npm install
```

## Ejecutar en local

```bash
npm run dev
```

Abre la URL que muestra Vite, normalmente `http://localhost:5173`.

## Generar build estático

```bash
npm run build
```

El resultado queda en `dist/` y se puede publicar como sitio estático.

Para revisar el build localmente:

```bash
npm run preview
```

## Desplegar en Vercel

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. Importa el proyecto desde Vercel.
3. Usa la configuración detectada para Vite:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Despliega.

No hace falta configurar backend, variables de entorno ni rutas especiales porque la app no usa React Router.

## Desplegar en Netlify

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. Crea un nuevo sitio en Netlify desde el repositorio.
3. Configura:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Despliega.

Si en el futuro se añaden rutas internas con React Router, añade un fallback SPA con un fichero `public/_redirects` que contenga:

```text
/* /index.html 200
```

## GitHub Pages

GitHub Pages también sirve si se publica la carpeta `dist/`. Si el proyecto se despliega bajo una subruta, configura `base` en `vite.config.ts` antes de generar el build.

## Formato de importación

La app acepta un array de preguntas o un objeto con propiedad `questions`. Cada pregunta debe incluir:

- `id`
- `part`
- `tags`
- `question.first_sentence`
- `question.keyword`
- `question.second_sentence`
- `question.word_limit_min`
- `question.word_limit_max`
- `answers`
- `explanation`

Consulta `public/sample-questions.json` para un ejemplo completo.
