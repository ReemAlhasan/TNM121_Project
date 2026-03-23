const serverUrl = "http://127.0.0.1:3000";

// Tracks the current movie's rating so we can compare on next guess
let currentMovieRating = null;
let score = 0;

//___________________ INITIAL LOADING _________________
document.addEventListener("DOMContentLoaded", function () {
  console.log("HTML DOM tree loaded, and ready for manipulation.");

  markOnStartup();

  //------------ Start Game Button ---------------
  const startBtn = document.getElementById('startGame');
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // Save all toggle settings to localStorage before navigating
      const settings = {
        imageShown:       document.getElementById('imageShown')?.checked ?? true,
        genreShown:       document.getElementById('genreShown')?.checked ?? true,
        certificateShown: document.getElementById('certificateShown')?.checked ?? true,
        directorShown:    document.getElementById('directorShown')?.checked ?? true,
        descriptionShown: document.getElementById('descriptionShown')?.checked ?? true,
        releaseYearShown: document.getElementById('releaseYearShown')?.checked ?? true,
        genre:            document.getElementById('genre')?.value || null,
        certificate:      document.getElementById('certificate')?.value || null,
        yearMin:          Number(document.getElementById('yearMin')?.value) || 1960,
        yearMax:          Number(document.getElementById('yearMax')?.value) || 2026,
        runtimeMin:       Number(document.getElementById('runtimeMin')?.value) || 0,
        runtimeMax:       Number(document.getElementById('runtimeMax')?.value) || 500,
      };

      localStorage.setItem('gameSettings', JSON.stringify(settings));
      console.log("Settings saved to localStorage:", settings);
      window.location.href = 'gamePage.html';
    });
  }

  //------------ Initialize game page ---------------
  const gamePageContainer = document.getElementsByClassName('gamePageContainer')[0];
  if (gamePageContainer) {
    console.log("Game page container found, initializing game page.");
    applySettings();
    startGame();
  }

  //------------ Higher / Lower buttons ---------------
  const higherButton = document.getElementById('higher');
  const lowerButton  = document.getElementById('lower');

  if (higherButton) {
    higherButton.addEventListener('click', (e) => {
      e.preventDefault();
      calculateScore("higher");
    });
  }
  if (lowerButton) {
    lowerButton.addEventListener('click', (e) => {
      e.preventDefault();
      calculateScore("lower");
    });
  }
});


//___________________ APPLY SETTINGS ON GAME PAGE ___________________
function applySettings() {
  const raw = localStorage.getItem('gameSettings');
  if (!raw) {
    console.log("No settings found in localStorage, using defaults (all shown).");
    return;
  }

  const settings = JSON.parse(raw);
  console.log("Applying settings:", settings);

  function setVisible(elementId, isVisible) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = isVisible ? '' : 'none';
  }

  setVisible('pMoviePicture',     settings.imageShown);
  setVisible('cMoviePicture',     settings.imageShown);

  setVisible('pMovieGenre',       settings.genreShown);
  setVisible('cMovieGenre',       settings.genreShown);

  setVisible('pMovieCertificate', settings.certificateShown);
  setVisible('cMovieCertificate', settings.certificateShown);

  setVisible('pMovieDirector',    settings.directorShown);
  setVisible('cMovieDirector',    settings.directorShown);

  setVisible('pMovieDescription', settings.descriptionShown);
  setVisible('cMovieDescription', settings.descriptionShown);

  setVisible('pMovieReleaseYear', settings.releaseYearShown);
  setVisible('cMovieReleaseYear', settings.releaseYearShown);
}


