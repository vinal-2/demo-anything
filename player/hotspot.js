// Pulsing hotspot with an optional tooltip.
// Positions are in pixels inside the stage overlay; the player converts flow fractions to pixels.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createHotspot(overlay, { onActivate }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dp-hs';
  btn.hidden = true;
  btn.innerHTML = '<span class="ring-o" aria-hidden="true"></span><span class="ring-i" aria-hidden="true"></span>';

  const tip = document.createElement('div');
  tip.className = 'dp-tip';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');

  overlay.append(btn, tip);

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    // event.detail is 0 when the button was activated from the keyboard.
    onActivate({ keyboard: event.detail === 0 });
  });

  function placeTip(pos, bounds) {
    // Clear the pulsing outer ring, which grows past the button's edge.
    const reach = btn.offsetWidth / 2 + 12;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let side = 'right';
    let left = pos.x + reach;
    let top = pos.y - th / 2;

    if (left + tw > bounds.w - 8) {
      if (pos.x - reach - tw >= 8) {
        side = 'left';
        left = pos.x - reach - tw;
      } else {
        side = pos.y + reach + th <= bounds.h - 8 ? 'bottom' : 'top';
        left = pos.x - tw / 2;
        top = side === 'bottom' ? pos.y + reach : pos.y - reach - th;
      }
    }
    left = clamp(left, 8, Math.max(8, bounds.w - tw - 8));
    top = clamp(top, 8, Math.max(8, bounds.h - th - 8));

    tip.dataset.side = side;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    const arrow = side === 'left' || side === 'right'
      ? clamp(pos.y - top, 12, th - 12)
      : clamp(pos.x - left, 12, tw - 12);
    tip.style.setProperty('--arrow', `${arrow}px`);
  }

  return {
    el: btn,
    get visible() { return !btn.hidden; },
    show(hotspot, pos, bounds) {
      btn.style.left = `${pos.x}px`;
      btn.style.top = `${pos.y}px`;
      const size = Number(hotspot.size) > 0 ? Number(hotspot.size) : 40;
      btn.style.setProperty('--hs-scale', String(size / 40));
      btn.setAttribute('aria-label', hotspot.label ? hotspot.label : 'Continue');
      btn.hidden = false;
      if (hotspot.label) {
        tip.textContent = hotspot.label;
        tip.hidden = false;
        placeTip(pos, bounds);
      } else {
        tip.hidden = true;
      }
    },
    hide() {
      btn.hidden = true;
      tip.hidden = true;
      btn.classList.remove('nudge');
    },
    nudge() {
      btn.classList.remove('nudge');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('nudge');
    },
  };
}
