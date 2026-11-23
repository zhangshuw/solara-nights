// Unified keyboard and logical-viewport mouse input manager.

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './config.js';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseX = VIEWPORT_WIDTH * 0.62;
    this.mouseY = VIEWPORT_HEIGHT * 0.48;
    this.mouseDown = false;
    this.mouseJustPressed = false;
    this.anyInteraction = false;

    this._onKeyDown = (e) => {
      const code = e.code;
      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }
      if (!this.keys.has(code)) {
        this.justPressed.add(code);
      }
      this.keys.add(code);
      this.anyInteraction = true;
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };

    this._onMouseMove = (e) => {
      this._updateMouseCoords(e);
    };

    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this._updateMouseCoords(e);
      if (!this.mouseDown) this.mouseJustPressed = true;
      this.mouseDown = true;
      this.anyInteraction = true;
    };

    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = false;
    };

    this._onContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  _updateMouseCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mouseX = ((e.clientX - rect.left) / rect.width) * VIEWPORT_WIDTH;
    this.mouseY = ((e.clientY - rect.top) / rect.height) * VIEWPORT_HEIGHT;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.justPressed.has(code);
  }

  getMoveAxes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  getDriveInputs() {
    const throttle = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) -
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const steer = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const handbrake = this.isDown('Space') || this.isDown('ShiftLeft') || this.isDown('ShiftRight');
    return { throttle, steer, handbrake };
  }

  isSprinting() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  endFrame() {
    this.justPressed.clear();
    this.mouseJustPressed = false;
  }
}
