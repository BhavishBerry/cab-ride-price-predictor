export type Ride = {
  source: string;
  destination: string;
  cab_type: string;
  name: string;
  distance: number;
  ride_time: string;
  predicted_surge: number;
  predicted_price: number;
  actual_price: number;
};

export function surgeColor(surge: number): string {
  if (surge < 1.2) return '#2e7d32';
  if (surge < 1.8) return '#f9a825';
  return '#c62828';
}
