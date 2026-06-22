import { useEffect, useState } from 'react';
import { RideCard } from './RideCard';
import { RideDetailModal } from './RideDetailModal';
import type { Ride } from './types';
import './App.css';

const POLL_INTERVAL_MS = 10000;
const MAX_RIDES = 50;

function App() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNextRide() {
      try {
        const response = await fetch('/api/next-ride');
        const ride: Ride = await response.json();
        if (cancelled) return;
        setConnectionError(false);
        setRides((prev) => [ride, ...prev].slice(0, MAX_RIDES));
      } catch {
        if (!cancelled) setConnectionError(true);
      }
    }

    fetchNextRide();
    const interval = setInterval(fetchNextRide, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="page">
      <h1 className="header">Live Rides</h1>
      {connectionError && <p className="error-text">Can't reach the API — check the backend is running.</p>}
      <div className="feed">
        {rides.map((ride, index) => (
          <RideCard key={`${index}-${ride.ride_time}`} ride={ride} onClick={() => setSelectedRide(ride)} />
        ))}
      </div>
      {selectedRide && <RideDetailModal ride={selectedRide} onClose={() => setSelectedRide(null)} />}
    </div>
  );
}

export default App;
