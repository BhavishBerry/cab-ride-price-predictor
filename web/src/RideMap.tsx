import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import { LOCATION_COORDS } from './locations';

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function RideMap({ source, destination }: { source: string; destination: string }) {
  const sourceCoord = LOCATION_COORDS[source];
  const destCoord = LOCATION_COORDS[destination];
  const points: [number, number][] = [sourceCoord, destCoord];

  return (
    <MapContainer center={sourceCoord} zoom={13} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={sourceCoord} icon={greenIcon} />
      <Marker position={destCoord} icon={redIcon} />
      <Polyline positions={points} color="#444" weight={3} />
      <FitBounds points={points} />
    </MapContainer>
  );
}
