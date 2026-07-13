import gsap from 'gsap';
import { getCircuitBoundingBox, sliceCircuitByProgress } from './circuitGeometry';

const buildSectors = (trackData, geometry) => trackData.sectors.map((sector, index) => {
  const range = sector.pathRange ?? {
    start: index / trackData.sectors.length,
    end: (index + 1) / trackData.sectors.length,
  };
  const points = sliceCircuitByProgress(geometry.points, range.start, range.end);

  return {
    ...sector,
    index,
    points,
    boundingBox: getCircuitBoundingBox(points),
  };
});

export class TrackRenderer {
  constructor(canvas, trackData, geometry) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trackData = trackData;
    this.geometry = geometry;
    this.sectors = buildSectors(trackData, geometry);
    this.currentSectorId = null;
    this.animationFrame = null;
    this.cssSize = { width: 0, height: 0 };
    this.onCameraUpdate = null;
    this.lastNotifiedCamera = null;
    this.handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      } else {
        this.startRenderLoop();
      }
    };

    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
      targetX: 0,
      targetY: 0,
      targetScale: 1,
    };

    this.fitTrackToView();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.startRenderLoop();
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    if (!width || !height) return;

    this.cssSize = { width, height };
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fitTrackToView();
  }

  fitTrackToView() {
    const bbox = this.geometry?.bbox;
    if (!bbox) return;

    const canvasWidth = this.cssSize.width || this.canvas.offsetWidth || this.canvas.width;
    const canvasHeight = this.cssSize.height || this.canvas.offsetHeight || this.canvas.height;
    const padding = Math.min(90, Math.max(36, Math.min(canvasWidth, canvasHeight) * 0.12));
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    const targetScale = Math.min(scaleX, scaleY) * 0.92;

    this.camera.targetScale = targetScale;
    this.camera.targetX = canvasWidth / 2 - bbox.centerX * targetScale;
    this.camera.targetY = canvasHeight / 2 - bbox.centerY * targetScale;

    if (!this.animationFrame) {
      this.camera.scale = this.camera.targetScale;
      this.camera.x = this.camera.targetX;
      this.camera.y = this.camera.targetY;
    }
  }

  zoomToSector(sectorId) {
    const sector = this.sectors.find((item) => item.id === sectorId);
    if (!sector?.boundingBox) return;

    this.currentSectorId = sectorId;
    const bbox = sector.boundingBox;
    const canvasWidth = this.cssSize.width || this.canvas.offsetWidth || this.canvas.width;
    const canvasHeight = this.cssSize.height || this.canvas.offsetHeight || this.canvas.height;
    const padding = Math.min(110, Math.max(44, Math.min(canvasWidth, canvasHeight) * 0.16));
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    const targetScale = Math.min(scaleX, scaleY) * 0.78;

    gsap.to(this.camera, {
      targetX: canvasWidth / 2 - bbox.centerX * targetScale,
      targetY: canvasHeight / 2 - bbox.centerY * targetScale,
      targetScale,
      duration: 0.35,
      ease: 'power2.out',
    });
  }

  resetZoom() {
    this.currentSectorId = null;
    this.fitTrackToView();
  }

  startRenderLoop() {
    if (this.animationFrame || document.visibilityState === 'hidden') return;
    const render = () => {
      this.update();
      this.draw();
      this.animationFrame = window.requestAnimationFrame(render);
    };

    render();
  }

  update() {
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.22;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.22;
    this.camera.scale += (this.camera.targetScale - this.camera.scale) * 0.22;

    const nextCamera = {
      x: this.camera.x,
      y: this.camera.y,
      scale: this.camera.scale,
    };
    const previous = this.lastNotifiedCamera;
    if (
      !previous
      || Math.abs(previous.x - nextCamera.x) > 0.05
      || Math.abs(previous.y - nextCamera.y) > 0.05
      || Math.abs(previous.scale - nextCamera.scale) > 0.0005
    ) {
      this.lastNotifiedCamera = nextCamera;
      this.onCameraUpdate?.(nextCamera);
    }
  }

  drawTrackSegment(points, color, width, glow) {
    if (!points.length) return;

    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width / this.camera.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = glow / this.camera.scale;
    ctx.shadowColor = color;

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  draw() {
    const ctx = this.ctx;
    const width = this.cssSize.width || this.canvas.offsetWidth || this.canvas.width;
    const height = this.cssSize.height || this.canvas.offsetHeight || this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.scale, this.camera.scale);

    this.sectors.forEach((sector) => {
      this.drawTrackSegment(sector.points, sector.color, 10, 18);
    });

    const activeSector = this.sectors.find((sector) => sector.id === this.currentSectorId);
    if (activeSector) {
      this.drawTrackSegment(activeSector.points, activeSector.color, 16, 30);
    }

    ctx.restore();
  }

  destroy() {
    gsap.killTweensOf(this.camera);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
    }
  }
}
