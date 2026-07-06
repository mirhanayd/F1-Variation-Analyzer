import { Link } from 'react-router-dom';
import CircuitVisual from './CircuitVisual';

export const CircuitCard = ({ circuit }) => (
  <Link to={`/circuits/${circuit.slug ?? circuit.id}`} className="circuit-card">
    <CircuitVisual
      circuit={circuit}
      label={circuit.active ? `${new Date().getUTCFullYear()} calendar` : 'Historic'}
    />
    <div className="circuit-card-body">
      <span className="circuit-card-country">{circuit.country}</span>
      <h3>{circuit.shortName ?? circuit.name}</h3>
      <p>{circuit.name}</p>
      <div className="circuit-card-meta">
        {circuit.locality && <span>{circuit.locality}</span>}
        {circuit.stats?.length && <span>{circuit.stats.length}</span>}
        {circuit.stats?.corners && <span>{circuit.stats.corners} corners</span>}
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
