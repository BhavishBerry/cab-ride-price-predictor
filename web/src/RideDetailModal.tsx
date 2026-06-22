import { useEffect } from 'react';
import { RideMap } from './RideMap';
import { surgeColor, type Ride } from './types';

export function RideDetailModal({ ride, onClose }: { ride: Ride; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-map">
          <RideMap source={ride.source} destination={ride.destination} />
        </div>
        <div className="modal-details">
          <h2 className="modal-title">
            {ride.source} → {ride.destination}
          </h2>
          <span
            className="surge-badge modal-surge-badge"
            style={{ backgroundColor: surgeColor(ride.predicted_surge) }}
          >
            {ride.predicted_surge.toFixed(2)}x surge
          </span>

          <DetailRow label="Cab type" value={ride.cab_type} />
          <DetailRow label="Tier" value={ride.name} />
          <DetailRow label="Distance" value={`${ride.distance.toFixed(2)} mi`} />
          <DetailRow label="Ride time" value={new Date(ride.ride_time).toLocaleString()} />
          <DetailRow label="Predicted price" value={`$${ride.predicted_price.toFixed(2)}`} />
          <DetailRow label="Actual price" value={`$${ride.actual_price.toFixed(2)}`} />
          <DetailRow
            label="Model vs actual"
            value={`${ride.predicted_price >= ride.actual_price ? '+' : ''}$${(ride.predicted_price - ride.actual_price).toFixed(2)}`}
          />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
