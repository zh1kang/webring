/* Arrow shortcuts apply only while a Princeton webring widget has focus. */
(() => {
  if (window.princetonWebringKeys) return;
  window.princetonWebringKeys = true;
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const direction = {ArrowLeft: 'prev', ArrowRight: 'next'}[event.key];
    if (!direction || !(event.target instanceof Element)) return;
    const nav = event.target.closest('[data-princeton-webring]');
    if (!nav || event.target.closest('input, textarea, select, [contenteditable]')) return;
    const link = nav.querySelector(`[data-ring-${direction}]`);
    if (!(link instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    window.location.assign(link.href);
  });
})();
