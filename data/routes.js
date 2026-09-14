(function bootstrapRoutesChunks() {
  if (window.__JabilRoutesChunksLoaded) {
    return;
  }
  window.__JabilRoutesChunksLoaded = true;

  const chunks = [
    'data/routes/routes-core.js',
    'data/routes/routes-map-ui.js',
    'data/routes/routes-people-search.js'
  ];

  chunks.forEach((src) => {
    if (document.querySelector(`script[data-jabil-route-chunk="${src}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.jabilRouteChunk = src;
    script.onerror = function () {
      console.error('Failed to load routes chunk:', src);
    };
    document.body.appendChild(script);
  });
})();
