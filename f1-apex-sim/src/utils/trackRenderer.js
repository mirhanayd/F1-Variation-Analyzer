/**
 * Canvas Track Renderer
 * Renders F1 track with sectors, car simulation, and camera control
 */

import { SVGPathParser } from './svgPathParser';
import gsap from 'gsap';

export class TrackRenderer {
  constructor(canvas, trackData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trackData = trackData;
    
    // Track properties
    this.trackPoints = [];
    this.sectors = [];
    this.currentSector = null;
    
    // Camera properties
    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
      targetX: 0,
      targetY: 0,
      targetScale: 1
    };

    // Car properties
    this.car = {
      position: 0, // 0-1 along the track
      x: 0,
      y: 0,
      speed: 0,
      rotation: 0
    };

    // Animation
    this.animationFrame = null;
    this.isAnimating = false;

    this.init();
  }

  /**
   * Initialize track from SVG
   */
  async init() {
    try {
      // Fetch SVG file
      const response = await fetch(this.trackData.svgPath);
      const svgText = await response.text();
      
      // Parse SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const pathElement = svgDoc.querySelector('path');
      
      if (!pathElement) {
        console.error('No path element found in SVG');
        return;
      }

      // Get path data
      const pathString = pathElement.getAttribute('d');
      const commands = SVGPathParser.parsePath(pathString);
      
      // Sample points along path
      this.trackPoints = SVGPathParser.samplePath(commands, 2000);
      
      // Divide into sectors
      this.sectors = SVGPathParser.dividePath(this.trackPoints, 3);
      
      // Color sectors
      this.sectors.forEach((sector, i) => {
        sector.color = this.trackData.sectors[i].color;
        sector.label = this.trackData.sectors[i].label;
      });

      // Set initial camera to view full track
      this.fitTrackToView();
      
      // Start render loop
      this.startRenderLoop();
      
      console.log('Track initialized:', {
        points: this.trackPoints.length,
        sectors: this.sectors.length
      });
    } catch (error) {
      console.error('Failed to initialize track:', error);
    }
  }

  /**
   * Fit track to canvas view
   */
  fitTrackToView() {
    const bbox = SVGPathParser.getBoundingBox(this.trackPoints);
    if (!bbox) return;

    // Get actual canvas display size (not pixel size)
    const canvasWidth = this.canvas.offsetWidth || this.canvas.width;
    const canvasHeight = this.canvas.offsetHeight || this.canvas.height;
    
    const padding = 80;
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    
    this.camera.scale = Math.min(scaleX, scaleY) * 0.85;
    this.camera.x = canvasWidth / 2 - (bbox.centerX * this.camera.scale);
    this.camera.y = canvasHeight / 2 - (bbox.centerY * this.camera.scale);
    
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
    this.camera.targetScale = this.camera.scale;
    
    console.log('Track fitted:', {
      canvasSize: { width: canvasWidth, height: canvasHeight },
      bbox,
      camera: this.camera
    });
  }

  /**
   * Zoom to specific sector
   */
  zoomToSector(sectorId) {
    const sector = this.sectors.find(s => s.id === sectorId);
    if (!sector || !sector.boundingBox) return;

    this.currentSector = sector;
    const bbox = sector.boundingBox;
    
    // Get actual canvas display size
    const canvasWidth = this.canvas.offsetWidth || this.canvas.width;
    const canvasHeight = this.canvas.offsetHeight || this.canvas.height;
    
    const padding = 100;

    // Calculate target scale
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    const targetScale = Math.min(scaleX, scaleY) * 0.75;

    // Calculate target position
    const targetX = canvasWidth / 2 - (bbox.centerX * targetScale);
    const targetY = canvasHeight / 2 - (bbox.centerY * targetScale);

    console.log('Zooming to sector:', {
      sectorId,
      bbox,
      targetScale,
      targetX,
      targetY
    });

    // Animate camera with GSAP
    gsap.to(this.camera, {
      targetX,
      targetY,
      targetScale,
      duration: 1.2,
      ease: 'power2.inOut'
    });
  }

  /**
   * Reset zoom to full track view
   */
  resetZoom() {
    this.currentSector = null;
    this.fitTrackToView();
    
    gsap.to(this.camera, {
      targetX: this.camera.x,
      targetY: this.camera.y,
      targetScale: this.camera.scale,
      duration: 1,
      ease: 'power2.inOut'
    });
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const render = () => {
      this.update();
      this.draw();
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Update camera and car position
   */
  update() {
    // Smooth camera transition
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;
    this.camera.scale += (this.camera.targetScale - this.camera.scale) * 0.1;

    // Update car position if animating
    if (this.isAnimating) {
      this.car.position += 0.001; // Adjust speed
      if (this.car.position > 1) this.car.position = 0;

      const pointIndex = Math.floor(this.car.position * (this.trackPoints.length - 1));
      const point = this.trackPoints[pointIndex];
      const nextPoint = this.trackPoints[Math.min(pointIndex + 1, this.trackPoints.length - 1)];

      this.car.x = point.x;
      this.car.y = point.y;
      this.car.rotation = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
    }
  }

  /**
   * Draw track on canvas
   */
  draw() {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply camera transform
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.scale, this.camera.scale);

    // Draw track (sector by sector with colors)
    this.sectors.forEach(sector => {
      ctx.strokeStyle = sector.color;
      ctx.lineWidth = 10 / this.camera.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Add glow effect
      ctx.shadowBlur = 20 / this.camera.scale;
      ctx.shadowColor = sector.color;
      
      ctx.beginPath();
      sector.points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    });

    // Highlight current sector
    if (this.currentSector) {
      ctx.strokeStyle = this.currentSector.color;
      ctx.lineWidth = 15 / this.camera.scale;
      ctx.shadowBlur = 30 / this.camera.scale;
      ctx.shadowColor = this.currentSector.color;
      
      ctx.beginPath();
      this.currentSector.points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw car if animating
    if (this.isAnimating && this.car.x && this.car.y) {
      ctx.save();
      ctx.translate(this.car.x, this.car.y);
      ctx.rotate(this.car.rotation);
      
      // Draw car as triangle
      ctx.fillStyle = '#00E5FF';
      ctx.shadowBlur = 20 / this.camera.scale;
      ctx.shadowColor = '#00E5FF';
      
      const size = 15 / this.camera.scale;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size / 2, size / 2);
      ctx.lineTo(-size / 2, -size / 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }

    // Restore context
    ctx.restore();
  }

  /**
   * Start car animation
   */
  startCarAnimation() {
    this.isAnimating = true;
    this.car.position = 0;
  }

  /**
   * Stop car animation
   */
  stopCarAnimation() {
    this.isAnimating = false;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
