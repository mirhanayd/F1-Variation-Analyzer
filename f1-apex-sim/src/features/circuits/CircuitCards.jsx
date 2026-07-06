import { Link } from 'react-router-dom';
import CircuitVisual from './CircuitVisual';

export const CircuitCard = ({ circuit }) => (
  <Link to={`/circuits/${circuit.slug ?? circuit.id}`} className="circuit-card">
    <CircuitVisual circuit={circuit} label={circuit.active ? 'Current calendar' : 'Historic'} />
    <div className="circuit-card-body">
      <span>{circuit.country}</span>
      <h3>{circuit.shortName ?? circuit.name}</h3>
      <p>{circuit.name}</p>
      <div className="circuit-card-meta">
        <span>{circuit.locality || 'Location TBA'}</span>
        <span>{circuit.mapData ? 'Track map' : 'Fallback visual'}</span>
      </div>
    </div>
  </Link>
);

export const CircuitGrid = ({ circuits }) => (
  <div className="circuit-grid">
    {circuits.map((circuit) => (
      <CircuitCard key={circuit.id} circuit={circuit} />
    ))}
  </div>
);
