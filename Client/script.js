(function () {
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

    attach('year');
    attach('runtime');

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

    // Example: listen for changes to drive queries
    document.getElementById('movieFilter').addEventListener('input', () => {
      // const state = window.getMovieFilterState();
      // fetchMovies(state);
    });
  })();