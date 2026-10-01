export interface RouteStep {
  instruction: string;
  street_name: string;
  distance_meters: number;
  duration_seconds: number;
  maneuver_type: string;
}

export interface RouteGeometryResponse {
  distance_km: number;
  eta_minutes: number;
  route_status: string;
  route_geometry: Array<[number, number]>; // Array of [lat, lng] points following actual roads
  steps?: RouteStep[];
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
}

// In-memory cache to prevent redundant network requests
const routeCache = new Map<string, RouteGeometryResponse>();

function formatManeuver(type: string, modifier?: string, name?: string): string {
  const road = name && name.trim().length > 0 ? `onto ${name}` : 'along roadway';
  switch (type) {
    case 'depart':
      return `Depart station and proceed ${name ? 'on ' + name : 'forward'}`;
    case 'turn':
      return `Turn ${modifier || 'safely'} ${road}`;
    case 'fork':
      return `Take the ${modifier || 'slight'} fork ${road}`;
    case 'merge':
      return `Merge ${modifier || 'into traffic'} ${road}`;
    case 'roundabout':
      return `Enter roundabout and take exit ${road}`;
    case 'arrive':
      return 'Arrive at destination emergency scene';
    case 'new name':
      return `Continue ${road}`;
    default:
      return `Continue ${road}`;
  }
}

// Fallback urban road generator following city street blocks (orthogonal grid)
function generateUrbanGridRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): RouteGeometryResponse {
  const points: Array<[number, number]> = [];
  const midLat = fromLat;
  const midLng = toLng;

  // Segment 1: fromLat, fromLng -> midLat, midLng (horizontal)
  const steps1 = 10;
  for (let i = 0; i <= steps1; i++) {
    const t = i / steps1;
    points.push([fromLat, fromLng + t * (midLng - fromLng)]);
  }
  // Segment 2: midLat, midLng -> toLat, toLng (vertical)
  const steps2 = 10;
  for (let i = 1; i <= steps2; i++) {
    const t = i / steps2;
    points.push([midLat + t * (toLat - midLat), toLng]);
  }

  // Haversine distance with 1.35 urban circuity factor
  const dLat = (toLat - fromLat) * (Math.PI / 180);
  const dLng = (toLng - fromLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat * (Math.PI / 180)) * Math.cos(toLat * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDistKm = 6371 * c;
  const distance_km = Number((rawDistKm * 1.35).toFixed(2));
  // 35 km/h urban emergency response speed
  const eta_minutes = Math.max(1, Math.round((distance_km / 35.0) * 60));

  return {
    distance_km,
    eta_minutes,
    route_status: 'ESTIMATED_ROAD_GRID',
    route_geometry: points,
    steps: [
      { instruction: 'Depart dispatch station with priority siren', street_name: 'Main Arterial', distance_meters: Math.round(distance_km * 400), duration_seconds: 60, maneuver_type: 'depart' },
      { instruction: 'Turn onto cross-corridor towards emergency sector', street_name: 'Connecting Avenue', distance_meters: Math.round(distance_km * 600), duration_seconds: 120, maneuver_type: 'turn' },
      { instruction: 'Arrive at active incident scene', street_name: 'Target Scene', distance_meters: 50, duration_seconds: 20, maneuver_type: 'arrive' }
    ]
  };
}

export async function getRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteGeometryResponse> {
  const cacheKey = `${fromLat.toFixed(5)},${fromLng.toFixed(5)}->${toLat.toFixed(5)},${toLng.toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng.toFixed(5)},${fromLat.toFixed(5)};${toLng.toFixed(5)},${toLat.toFixed(5)}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: Array<[number, number]> = route.geometry.coordinates;
        // Convert OSRM GeoJSON [lng, lat] to Leaflet [lat, lng]
        const route_geometry: Array<[number, number]> = rawCoords.map(([lng, lat]) => [lat, lng]);
        const distance_km = Number((route.distance / 1000.0).toFixed(2));
        const eta_minutes = Math.max(1, Math.round(route.duration / 60.0));

        const leg = route.legs?.[0];
        const steps: RouteStep[] = (leg?.steps || []).map((s: any) => ({
          instruction: formatManeuver(s.maneuver?.type, s.maneuver?.modifier, s.name),
          street_name: s.name || 'Connecting Road',
          distance_meters: Math.round(s.distance || 0),
          duration_seconds: Math.round(s.duration || 0),
          maneuver_type: s.maneuver?.type || 'turn'
        }));

        const result: RouteGeometryResponse = {
          distance_km,
          eta_minutes,
          route_status: 'OK',
          route_geometry,
          steps,
          origin: { lat: fromLat, lng: fromLng },
          destination: { lat: toLat, lng: toLng }
        };

        routeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[Routing] Direct OSRM query failed or timed out, generating urban grid route:', err);
  }

  // Fallback to geometric urban grid route
  const fallback = generateUrbanGridRoute(fromLat, fromLng, toLat, toLng);
  routeCache.set(cacheKey, fallback);
  return fallback;
}
