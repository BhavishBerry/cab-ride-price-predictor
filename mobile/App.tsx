import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { LOCATION_COORDS } from './constants/locations';

// Fill in your machine's LAN IP before running the demo (the phone running
// Expo Go can't reach "localhost" on your laptop). Find it with
// `hostname -I` (Linux) or `ipconfig getifaddr en0` (Mac).
const API_BASE_URL = 'http://192.168.1.68:8000';

const POLL_INTERVAL_MS = 10000;
const MAX_RIDES = 50;

type Ride = {
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

function surgeColor(surge: number): string {
  if (surge < 1.2) return '#2e7d32';
  if (surge < 1.8) return '#f9a825';
  return '#c62828';
}

function regionForRoute(source: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  return {
    latitude: (source.latitude + destination.latitude) / 2,
    longitude: (source.longitude + destination.longitude) / 2,
    latitudeDelta: Math.abs(source.latitude - destination.latitude) * 2 + 0.02,
    longitudeDelta: Math.abs(source.longitude - destination.longitude) * 2 + 0.02,
  };
}

function RideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.routeRow}>
        <Text style={styles.routeText}>
          {ride.source} → {ride.destination}
        </Text>
        <View style={[styles.surgeBadge, { backgroundColor: surgeColor(ride.predicted_surge) }]}>
          <Text style={styles.surgeText}>{ride.predicted_surge.toFixed(2)}x</Text>
        </View>
      </View>
      <Text style={styles.subText}>
        {ride.cab_type} · {ride.name} · {ride.distance.toFixed(2)} mi
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>
          Predicted: <Text style={styles.priceValue}>${ride.predicted_price.toFixed(2)}</Text>
        </Text>
        <Text style={styles.priceLabel}>
          Actual: <Text style={styles.priceValue}>${ride.actual_price.toFixed(2)}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function RideDetailSheet({ ride }: { ride: Ride }) {
  const sourceCoord = LOCATION_COORDS[ride.source];
  const destCoord = LOCATION_COORDS[ride.destination];
  const region = useMemo(() => regionForRoute(sourceCoord, destCoord), [sourceCoord, destCoord]);

  return (
    <>
      <MapView style={styles.map} initialRegion={region}>
        <Marker coordinate={sourceCoord} title={ride.source} pinColor="#2e7d32" />
        <Marker coordinate={destCoord} title={ride.destination} pinColor="#c62828" />
        <Polyline coordinates={[sourceCoord, destCoord]} strokeColor="#444" strokeWidth={3} />
      </MapView>
      <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
        <Text style={styles.sheetTitle}>
          {ride.source} → {ride.destination}
        </Text>
        <View style={[styles.surgeBadge, styles.sheetSurgeBadge, { backgroundColor: surgeColor(ride.predicted_surge) }]}>
          <Text style={styles.surgeText}>{ride.predicted_surge.toFixed(2)}x surge</Text>
        </View>

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
      </BottomSheetScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const keyCounter = useRef(0);
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNextRide() {
      try {
        const response = await fetch(`${API_BASE_URL}/next-ride`);
        const ride: Ride = await response.json();
        if (cancelled) return;
        setConnectionError(false);
        keyCounter.current += 1;
        setRides((prev) => [ride, ...prev].slice(0, MAX_RIDES));
      } catch (err) {
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

  const openRide = useCallback((ride: Ride) => {
    setSelectedRide(ride);
    sheetRef.current?.present();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <BottomSheetModalProvider>
        <View style={styles.container}>
          <StatusBar style="auto" />
          <Text style={styles.header}>Live Rides</Text>
          {connectionError && (
            <Text style={styles.errorText}>Can't reach {API_BASE_URL} — check API_BASE_URL and Wi-Fi.</Text>
          )}
          <FlatList
            data={rides}
            keyExtractor={(_, index) => `${keyCounter.current}-${index}`}
            renderItem={({ item }) => <RideCard ride={item} onPress={() => openRide(item)} />}
            contentContainerStyle={styles.list}
          />
        </View>

        <BottomSheetModal ref={sheetRef} snapPoints={['65%', '92%']} index={0}>
          {selectedRide && <RideDetailSheet ride={selectedRide} />}
        </BottomSheetModal>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#c62828',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  surgeBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  surgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  subText: {
    color: '#666',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceLabel: {
    color: '#444',
  },
  priceValue: {
    fontWeight: 'bold',
    color: '#222',
  },
  map: {
    width: '100%',
    height: 220,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sheetSurgeBadge: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    fontWeight: '600',
    color: '#222',
  },
});
