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

// All known FTMS characteristic UUIDs — required in optionalServices for the fallback path
// so Chrome grants access to them even without a service filter.
const FTMS_CHARACTERISTICS = [
  0x2acc, // Fitness Machine Feature
  0x2ad1, // Rower / Ski Erg Data
  0x2ad2, // Indoor Bike Data
  0x2ad3, // Training Status
  0x2ad6, // Supported Resistance Level Range
  0x2ad8, // Supported Power Range
  0x2ad9, // Fitness Machine Control Point
  0x2ada, // Fitness Machine Status
];

// Extracts the short 16-bit UUID string from a full 128-bit BLE UUID string.
// e.g. "00001826-0000-1000-8000-00805f9b34fb" → "0x1826"
function shortUuid(uuid) {
  return '0x' + uuid.slice(4, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// connectToMachine
//
// Opens the browser Bluetooth device picker (requires a user gesture),
// connects to the FTMS service, subscribes to notifications, and returns
// a handle to disconnect when done.
//
// On Linux / Raspberry Pi, Chrome's FTMS service filter sometimes fails
// because the device only includes the service UUID in scan-response data
// rather than the primary advertisement. This function first tries the strict
// filter, then falls back to acceptAllDevices with optionalServices so the
// user can manually select the Rogue machine.
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

  // --- 1. Device picker: strict filter first, fall back to acceptAllDevices ---

  let device;
  try {
    console.log('[bluetooth] Requesting device with strict FTMS service filter (0x1826)…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS_SERVICE] }],
    });
    console.log('[bluetooth] Device selected via strict filter:', device.name);
  } catch (strictErr) {
    console.warn('[bluetooth] Strict FTMS filter failed:', strictErr.message);
    console.log('[bluetooth] Retrying with acceptAllDevices + optionalServices fallback…');

    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [FTMS_SERVICE, ...FTMS_CHARACTERISTICS],
    });
    console.log('[bluetooth] Device selected via fallback picker:', device.name);
  }

  // On Linux/BlueZ, gattserverdisconnected fires within milliseconds of
  // startNotifications() even though the BLE notification channel stays live.
  // We debounce the callback 3 s and only propagate if the link is still gone,
  // so a transient GATT drop doesn't reset the UI mid-session.
  let fullyConnected = false;
  let disconnectTimer = null;
  device.addEventListener('gattserverdisconnected', () => {
    if (!fullyConnected) return;
    disconnectTimer = setTimeout(() => {
      if (!device.gatt.connected) onDisconnect?.();
    }, 3000);
  });

  // --- 2. GATT connection with BlueZ retry loop ---
  //
  // On Linux/BlueZ the GATT server can drop immediately after connect()
  // resolves — before we even call getPrimaryService(). We wait 1 s after
  // connecting, re-connect once if the server dropped in that window, then
  // attempt the full service/characteristic setup. The whole post-connect
  // block retries up to 3 times with 1 s between attempts.

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const MAX_ATTEMPTS = 3;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[bluetooth] GATT connect attempt ${attempt}/${MAX_ATTEMPTS}…`);
      let server = await device.gatt.connect();
      console.log('[bluetooth] GATT connected. Waiting 1 s for BlueZ to stabilise…');

      await sleep(1000);

      // If BlueZ dropped the link during the wait, reconnect once before proceeding.
      if (!server.connected) {
        console.warn('[bluetooth] GATT dropped during stabilisation delay — reconnecting…');
        server = await device.gatt.connect();
        console.log('[bluetooth] GATT reconnected.');
      }

      // NOTE: getPrimaryServices() with no args is intentionally omitted here.
      // On Linux/BlueZ it triggers a full GATT service discovery that the Rogue
      // rejects, silently killing the connection before we can use it.
      const service = await server.getPrimaryService(FTMS_SERVICE);
      console.log('[bluetooth] FTMS service (0x1826) obtained.');

      // Log every characteristic inside the FTMS service.
      try {
        const allChars = await service.getCharacteristics();
        console.log(
          '[bluetooth] Characteristics in FTMS service:',
          allChars.map((c) => shortUuid(c.uuid))
        );
      } catch (charErr) {
        console.warn('[bluetooth] Could not enumerate characteristics:', charErr.message);
      }

      const characteristic = await service.getCharacteristic(charUuid);
      console.log('[bluetooth] Subscribing to characteristic:', shortUuid(characteristic.uuid));

      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const dv = event.target.value;
        const bytes = Array.from({ length: dv.byteLength }, (_, i) =>
          dv.getUint8(i).toString(16).padStart(2, '0')
        ).join(' ');
        console.log('[bluetooth] Raw notification bytes:', bytes);
        try {
          const metrics = parseData(dv);
          console.log('[bluetooth] Parsed metrics:', JSON.stringify(metrics));
          onMetrics(metrics);
        } catch (err) {
          console.warn('[bluetooth] Failed to parse FTMS notification:', err);
        }
      });

      await characteristic.startNotifications();
      console.log('[bluetooth] Notifications started. Ready.');

      fullyConnected = true;
      return {
        deviceName: device.name ?? 'Unknown Device',
        disconnect() {
          clearTimeout(disconnectTimer);
          if (device.gatt.connected) {
            device.gatt.disconnect();
          }
        },
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[bluetooth] Attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_ATTEMPTS) {
        console.log('[bluetooth] Waiting 1 s before next attempt…');
        await sleep(1000);
      }
    }
  }

  throw lastErr;
}
