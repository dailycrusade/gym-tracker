/**
 * bluetooth.js — FTMS (Fitness Machine Service) Web Bluetooth helpers
 *
 * Supports:
 *   - Rogue Echo Bike  → Indoor Bike Data characteristic (0x2AD2)
 *   - Rogue Ski Erg    → Rowing Machine Data characteristic (0x2AD1)
 *
 * Usage:
 *   const conn = await connectToMachine(MACHINE_TYPES.ECHO_BIKE, onMetrics, onDisconnect);
 *   // ...
 *   conn.disconnect();
 */

const FTMS_SERVICE = 0x1826;
const CHAR_INDOOR_BIKE_DATA = 0x2ad2;   // Echo Bike
const CHAR_ROWING_MACHINE_DATA = 0x2ad1; // Ski Erg

export const MACHINE_TYPES = {
  ECHO_BIKE: 'echo_bike',
  SKI_ERG: 'ski_erg',
};

// ---------------------------------------------------------------------------
// Indoor Bike Data (0x2AD2) parser — used for Echo Bike
// Spec: FTMS v1.0, Section 4.9.1
//
// Returned object: { watts, cadence (rpm), distance (m), calories, elapsedTime (s) }
// ---------------------------------------------------------------------------
function parseIndoorBikeData(dataView) {
  const flags = dataView.getUint16(0, true); // little-endian
  let offset = 2;

  const result = {
    watts: null,
    cadence: null,
    distance: null,
    calories: null,
    elapsedTime: null,
  };

  // Bit 0 "More Data" — when 0, Instantaneous Speed field is present
  if ((flags & 0x0001) === 0) offset += 2;  // uint16, 0.01 km/h

  if (flags & 0x0002) offset += 2;          // Average Speed, uint16

  if (flags & 0x0004) {                      // Instantaneous Cadence
    result.cadence = dataView.getUint16(offset, true) * 0.5; // 0.5 rpm resolution
    offset += 2;
  }

  if (flags & 0x0008) offset += 2;          // Average Cadence

  if (flags & 0x0010) {                      // Total Distance, uint24
    result.distance =
      dataView.getUint8(offset) |
      (dataView.getUint8(offset + 1) << 8) |
      (dataView.getUint8(offset + 2) << 16);
    offset += 3;
  }

  if (flags & 0x0020) offset += 2;          // Resistance Level, sint16

  if (flags & 0x0040) {                      // Instantaneous Power
    result.watts = dataView.getInt16(offset, true); // sint16, 1 W resolution
    offset += 2;
  }

  if (flags & 0x0080) offset += 2;          // Average Power

  if (flags & 0x0100) {                      // Expended Energy
    result.calories = dataView.getUint16(offset, true); // Total Energy, kcal
    offset += 5;                             // total(2) + per-hour(2) + per-minute(1)
  }

  if (flags & 0x0200) offset += 1;          // Heart Rate, uint8
  if (flags & 0x0400) offset += 1;          // Metabolic Equivalent, uint8 (0.1 res)

  if (flags & 0x0800) {                      // Elapsed Time
    result.elapsedTime = dataView.getUint16(offset, true); // uint16, seconds
    offset += 2;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Rowing Machine Data (0x2AD1) parser — used for Ski Erg
// Spec: FTMS v1.0, Section 4.8.1
//
// Returned object: { watts, strokeRate (spm), distance (m), calories, elapsedTime (s) }
// ---------------------------------------------------------------------------
function parseRowingMachineData(dataView) {
  const flags = dataView.getUint16(0, true);
  let offset = 2;

  const result = {
    watts: null,
    strokeRate: null,
    distance: null,
    calories: null,
    elapsedTime: null,
  };

  // Bit 0 "More Data" — when 0, Stroke Rate + Stroke Count are present
  if ((flags & 0x0001) === 0) {
    result.strokeRate = dataView.getUint8(offset) * 0.5; // 0.5 spm resolution
    offset += 3;                             // uint8 stroke rate + uint16 stroke count
  }

  if (flags & 0x0002) offset += 1;          // Average Stroke Rate, uint8

  if (flags & 0x0004) {                      // Total Distance, uint24
    result.distance =
      dataView.getUint8(offset) |
      (dataView.getUint8(offset + 1) << 8) |
      (dataView.getUint8(offset + 2) << 16);
    offset += 3;
  }

  if (flags & 0x0008) offset += 2;          // Instantaneous Pace, uint16 (s/500m)
  if (flags & 0x0010) offset += 2;          // Average Pace, uint16

  if (flags & 0x0020) {                      // Instantaneous Power
    result.watts = dataView.getInt16(offset, true); // sint16, 1 W resolution
    offset += 2;
  }

  if (flags & 0x0040) offset += 2;          // Average Power
  if (flags & 0x0080) offset += 2;          // Resistance Level, sint16

  if (flags & 0x0100) {                      // Expended Energy
    result.calories = dataView.getUint16(offset, true); // Total Energy, kcal
    offset += 5;                             // total(2) + per-hour(2) + per-minute(1)
  }

  if (flags & 0x0200) offset += 1;          // Heart Rate
  if (flags & 0x0400) offset += 1;          // Metabolic Equivalent

  if (flags & 0x0800) {                      // Elapsed Time
    result.elapsedTime = dataView.getUint16(offset, true);
    offset += 2;
  }

  return result;
}

// ---------------------------------------------------------------------------
// connectToMachine
//
// Opens the browser Bluetooth device picker (requires a user gesture),
// connects to the FTMS service, subscribes to notifications, and returns
// a handle to disconnect when done.
//
// @param {string}   machineType  - MACHINE_TYPES.ECHO_BIKE | MACHINE_TYPES.SKI_ERG
// @param {function} onMetrics    - Called with a parsed metric object on every notification
// @param {function} onDisconnect - Called when the device disconnects (expected or unexpected)
// @returns {Promise<{ deviceName: string, disconnect: function }>}
// ---------------------------------------------------------------------------
export async function connectToMachine(machineType, onMetrics, onDisconnect) {
  if (!navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not supported. Use Chrome or Edge, and serve over HTTPS (or localhost).'
    );
  }

  const charUuid =
    machineType === MACHINE_TYPES.SKI_ERG
      ? CHAR_ROWING_MACHINE_DATA
      : CHAR_INDOOR_BIKE_DATA;

  const parseData =
    machineType === MACHINE_TYPES.SKI_ERG
      ? parseRowingMachineData
      : parseIndoorBikeData;

  // Show the browser device picker — only FTMS devices appear
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FTMS_SERVICE] }],
  });

  device.addEventListener('gattserverdisconnected', () => {
    onDisconnect?.();
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(FTMS_SERVICE);
  const characteristic = await service.getCharacteristic(charUuid);

  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    try {
      onMetrics(parseData(event.target.value));
    } catch (err) {
      console.warn('[bluetooth] Failed to parse FTMS notification:', err);
    }
  });

  await characteristic.startNotifications();

  return {
    deviceName: device.name ?? 'Unknown Device',
    disconnect() {
      if (device.gatt.connected) {
        device.gatt.disconnect();
      }
    },
  };
}