//___________________ MARK ON STARTUP ___________________
function markOnStartup() {
  const settingsCheckboxes = [
    'imageShown', 'genreShown', 'certificateShown',
    'directorShown', 'descriptionShown', 'releaseYearShown'
  ];
  settingsCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) checkbox.checked = true;
  });

  const GAPS = { year: 0, runtime: 0 };
  const els = {
    year: {
      min: document.getElementById('yearMin'),
      max: document.getElementById('yearMax'),
      out: document.getElementById('yearRangeValue'),
      hl:  document.getElementById('yearHighlight'),
      box: document.querySelector('.dual-range[data-kind="year"]')
    },
    runtime: {
      min: document.getElementById('runtimeMin'),
      max: document.getElementById('runtimeMax'),
      out: document.getElementById('runtimeRangeValue'),
      hl:  document.getElementById('runtimeHighlight'),
      box: document.querySelector('.dual-range[data-kind="runtime"]')
    }
  };

  if (!els.year.min || !els.runtime.min) return;

  function percent(value, min, max) {
    return ((value - min) / (max - min)) * 100;
  }

  function updateDual(kind, changed) {
    const e = els[kind];
    const minAttr = Number(e.min.min);
    const maxAttr = Number(e.min.max);
    const gap = GAPS[kind] || 0;
    let vMin = Number(e.min.value);
    let vMax = Number(e.max.value);

    if (changed === 'min') {
      if (vMin > vMax - gap) { vMin = vMax - gap; e.min.value = vMin; }
    } else if (changed === 'max') {
      if (vMax < vMin + gap) { vMax = vMin + gap; e.max.value = vMax; }
    } else {
      if (vMin > vMax - gap) { vMin = vMax - gap; e.min.value = vMin; }
      if (vMax < vMin + gap) { vMax = vMin + gap; e.max.value = vMax; }
    }

    const leftPct  = percent(vMin, minAttr, maxAttr);
    const rightPct = percent(vMax, minAttr, maxAttr);
    e.hl.style.left  = leftPct + '%';
    e.hl.style.width = (rightPct - leftPct) + '%';
    e.out.textContent = e.min.value + '\u2013' + e.max.value;
    e.min.setAttribute('aria-valuenow', e.min.value);
    e.max.setAttribute('aria-valuenow', e.max.value);

    if (changed === 'min')      { e.min.style.zIndex = 3; e.max.style.zIndex = 2; }
    else if (changed === 'max') { e.max.style.zIndex = 3; e.min.style.zIndex = 2; }
  }

  function attach(kind) {
    const e = els[kind];
    updateDual(kind);
    const onMin = () => { e.box.classList.add('is-active');    updateDual(kind, 'min'); };
    const onMax = () => { e.box.classList.add('is-active');    updateDual(kind, 'max'); };
    const off   = () => e.box.classList.remove('is-active');
    e.min.addEventListener('input',    onMin);
    e.max.addEventListener('input',    onMax);
    e.min.addEventListener('change',   off);
    e.max.addEventListener('change',   off);
    e.min.addEventListener('pointerup',off);
    e.max.addEventListener('pointerup',off);
    e.min.addEventListener('keyup',    off);
    e.max.addEventListener('keyup',    off);
  }

  attach('year');
  attach('runtime');

  window.getMovieFilterState = function () {
    return {
      genre:          document.getElementById('genre').value || null,
      certificate:    document.getElementById('certificate').value || null,
      releaseYearMin: Number(els.year.min.value),
      releaseYearMax: Number(els.year.max.value),
      runtimeMin:     Number(els.runtime.min.value),
      runtimeMax:     Number(els.runtime.max.value)
    };
  };
}


