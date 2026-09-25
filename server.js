import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const PLEX_URL = (process.env.PLEX_URL || "").replace(/\/+$/, "");
const PLEX_TOKEN = process.env.PLEX_TOKEN || "";
const PLEX_LIBRARY_ID = process.env.PLEX_LIBRARY_ID || "";

if (!PLEX_URL || !PLEX_TOKEN) {
  console.warn("Faltan PLEX_URL o PLEX_TOKEN en .env");
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*"
}));

app.use(express.json());

const plexHeaders = {
  Accept: "application/json",
  "X-Plex-Client-Identifier": "plex-trailers-web",
  "X-Plex-Product": "Plex Trailers Web",
  "X-Plex-Version": "1.0.0",
  "X-Plex-Platform": "Web",
  "X-Plex-Token": PLEX_TOKEN
};

async function plex(path) {
  const response = await fetch(`${PLEX_URL}${path}`, {
    headers: plexHeaders
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Plex respondió ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json();
}

function absolutePlexImage(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // El navegador no debe necesitar el token directamente.
  // El endpoint /api/image lo sirve desde nuestro backend.
  return `/api/image?path=${encodeURIComponent(path)}`;
}

function normalizeMovie(movie) {
  return {
    ratingKey: String(movie.ratingKey),
    title: movie.title || "Sin título",
    year: movie.year || null,
    summary: movie.summary || "",
    duration: movie.duration || null,
    rating: movie.rating ?? null,
    audienceRating: movie.audienceRating ?? null,
    genres: Array.isArray(movie.Genre)
      ? movie.Genre.map(g => g.tag).filter(Boolean)
      : [],
    poster: absolutePlexImage(movie.thumb),
    backdrop: absolutePlexImage(movie.art),
    addedAt: movie.addedAt || null
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    plexConfigured: Boolean(PLEX_URL && PLEX_TOKEN),
    libraryConfigured: Boolean(PLEX_LIBRARY_ID)
  });
});

app.get("/api/libraries", async (req, res) => {
  try {
    const data = await plex("/library/sections");
    const directories = data?.MediaContainer?.Directory || [];

    res.json(directories.map(section => ({
      key: section.key,
      title: section.title,
      type: section.type,
      uuid: section.uuid
    })));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/movies", async (req, res) => {
  if (!PLEX_LIBRARY_ID) {
    return res.status(500).json({
      error: "Configura PLEX_LIBRARY_ID en .env"
    });
  }

  try {
    const data = await plex(
      `/library/sections/${encodeURIComponent(PLEX_LIBRARY_ID)}/all?type=1&sort=titleSort:asc`
    );

    const movies = (data?.MediaContainer?.Metadata || [])
      .filter(item => item.type === "movie")
      .map(normalizeMovie);

    res.json({
      total: movies.length,
      movies
    });
  } catch (error) {
    res.status(502).json({
      error: error.message
    });
  }
});

app.get("/api/movie/:ratingKey", async (req, res) => {
  try {
    const data = await plex(
      `/library/metadata/${encodeURIComponent(req.params.ratingKey)}`
    );

    const movie = data?.MediaContainer?.Metadata?.[0];

    if (!movie) {
      return res.status(404).json({ error: "Película no encontrada" });
    }

    res.json(normalizeMovie(movie));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/trailers/:ratingKey", async (req, res) => {
  try {
    const data = await plex(
      `/library/metadata/${encodeURIComponent(req.params.ratingKey)}/extras`
    );

    const extras = data?.MediaContainer?.Metadata || [];

    const trailers = extras
      .filter(extra =>
        String(extra.extraType) === "1" ||
        String(extra.type).toLowerCase() === "trailer" ||
        String(extra.title || "").toLowerCase().includes("trailer")
      )
      .map(extra => ({
        title: extra.title || "Trailer",
        url: extra.url || extra.key || null,
        thumb: absolutePlexImage(extra.thumb),
        extraType: extra.extraType ?? null,
        key: extra.key || null
      }))
      .filter(extra => extra.url || extra.key);

    res.json({ trailers });
  } catch (error) {
    res.status(502).json({
      error: error.message
    });
  }
});

// Sirve imágenes de Plex desde el backend para que el token nunca aparezca
// en el código JavaScript de GitHub Pages.
app.get("/api/image", async (req, res) => {
  const imagePath = req.query.path;

  if (!imagePath || typeof imagePath !== "string") {
    return res.status(400).send("Falta path");
  }

  // Solo permitimos rutas internas de Plex.
  if (!imagePath.startsWith("/")) {
    return res.status(400).send("Ruta no válida");
  }

  try {
    const response = await fetch(`${PLEX_URL}${imagePath}`, {
      headers: {
        ...plexHeaders,
        Accept: "image/avif,image/webp,image/jpeg,image/png,*/*"
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("No se pudo obtener la imagen");
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "image/jpeg"
    );

    res.setHeader("Cache-Control", "public, max-age=3600");

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(502).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Plex Trailers API funcionando en http://localhost:${PORT}`);
});
