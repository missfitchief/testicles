/** Fade to the existing paper background without flattening the entire hero. */
export function createDepartureFade(hero, narrow) {
  let cover;
  return {
    setOpacity(value) {
      if (narrow.matches) {
        cover?.remove();
        cover = undefined;
        hero.style.opacity = String(value);
        return;
      }
      if (!cover) {
        cover = hero.ownerDocument.createElement('div');
        cover.className = 'entry-hero-cover';
        cover.setAttribute('aria-hidden', 'true');
        hero.append(cover);
      }
      hero.style.opacity = '1';
      cover.style.opacity = String(1 - value);
    },
    dispose() {
      cover?.remove();
      cover = undefined;
    },
  };
}
