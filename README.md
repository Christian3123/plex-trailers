# Plex Trailers

Sitio web para mostrar **solo las películas de una biblioteca de Plex** y sus trailers/extras disponibles en Plex.

## Arquitectura

- `public/` → página web que puedes publicar en GitHub Pages.
- `server.js` → API Node.js que consulta Plex y mantiene el token fuera del navegador.
- `.env.example` → configuración del servidor.
- El navegador **no recibe el token de Plex**.

Plex documenta que la API usa `X-Plex-Token` para autenticar las peticiones y que las películas pueden consultarse mediante los endpoints de biblioteca/metadatos.

## 1. Configurar el servidor

Instala Node.js 18+.

Copia `.env.example` como `.env` y completa:

```env
PLEX_URL=http://192.168.1.100:32400
PLEX_TOKEN=TU_TOKEN_DE_PLEX
PLEX_LIBRARY_ID=1
PORT=3000
CORS_ORIGIN=*
```

`PLEX_LIBRARY_ID` es el número de la biblioteca de películas. Si no lo sabes, abre:

```text
http://TU_IP_PLEX:32400/library/sections
```

con tu token o usa el endpoint `/api/libraries` del proyecto.

## 2. Instalar y ejecutar

```bash
npm install
npm start
```

La API quedará en:

```text
http://localhost:3000
```

Prueba:

```text
http://localhost:3000/api/movies
```

## 3. GitHub Pages

GitHub Pages puede alojar la carpeta `public/`, pero **no ejecuta `server.js`**.

Por eso tienes dos piezas:

```text
GitHub Pages → public/
                    ↓
              servidor Node.js
                    ↓
                  Plex
```

Debes ejecutar el servidor Node.js en un equipo/servicio que pueda comunicarse con tu Plex y tenga una URL HTTPS pública.

Después, en `public/config.js` cambia:

```js
window.PLEX_API_URL = "https://TU-SERVIDOR-API.example.com";
```

Si usas la misma máquina que Plex, `PLEX_URL` puede ser algo como:

```text
http://localhost:32400
```

pero esa dirección **solo funciona desde el servidor Node**, no desde GitHub Pages.

## Seguridad

- No pongas `PLEX_TOKEN` dentro de `public/`.
- No lo subas a GitHub.
- `.env` está incluido en `.gitignore`.
- Si un token se expone públicamente, revócalo/cámbialo.

## Trailers

El proyecto intenta mostrar los extras/trailers que Plex tenga asociados a cada película mediante:

```text
/library/metadata/{ratingKey}/extras
```

Si una película no tiene un trailer/extras disponible en Plex, la página muestra "Trailer no disponible" en vez de inventar un enlace.
