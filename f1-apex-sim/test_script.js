import fs from 'fs';
import { normalizeSchedule } from './src/features/schedule/scheduleModel.js';

const data = JSON.parse(fs.readFileSync('test_data.json', 'utf8'));
try {
  const result = normalizeSchedule(data);
  console.log('Success! Rounds:', result.rounds.length);
} catch (err) {
  console.error('Error in normalizeSchedule:', err);
}
