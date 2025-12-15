/**
 * Data Manager - Caching and fetching F1 data
 * Combines OpenF1 and Ergast APIs
 */

import openF1Api from './openF1Api';
import ergastApi from './ergastApi';

class DataManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get from cache or fetch
   */
  async getOrFetch(key, fetchFunction) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Cache hit: ${key}`);
      return cached.data;
    }

    console.log(`Cache miss: ${key}, fetching...`);
    const data = await fetchFunction();
    
    if (data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }

    return data;
  }

  /**
   * Get complete circuit data package
   * Combines data from both APIs
   */
  async getCircuitData(circuitId, year = 2024) {
    const cacheKey = `circuit_${circuitId}_${year}`;
    
    return this.getOrFetch(cacheKey, async () => {
      try {
        // Fetch from both APIs in parallel
        const [ergastStats, telemetryPackage] = await Promise.all([
          ergastApi.getCircuitStats(circuitId),
          openF1Api.getTelemetryPackage(year, this.mapCircuitName(circuitId), 1)
        ]);

        return {
          circuitId,
          year,
          stats: ergastStats,
          telemetry: telemetryPackage,
          fetchedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error('Failed to fetch circuit data:', error);
        return null;
      }
    });
  }

  /**
   * Get telemetry for specific lap
   */
  async getLapTelemetry(circuitId, year, driverNumber, lapNumber) {
    const cacheKey = `lap_${circuitId}_${year}_${driverNumber}_${lapNumber}`;
    
    return this.getOrFetch(cacheKey, async () => {
      try {
        const telemetryPackage = await openF1Api.getTelemetryPackage(
          year, 
          this.mapCircuitName(circuitId), 
          driverNumber
        );

        if (!telemetryPackage) return null;

        // Filter data for specific lap
        const lap = telemetryPackage.laps.find(l => l.lap_number === lapNumber);
        
        if (!lap) return null;

        // Get position and car data for this lap timeframe
        const lapStart = new Date(lap.date_start).getTime();
        const lapEnd = lapStart + (lap.lap_duration * 1000);

        const carData = telemetryPackage.carData.filter(d => {
          const time = new Date(d.date).getTime();
          return time >= lapStart && time <= lapEnd;
        });

        const positionData = telemetryPackage.positionData.filter(d => {
          const time = new Date(d.date).getTime();
          return time >= lapStart && time <= lapEnd;
        });

        return {
          lap,
          carData,
          positionData,
          lapNumber,
          duration: lap.lap_duration
        };
      } catch (error) {
        console.error('Failed to fetch lap telemetry:', error);
        return null;
      }
    });
  }

  /**
   * Get sector times for analysis
   */
  async getSectorTimes(circuitId, year, driverNumber) {
    const cacheKey = `sectors_${circuitId}_${year}_${driverNumber}`;
    
    return this.getOrFetch(cacheKey, async () => {
      try {
        const telemetryPackage = await openF1Api.getTelemetryPackage(
          year, 
          this.mapCircuitName(circuitId), 
          driverNumber
        );

        if (!telemetryPackage || !telemetryPackage.laps) return null;

        // Extract sector times from all laps
        const sectorData = telemetryPackage.laps.map(lap => ({
          lapNumber: lap.lap_number,
          sector1: lap.duration_sector_1,
          sector2: lap.duration_sector_2,
          sector3: lap.duration_sector_3,
          lapTime: lap.lap_duration,
          isValid: !lap.is_pit_out_lap
        })).filter(lap => lap.isValid);

        return sectorData;
      } catch (error) {
        console.error('Failed to fetch sector times:', error);
        return null;
      }
    });
  }

  /**
   * Map circuit IDs between Ergast and OpenF1
   */
  mapCircuitName(circuitId) {
    const mapping = {
      'monza': 'Monza',
      'silverstone': 'Silverstone',
      'spa': 'Spa-Francorchamps',
      'monaco': 'Monaco',
      'barcelona': 'Barcelona',
      'red_bull_ring': 'Spielberg',
      'suzuka': 'Suzuka',
      'interlagos': 'Interlagos',
      'bahrain': 'Bahrain',
      'jeddah': 'Jeddah'
    };

    return mapping[circuitId] || circuitId;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default new DataManager();
