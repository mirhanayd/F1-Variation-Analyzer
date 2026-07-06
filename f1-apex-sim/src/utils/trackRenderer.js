import gsap from 'gsap';
import { getBoundingBox, slicePointsByRange } from './trackGeometry';

const buildSectors = (trackData, geometry) => trackData.sectors.map((sector, index) => {
  const points = slicePointsByRange(geometry.points, sector.pathRange ?? {
    start: index / trackData.sectors.length,
    end: (index + 1) / trackData.sectors.length,
  });

  return {
    ...sector,
    index,
    points,
    boundingBox: getBoundingBox(points),
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

    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
      targetX: 0,
      targetY: 0,
      targetScale: 1,
    };

    this.fitTrackToView();
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

    this.onCameraUpdate?.({
      x: this.camera.x,
      y: this.camera.y,
      scale: this.camera.scale,
    });
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
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
    }
  }
}
