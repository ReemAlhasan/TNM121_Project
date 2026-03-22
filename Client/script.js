const serverUrl = "http://127.0.0.1:3000";

//___________________ INITIAL LOADING _________________
document.addEventListener("DOMContentLoaded", function () {
  console.log("HTML DOM tree loaded, and ready for manipulation.");

  markOnStartup(); // Call the function to mark settings buttons as checked and initialize dual-range sliders


  //------------ Start Game Button ---------------
  // Get the start game button element on the home page
  // Add a click event listener to the button
  // When the button is clicked, navigate to the game page
  const startBtn = document.getElementById('startGame');
  if (startBtn) {
    console.log("Start Game button found, adding click event listener."); // Debug log to confirm button is found
    startBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default button behavior
      console.log("Start Game button clicked, navigating to game page.");
      window.location.href = 'gamePage.html'; // Navigate to the game page
    });
  }

  

  //------------ Initialize game page if someone asks for gamePageContainer  ---------------
  const gamePageContainer = document.getElementsByClassName('gamePageContainer');
  if (gamePageContainer.length > 0) {
    console.log("Game page container found, initializing game page.");
    startGame(); // Start the game by fetching movie data and updating the page
  }

  //------------ Add button functonality ------------------
  const higtherButton = document.getElementById('higher');
  const lowerButton = document.getElementById('lower');

  if (higtherButton) {
    console.log("Higher button found, adding click event listener."); // Debug log to confirm button is found
    higtherButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default button behavior
      console.log("Higher button clicked")
      calculateScore("higher");
    });
  }
  if (lowerButton) {
    console.log("Lower button found, adding click event listener."); // Debug log to confirm button is found
    lowerButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default button behavior
      console.log("Lower button clicked")
      calculateScore("lower");
    });
  }
});


function markOnStartup () {
    // Mark all settings buttons as checked on startup
    const settingsCheckboxes = [
      'imageShown',
      'genreShown',
      'certificateShown',
      'directorShown',
      'descriptionShown',
      'releaseYearShown'
    ];
    
    settingsCheckboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = true;
      }
    });

    // Optional minimum gaps (set to 0 to allow handles to meet)
    const GAPS = {
      year: 0,      // years
      runtime: 0    // minutes
    };

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
        // Initial clamp just in case
        if (vMin > vMax - gap) { vMin = vMax - gap; e.min.value = vMin; }
        if (vMax < vMin + gap) { vMax = vMin + gap; e.max.value = vMax; }
      }

      // Update the highlight bar
      const leftPct = percent(vMin, minAttr, maxAttr);
      const rightPct = percent(vMax, minAttr, maxAttr);
      e.hl.style.left = leftPct + '%';
      e.hl.style.width = (rightPct - leftPct) + '%';

      // Update text output
      e.out.textContent = `${e.min.value}–${e.max.value}`;

      // Accessibility
      e.min.setAttribute('aria-valuenow', e.min.value);
      e.max.setAttribute('aria-valuenow', e.max.value);

      // Ensure the thumb being dragged is above the other when they meet
      if (changed === 'min') {
        e.min.style.zIndex = 3;
        e.max.style.zIndex = 2;
      } else if (changed === 'max') {
        e.max.style.zIndex = 3;
        e.min.style.zIndex = 2;
      }
    }

    function attach(kind) {
      const e = els[kind];

      //för buggar 
      if (!e.min || !e.max || !e.hl || !e.out || !e.box) {
    return; // bara hoppa över
  }

      // initialization
      updateDual(kind);

      // interaction
      const onMin = () => { e.box.classList.add('is-active'); updateDual(kind, 'min'); };
      const onMax = () => { e.box.classList.add('is-active'); updateDual(kind, 'max'); };
      const off = () => e.box.classList.remove('is-active');

      e.min.addEventListener('input', onMin);
      e.max.addEventListener('input', onMax);
      e.min.addEventListener('change', off);
      e.max.addEventListener('change', off);
      e.min.addEventListener('pointerup', off);
      e.max.addEventListener('pointerup', off);
      e.min.addEventListener('keyup', off);
      e.max.addEventListener('keyup', off);
    }

    //--------------filter 
  if (document.getElementById('yearMin')) {
  attach('year');
  attach('runtime');
}

    // Optional: expose current state to parent app
    window.getMovieFilterState = function () {
      return {
        genre: document.getElementById('genreSelect').value || null,
        certificate: document.getElementById('certSelect').value, // 'all' | '7' | '12' | '14' | '18'
        releaseYearMin: Number(els.year.min.value),
        releaseYearMax: Number(els.year.max.value),
        runtimeMin: Number(els.runtime.min.value),
        runtimeMax: Number(els.runtime.max.value)
      };
    };
    
    /*
    // Example: listen for changes to drive queries
    document.getElementById('movieFilter').addEventListener('input', () => {
      // const state = window.getMovieFilterState();
      // fetchMovies(state);
    });
    */

    const movieFilter = document.getElementById('movieFilter');

    if (movieFilter) {
      movieFilter.addEventListener('input', () => {
        // filter logic
      });
}
}

//____________________STATRT GAME _______________________
async function startGame() {

  //------------ Fetch movie data from the server ---------------
  const response = await fetch(serverUrl + '/startGame', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  //----------------- Handle response ------------------------------ 
  response.json().then((jsonBody) => {

    // at this stage, the variable jsonBody holds the final HTTP response's body (in JSON) 
    console.log("The client received a response from the server with JSON data.");

    // Devide josonBody array 
    let firstMovie = jsonBody[0];
    let secondMovie = jsonBody[1];

    let cmovietitle = document.getElementById("cMovieTitle");
    let pmovietitle = document.getElementById("pMovieTitle");

    const cMoviePicture = document.getElementById("cMoviePicture");
    const pMoviePicture = document.getElementById("pMoviePicture");

    cmovietitle.textContent = firstMovie.name;
    pmovietitle.textContent = secondMovie.name;
    // Calling the API endpoint in server and setting the img src code to the response the server gives. 
    cMoviePicture.src = serverUrl + "/media/" + firstMovie.normalized_id + ".png";
    pMoviePicture.src = serverUrl + "/media/" + secondMovie.normalized_id + ".png";
  });
}

//____________________ CALCULATE SCORE____________________
function calculateScore(button) {

  // if the button is higher, 
  // then we will check if the current movie's rating
  // is higher than the previous one. 

  getMovieData();

}

//____________________ FETCH MOVIE DATA _______________________
async function getMovieData() {

  //------------ Fetch movie data from the server ---------------
  const response = await fetch(serverUrl + '/getMovieInfo', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  //----------------- Handle response ------------------------------ 
  response.json().then((jsonBody) => {

    // at this stage, the variable jsonBody holds the final HTTP response's body (in JSON)
    console.log("The client received a response from the server with JSON data.");
    let moviedata = jsonBody[0];
    let cmovietitle = document.getElementById("cMovieTitle");
    let cMoviePicture = document.getElementById("cMoviePicture");
    cmovietitle.textContent = moviedata.name;
    // Calling the API endpoint in server and setting the img src code to the response the server gives. 
    cMoviePicture.src = serverUrl + "/media/" + moviedata.normalized_id + ".png";

  });
}

