const serverUrl = "http://127.0.0.1:3000";

// These two variables keep track of the game state across functions
let currentMovieRating = null; // the hidden rating of the current movie on the right side
let score = 0;                 // the player's current score

// Wait until the whole HTML page is loaded before doing anything
document.addEventListener("DOMContentLoaded", function () {
    console.log("HTML DOM tree loaded, and ready for manipulation.");

    // Set all toggle switches to ON by default and initialize the sliders
    markOnStartup();

    // If we're on the home page, set up the Start Game button
    const startBtn = document.getElementById('startGame');
    if (startBtn) {
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Collect all the user's chosen settings before leaving the page
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

            // Save settings to localStorage so the game page can read them after navigation
            localStorage.setItem('gameSettings', JSON.stringify(settings));
            console.log("Settings saved to localStorage:", settings);

            // Navigate to the game page
            window.location.href = 'gamePage.html';
        });
    }

    // If we're on the game page, apply settings and load the first two movies
    const gamePageContainer = document.getElementsByClassName('gamePageContainer')[0];
    if (gamePageContainer) {
        console.log("Game page container found, initializing game page.");
        applySettings(); // show/hide elements based on the user's toggle settings
        startGame();     // fetch the first two movies from the server
    }

    // Set up the Higher and Lower buttons on the game page
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


// Read the saved settings and show or hide elements on the game page accordingly
function applySettings() {
    const raw = localStorage.getItem('gameSettings');
    if (!raw) {
        // No settings found — just show everything by default
        console.log("No settings found in localStorage, using defaults (all shown).");
        return;
    }

    const settings = JSON.parse(raw);
    console.log("Applying settings:", settings);

    // Helper to quickly show or hide an element by its ID
    function setVisible(elementId, isVisible) {
        const el = document.getElementById(elementId);
        if (el) el.style.display = isVisible ? '' : 'none';
    }

    // Apply each toggle — both the left (previous) and right (current) movie cards
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


// Run this when the home page first loads — checks all toggles and sets up the sliders
function markOnStartup() {
    // Turn all toggle checkboxes on by default
    const settingsCheckboxes = [
        'imageShown', 'genreShown', 'certificateShown',
        'directorShown', 'descriptionShown', 'releaseYearShown'
    ];
    settingsCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });

    // Minimum gap between the two handles (0 means they can touch)
    const GAPS = { year: 0, runtime: 0 };

    // Grab all the slider elements for year and runtime
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

    // If we're not on the home page, the sliders won't exist — just stop here
    if (!els.year.min || !els.runtime.min) return;

    // Convert a value to a percentage position along the slider track
    function percent(value, min, max) {
        return ((value - min) / (max - min)) * 100;
    }

    // Update the visual highlight and label when either handle is moved
    function updateDual(kind, changed) {
        const e = els[kind];
        const minAttr = Number(e.min.min);
        const maxAttr = Number(e.min.max);
        const gap = GAPS[kind] || 0;
        let vMin = Number(e.min.value);
        let vMax = Number(e.max.value);

        // Make sure the handles don't cross each other
        if (changed === 'min') {
            if (vMin > vMax - gap) { vMin = vMax - gap; e.min.value = vMin; }
        } else if (changed === 'max') {
            if (vMax < vMin + gap) { vMax = vMin + gap; e.max.value = vMax; }
        } else {
            if (vMin > vMax - gap) { vMin = vMax - gap; e.min.value = vMin; }
            if (vMax < vMin + gap) { vMax = vMin + gap; e.max.value = vMax; }
        }

        // Move the green highlighted bar between the two handles
        const leftPct  = percent(vMin, minAttr, maxAttr);
        const rightPct = percent(vMax, minAttr, maxAttr);
        e.hl.style.left  = leftPct + '%';
        e.hl.style.width = (rightPct - leftPct) + '%';

        // Update the text label showing the selected range e.g. "1990–2020"
        e.out.textContent = e.min.value + '\u2013' + e.max.value;
        e.min.setAttribute('aria-valuenow', e.min.value);
        e.max.setAttribute('aria-valuenow', e.max.value);

        // Bring the most recently moved handle to the front so it stays draggable
        if (changed === 'min')      { e.min.style.zIndex = 3; e.max.style.zIndex = 2; }
        else if (changed === 'max') { e.max.style.zIndex = 3; e.min.style.zIndex = 2; }
    }

    // Attach input listeners to both handles of a slider
    function attach(kind) {
        const e = els[kind];
        updateDual(kind); // draw the initial state
        const onMin = () => { e.box.classList.add('is-active');    updateDual(kind, 'min'); };
        const onMax = () => { e.box.classList.add('is-active');    updateDual(kind, 'max'); };
        const off   = () => e.box.classList.remove('is-active');
        e.min.addEventListener('input',     onMin);
        e.max.addEventListener('input',     onMax);
        e.min.addEventListener('change',    off);
        e.max.addEventListener('change',    off);
        e.min.addEventListener('pointerup', off);
        e.max.addEventListener('pointerup', off);
        e.min.addEventListener('keyup',     off);
        e.max.addEventListener('keyup',     off);
    }

    attach('year');
    attach('runtime');

    // Expose a function so other parts of the code can read the current filter state
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


