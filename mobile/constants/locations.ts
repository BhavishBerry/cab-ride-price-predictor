// The dataset only has 12 fixed Boston pickup/dropoff zone names, no lat/lng.
// These are approximate neighborhood centers, just for plotting on the map.
export const LOCATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Back Bay': { latitude: 42.3503, longitude: -71.081 },
  'Beacon Hill': { latitude: 42.3588, longitude: -71.0707 },
  'Boston University': { latitude: 42.3505, longitude: -71.1054 },
  Fenway: { latitude: 42.3467, longitude: -71.0972 },
  'Financial District': { latitude: 42.3559, longitude: -71.055 },
  'Haymarket Square': { latitude: 42.3634, longitude: -71.0586 },
  'North End': { latitude: 42.3647, longitude: -71.0542 },
  'North Station': { latitude: 42.3661, longitude: -71.0631 },
  'Northeastern University': { latitude: 42.3398, longitude: -71.0892 },
  'South Station': { latitude: 42.3519, longitude: -71.0552 },
  'Theatre District': { latitude: 42.3519, longitude: -71.0643 },
  'West End': { latitude: 42.3644, longitude: -71.0661 },
};
