const API = (window.PLEX_API_URL || "").replace(/\/+$/, "");

const state = {
  movies: [],
  filtered: [],
  selected: null
};

const $ = selector => document.querySelector(selector);

const elements = {
  search: $("#searchInput"),
  reload: $("#reloadButton"),
  grid: $("#movieGrid"),
  count: $("#movieCount"),
  status: $("#status"),
  heroTitle: $("#heroTitle"),
  heroSummary: $("#heroSummary"),
  heroMeta: $("#heroMeta"),
  heroBackdrop: $("#heroBackdrop"),
  heroTrailer: $("#heroTrailer"),
  modal: $("#modal"),
  modalBackdrop: $("#modalBackdrop"),
  closeModal: $("#closeModal"),
  modalPoster: $("#modalPoster"),
  modalTitle: $("#modalTitle"),
  modalDescription: $("#modalDescription"),
  trailerList: $("#trailerList")
};

function api(path) {
  return `${API}${path}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function imageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  // Cuando las películas vienen del backend, poster/backdrop ya son
  // rutas /api/image relativas. Convertirlas a la API pública.
  if (path.startsWith("/")) return `${API}${path}`;

  return path;
}

async function loadMovies() {
  setStatus("Cargando películas desde Plex...");

  try {
    const response = await fetch(api("/api/movies"));

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    state.movies = data.movies || [];
    state.filtered = [...state.movies];

    elements.count.textContent =
      `${state.movies.length} ${state.movies.length === 1 ? "película" : "películas"}`;

    setStatus(
      state.movies.length
        ? ""
        : "La biblioteca de Plex no contiene películas."
    );

    renderMovies();

    if (state.movies.length) {
      selectMovie(state.movies[0]);
    } else {
      resetHero();
    }
  } catch (error) {
    console.error(error);
    setStatus(`No se pudo conectar con Plex: ${error.message}`, true);
  }
}

function setStatus(text, error = false) {
  elements.status.textContent = text;
  elements.status.classList.toggle("error", error);
  elements.status.style.display = text ? "block" : "none";
}

function renderMovies() {
  if (!state.filtered.length) {
    elements.grid.innerHTML = `
      <div class="status">
        No se encontraron películas con esa búsqueda.
      </div>
    `;
    return;
  }

  elements.grid.innerHTML = state.filtered.map(movie => `
    <article class="movie-card" data-id="${escapeHtml(movie.ratingKey)}">
      <div class="poster-wrap">
        ${
          movie.poster
            ? `<img loading="lazy" src="${escapeHtml(imageUrl(movie.poster))}" alt="${escapeHtml(movie.title)}">`
            : `<div class="poster-placeholder">${escapeHtml(movie.title)}</div>`
        }
        <div class="play-badge">▶</div>
      </div>
      <div class="movie-title">${escapeHtml(movie.title)}</div>
      <div class="movie-year">${movie.year || "Año desconocido"}</div>
    </article>
  `).join("");

  elements.grid.querySelectorAll(".movie-card").forEach(card => {
    card.addEventListener("click", () => {
      const movie = state.movies.find(
        item => item.ratingKey === card.dataset.id
      );
      if (movie) openTrailerModal(movie);
    });
  });
}

function selectMovie(movie) {
  state.selected = movie;

  elements.heroTitle.textContent = movie.title;
  elements.heroSummary.textContent =
    movie.summary || "Sin descripción disponible.";

  elements.heroMeta.innerHTML = "";

  if (movie.year) addMeta(movie.year);
  if (movie.audienceRating) addMeta(`★ ${Number(movie.audienceRating).toFixed(1)}`);
  movie.genres.slice(0, 3).forEach(addMeta);

  elements.heroBackdrop.src = imageUrl(movie.backdrop || movie.poster || "");
  elements.heroBackdrop.alt = movie.title;

  elements.heroTrailer.disabled = false;
  elements.heroTrailer.onclick = () => openTrailerModal(movie);
}

function addMeta(text) {
  const chip = document.createElement("span");
  chip.className = "meta-chip";
  chip.textContent = text;
  elements.heroMeta.appendChild(chip);
}

function resetHero() {
  elements.heroTitle.textContent = "No hay películas";
  elements.heroSummary.textContent = "";
  elements.heroMeta.innerHTML = "";
  elements.heroBackdrop.removeAttribute("src");
  elements.heroTrailer.disabled = true;
}

async function openTrailerModal(movie) {
  elements.modal.classList.remove("hidden");
  elements.modal.setAttribute("aria-hidden", "false");

  elements.modalPoster.src = imageUrl(movie.poster || "");
  elements.modalPoster.alt = movie.title;
  elements.modalTitle.textContent = movie.title;
  elements.modalDescription.textContent =
    movie.summary || "Sin descripción disponible.";

  elements.trailerList.innerHTML = `<div class="status">Buscando trailers en Plex...</div>`;

  try {
    const response = await fetch(
      api(`/api/trailers/${encodeURIComponent(movie.ratingKey)}`)
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudieron obtener los trailers.");
    }

    renderTrailers(data.trailers || []);
  } catch (error) {
    elements.trailerList.innerHTML =
      `<div class="status error">${escapeHtml(error.message)}</div>`;
  }
}

function renderTrailers(trailers) {
  if (!trailers.length) {
    elements.trailerList.innerHTML = `
      <div class="status">
        Esta película no tiene un trailer disponible en Plex.
      </div>
    `;
    return;
  }

  elements.trailerList.innerHTML = trailers.map((trailer, index) => {
    let url = trailer.url || "";

    // Si Plex devuelve una ruta interna en vez de una URL completa,
    // se intenta construir una URL hacia el servidor API.
    if (url.startsWith("/")) {
      url = `${API}${url}`;
    }

    return `
      <div class="trailer-item">
        <span>${escapeHtml(trailer.title || `Trailer ${index + 1}`)}</span>
        ${
          url
            ? `<a class="trailer-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">▶ Abrir</a>`
            : `<span>Sin URL</span>`
        }
      </div>
    `;
  }).join("");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.modal.setAttribute("aria-hidden", "true");
  elements.trailerList.innerHTML = "";
}

elements.search.addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();

  state.filtered = state.movies.filter(movie =>
    movie.title.toLowerCase().includes(query) ||
    String(movie.year || "").includes(query) ||
    movie.genres.some(g => g.toLowerCase().includes(query))
  );

  elements.count.textContent =
    `${state.filtered.length} ${state.filtered.length === 1 ? "película" : "películas"}`;

  renderMovies();
});

elements.reload.addEventListener("click", loadMovies);
elements.closeModal.addEventListener("click", closeModal);
elements.modalBackdrop.addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

if (!API || API.includes("localhost")) {
  console.warn(
    "La página está usando localhost como API. Cambia public/config.js al desplegarla."
  );
}

loadMovies();
