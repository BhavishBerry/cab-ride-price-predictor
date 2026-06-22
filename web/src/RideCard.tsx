import { surgeColor, type Ride } from './types';

export function RideCard({ ride, onClick }: { ride: Ride; onClick: () => void }) {
  return (
    <div className="card" onClick={onClick}>
      <div className="route-row">
        <span className="route-text">
          {ride.source} → {ride.destination}
        </span>
        <span className="surge-badge" style={{ backgroundColor: surgeColor(ride.predicted_surge) }}>
          {ride.predicted_surge.toFixed(2)}x
        </span>
      </div>
      <div className="sub-text">
        {ride.cab_type} · {ride.name} · {ride.distance.toFixed(2)} mi
      </div>
      <div className="price-row">
        <span className="price-label">
          Predicted: <span className="price-value">${ride.predicted_price.toFixed(2)}</span>
        </span>
        <span className="price-label">
          Actual: <span className="price-value">${ride.actual_price.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}