// Build a URL query string from the saved settings so the server can filter movies
function buildFilterParams() {
    const raw = localStorage.getItem('gameSettings');
    const settings = raw ? JSON.parse(raw) : {};

    const params = new URLSearchParams();

    // Only add a param if the user actually selected something
    if (settings.genre)       params.append('genre',       settings.genre);
    if (settings.certificate) params.append('certificate', settings.certificate);
    if (settings.yearMin)     params.append('yearMin',     settings.yearMin);
    if (settings.yearMax)     params.append('yearMax',     settings.yearMax);
    if (settings.runtimeMin)  params.append('runtimeMin',  settings.runtimeMin);
    if (settings.runtimeMax)  params.append('runtimeMax',  settings.runtimeMax);

    return params.toString();
}


// Fetch two movies from the server and display them to start a new game
async function startGame() {
    console.log("startGame() called, fetching two random movies...");

    const queryString = buildFilterParams();

    try {
        const response = await fetch(`${serverUrl}/startGame?${queryString}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const jsonBody = await response.json();

        // If the server couldn't find any movies matching the filters, go back to settings
        if (jsonBody.error) {
            console.error("Server error:", jsonBody.error);
            alert("No movies found with these settings. Please try different filters.");
            window.location.href = 'homePage.html';
            return;
        }

        console.log("Received two movies from server.");
        let previousMovie = jsonBody[0]; // shown on the left with its rating visible
        let currentMovie  = jsonBody[1]; // shown on the right with rating hidden as "???"

        // Store the current movie's rating so we can compare it when the user guesses
        currentMovieRating = currentMovie.rating;

        // Fill in all the movie details on the page
        document.getElementById("pMovieTitle").textContent       = previousMovie.name;
        document.getElementById("cMovieTitle").textContent       = currentMovie.name;
        document.getElementById("pMoviePicture").src             = serverUrl + "/media/" + previousMovie.normalized_id + ".png";
        document.getElementById("cMoviePicture").src             = serverUrl + "/media/" + currentMovie.normalized_id  + ".png";
        document.getElementById("pMovieRating").textContent      = previousMovie.rating;
        document.getElementById("cMovieRating").textContent      = "???"; // hidden until the user guesses
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

        // Reset the score at the start of every new game
        score = 0;
        document.getElementById("scoreOutput").textContent = score;

    } catch (error) {
        // This happens if the server is not running at all
        console.error("Failed to load movies:", error);
        alert("Could not connect to the server. Make sure the server is running.");
    }
}


// Check if the player's guess was right and update the score
function calculateScore(guess) {
    const previousRating      = parseFloat(document.getElementById("pMovieRating").textContent);
    const actualCurrentRating = currentMovieRating;

    // Safety check — don't do anything if we don't have a rating to compare
    if (actualCurrentRating === null) { return; }

    // Equal ratings count as correct for both Higher and Lower — the player shouldn't be punished for a tie
    const isCorrect =
        (guess === "higher" && actualCurrentRating >= previousRating) ||
        (guess === "lower"  && actualCurrentRating <= previousRating);

    if (isCorrect) {
        score++;
        document.getElementById("scoreOutput").textContent = score;
        console.log("Correct! Score:", score);
        getMovieData(); // load the next movie
    } else {
        console.log("Wrong! Game over. Final score:", score);
        showGameOver(); // show the game over popup
    }
}


// Fetch the next movie and slide the current one into the previous slot
async function getMovieData() {
    const queryString = buildFilterParams();

    try {
        const response = await fetch(`${serverUrl}/getMovieInfo?${queryString}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const jsonBody = await response.json();

        if (jsonBody.error) {
            console.error("Server error:", jsonBody.error);
            return;
        }

        let newMovie = jsonBody[0];

        // Move the current movie into the previous movie slot before loading the new one
        document.getElementById("pMovieTitle").textContent       = document.getElementById("cMovieTitle").textContent;
        document.getElementById("pMoviePicture").src             = document.getElementById("cMoviePicture").src;
        document.getElementById("pMovieRating").textContent      = currentMovieRating; // now revealed
        document.getElementById("pMovieReleaseYear").textContent = document.getElementById("cMovieReleaseYear").textContent;
        document.getElementById("pMovieDirector").textContent    = document.getElementById("cMovieDirector").textContent;
        document.getElementById("pMovieGenre").textContent       = document.getElementById("cMovieGenre").textContent;
        document.getElementById("pMovieCertificate").textContent = document.getElementById("cMovieCertificate").textContent;
        document.getElementById("pMovieDescription").textContent = document.getElementById("cMovieDescription").textContent;

        // Load the new movie into the current (right) slot
        document.getElementById("cMovieTitle").textContent       = newMovie.name;
        document.getElementById("cMoviePicture").src             = serverUrl + "/media/" + newMovie.normalized_id + ".png";
        document.getElementById("cMovieRating").textContent      = "???"; // hide the rating again
        document.getElementById("cMovieReleaseYear").textContent = newMovie.year;
        document.getElementById("cMovieDirector").textContent    = newMovie.director ? newMovie.director.join(", ") : "N/A";
        document.getElementById("cMovieGenre").textContent       = newMovie.genre    ? newMovie.genre.join(", ")    : "N/A";
        document.getElementById("cMovieCertificate").textContent = newMovie.certificate || "N/A";
        document.getElementById("cMovieDescription").textContent = newMovie.description || "N/A";

        // Update the stored rating for the next comparison
        currentMovieRating = newMovie.rating;

    } catch (error) {
        console.error("Failed to fetch next movie:", error);
    }
}


// Show the game over popup with the final score and options to play again
function showGameOver() {
    // Reveal the hidden rating of the last movie so the player can see why they lost
    document.getElementById("cMovieRating").textContent = currentMovieRating;

    // Create a dark overlay that covers the whole screen
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


// Remove the game over popup and start a fresh game with the same settings
function restartGame() {
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.remove();
    score = 0;
    currentMovieRating = null;
    startGame();
}


// Toggle high contrast mode on/off by adding/removing a CSS class on the body
function toggleHighContrast() {
    document.body.classList.toggle("high-contrast");                        // Toggle the CSS

    const isOn = document.body.classList.contains("high-contrast");         // Check if the class is currently applied
    localStorage.setItem("highContrast", isOn);                             // Save settingg to lcoal storage
    console.log("High contrast mode toggled. Now:", isOn ? "ON" : "OFF");   // Log the new state to the console for debugging
}

  window.addEventListener("DOMContentLoaded", () => { // When the page loads, check if high contrast mode was previously enabled
    if (localStorage.getItem("highContrast") === "true") { // If it was, add the class to enable high contrast mode
      document.body.classList.add("high-contrast"); // This will apply the high contrast CSS
    }
  });
