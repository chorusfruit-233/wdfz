/* Recorder-only steering math. No game state or DOM dependencies. */
'use strict';
const PilotNavigation = (() => {
  function throttle(distance, speed, frameSeconds) {
    // Reserve almost two frames for braking; the game integrates each slow frame
    // as multiple physics steps. A partial joystick avoids full-key overshoot.
    const horizon = Math.max(.12, Math.min(1, frameSeconds || .016) * 1.8);
    return Math.max(.085, Math.min(.9, distance / (speed * horizon)));
  }
  function remaining(position, path, index) {
    let total = 0, previous = position;
    for (let i = index; i < path.length; i++) {
      total += Math.hypot(path[i].x - previous.x, path[i].y - previous.y);
      previous = path[i];
    }
    return total;
  }
  class FrameWindow {
    constructor() { this.samples = []; }
    update(now, seconds) {
      this.samples.push({now, seconds: Math.min(1, seconds || .016)});
      this.samples = this.samples.filter(s => now - s.now <= 2000);
      // A single fast frame must not cancel braking learned from a slow frame.
      return Math.max(...this.samples.map(s => s.seconds));
    }
  }
  class Progress {
    constructor(now, remaining) { this.best = remaining; this.since = now; }
    update(now, remaining) {
      // Sideways motion and returning to an already visited point are NOT progress.
      if (remaining < this.best - .7) { this.best = remaining; this.since = now; }
      return now - this.since > 6000;
    }
  }
  return {throttle, remaining, FrameWindow, Progress};
})();
if (typeof module !== 'undefined') module.exports = PilotNavigation;
