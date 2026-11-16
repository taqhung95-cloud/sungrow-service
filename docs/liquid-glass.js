(() => {
  const segments = document.querySelector('.sg-period-segments');
  if (!segments) return;
  function positionSelection() {
    const selected = segments.querySelector('[aria-pressed="true"]');
    if (!selected) return;
    const bounds = selected.getBoundingClientRect();
    const position = bounds.left - segments.getBoundingClientRect().left - segments.clientLeft;
    segments.style.setProperty('--segment-x', position + 'px');
    segments.style.setProperty('--segment-width', bounds.width + 'px');
  }
  new ResizeObserver(positionSelection).observe(segments);
  new MutationObserver(positionSelection).observe(segments, {
    subtree:true, attributes:true, attributeFilter:['aria-pressed']
  });
  positionSelection();
})();