//____________________ START GAME _______________________
async function startGame() {
  console.log("startGame() called, fetching two random movies...");

  const response = await fetch(serverUrl + '/startGame', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  response.json().then((jsonBody) => {
    console.log("Received two movies from server.");
    let previousMovie = jsonBody[0];
    let currentMovie  = jsonBody[1];

    currentMovieRating = currentMovie.rating;

    document.getElementById("pMovieTitle").textContent       = previousMovie.name;
    document.getElementById("cMovieTitle").textContent       = currentMovie.name;
    document.getElementById("pMoviePicture").src             = serverUrl + "/media/" + previousMovie.normalized_id + ".png";
    document.getElementById("cMoviePicture").src             = serverUrl + "/media/" + currentMovie.normalized_id  + ".png";
    document.getElementById("pMovieRating").textContent      = previousMovie.rating;
    document.getElementById("cMovieRating").textContent      = "???";
    document.getElementById("pMovieReleaseYear").textContent = previousMovie.year;
    document.getElementById("cMovieReleaseYear").textContent = currentMovie.year;
    document.getElementById("pMovieDirector").textContent    = previousMovie.director ? previousMovie.director.join(", ") : "N/A";
    document.getElementById("cMovieDirector").textContent    = currentMovie.director  ? currentMovie.director.join(", ")  : "N/A";
    document.getElementById("pMovieGenre").textContent       = previousMovie.genre    ? previousMovie.genre.join(", ")    : "N/A";
    document.getElementById("cMovieGenre").textContent       = currentMovie.genre     ? currentMovie.genre.join(", ")     : "N/A";
    document.getElementById("pMovieCertificate").textContent = previousMovie.certificate || "N/A";
    document.getElementById("cMovieCertificate").textContent = currentMovie.certificate  || "N/A";
    document.getElementById("pMovieDescription").textContent = previousMovie.description || "N/A";
    document.getElementById("cMovieDescription").textContent = currentMovie.description  || "N/A";

    score = 0;
    document.getElementById("scoreOutput").textContent = score;
  });
}


//____________________ CALCULATE SCORE ____________________
function calculateScore(guess) {
  const previousRating      = parseFloat(document.getElementById("pMovieRating").textContent);
  const actualCurrentRating = currentMovieRating;

  if (actualCurrentRating === null) { return; }

  const isCorrect =
    (guess === "higher" && actualCurrentRating >= previousRating) ||
    (guess === "lower"  && actualCurrentRating <= previousRating);

  if (isCorrect) {
    score++;
    document.getElementById("scoreOutput").textContent = score;
    console.log("Correct! Score:", score);
    getMovieData();
  } else {
    console.log("Wrong! Game over. Final score:", score);
    showGameOver();
  }
}


//____________________ FETCH NEXT MOVIE _______________________
async function getMovieData() {
  const response = await fetch(serverUrl + '/getMovieInfo', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  response.json().then((jsonBody) => {
    let newMovie = jsonBody[0];

    // Slide current movie into previous slot
    document.getElementById("pMovieTitle").textContent       = document.getElementById("cMovieTitle").textContent;
    document.getElementById("pMoviePicture").src             = document.getElementById("cMoviePicture").src;
    document.getElementById("pMovieRating").textContent      = currentMovieRating;
    document.getElementById("pMovieReleaseYear").textContent = document.getElementById("cMovieReleaseYear").textContent;
    document.getElementById("pMovieDirector").textContent    = document.getElementById("cMovieDirector").textContent;
    document.getElementById("pMovieGenre").textContent       = document.getElementById("cMovieGenre").textContent;
    document.getElementById("pMovieCertificate").textContent = document.getElementById("cMovieCertificate").textContent;
    document.getElementById("pMovieDescription").textContent = document.getElementById("cMovieDescription").textContent;

    // Load new current movie
    document.getElementById("cMovieTitle").textContent       = newMovie.name;
    document.getElementById("cMoviePicture").src             = serverUrl + "/media/" + newMovie.normalized_id + ".png";
    document.getElementById("cMovieRating").textContent      = "???";
    document.getElementById("cMovieReleaseYear").textContent = newMovie.year;
    document.getElementById("cMovieDirector").textContent    = newMovie.director ? newMovie.director.join(", ") : "N/A";
    document.getElementById("cMovieGenre").textContent       = newMovie.genre    ? newMovie.genre.join(", ")    : "N/A";
    document.getElementById("cMovieCertificate").textContent = newMovie.certificate || "N/A";
    document.getElementById("cMovieDescription").textContent = newMovie.description || "N/A";

    currentMovieRating = newMovie.rating;
  });
}


//____________________ GAME OVER POPUP ____________________
function showGameOver() {
  document.getElementById("cMovieRating").textContent = currentMovieRating;

  const overlay = document.createElement('div');
  overlay.id = 'gameOverOverlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: flex; justify-content: center;
    align-items: center; z-index: 999;
  `;
  overlay.innerHTML = `
    <div style="
      background: linear-gradient(90deg, #910915 0%, #ff3503 100%);
      border-radius: 20px; padding: 40px; text-align: center;
      color: white; font-family: Arial, sans-serif; max-width: 400px;
    ">
      <h2>Game Over!</h2>
      <p style="font-size: 24px;">You got <strong>${score}</strong> correct!</p>
      <button onclick="restartGame()" style="
        margin: 10px; padding: 12px 24px; border-radius: 20px;
        border: none; background: white; color: red;
        font-size: 18px; font-weight: bold; cursor: pointer;
      ">Play Again</button>
      <button onclick="window.location.href='homePage.html'" style="
        margin: 10px; padding: 12px 24px; border-radius: 20px;
        border: none; background: white; color: red;
        font-size: 18px; font-weight: bold; cursor: pointer;
      ">New Settings</button>
    </div>
  `;
  document.body.appendChild(overlay);
}


//____________________ RESTART GAME ____________________
function restartGame() {
  const overlay = document.getElementById('gameOverOverlay');
  if (overlay) overlay.remove();
  score = 0;
  currentMovieRating = null;
  startGame();
}