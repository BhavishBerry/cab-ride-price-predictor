// The dataset only has 12 fixed Boston pickup/dropoff zone names, no lat/lng.
// These are approximate neighborhood centers, just for plotting on the map.
export const LOCATION_COORDS: Record<string, [number, number]> = {
  'Back Bay': [42.3503, -71.081],
  'Beacon Hill': [42.3588, -71.0707],
  'Boston University': [42.3505, -71.1054],
  Fenway: [42.3467, -71.0972],
  'Financial District': [42.3559, -71.055],
  'Haymarket Square': [42.3634, -71.0586],
  'North End': [42.3647, -71.0542],
  'North Station': [42.3661, -71.0631],
  'Northeastern University': [42.3398, -71.0892],
  'South Station': [42.3519, -71.0552],
  'Theatre District': [42.3519, -71.0643],
  'West End': [42.3644, -71.0661],
};
