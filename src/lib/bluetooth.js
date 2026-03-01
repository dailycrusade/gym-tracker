/**
 * bluetooth.js — Web Bluetooth helpers for FTMS machines and HR monitors
 *
 * Supports:
 *   - Rogue Echo Bike  → Indoor Bike Data characteristic (0x2AD2)
 *   - Rogue Ski Erg    → Rowing Machine Data characteristic (0x2AD1)
 *   - Heart Rate monitors → Heart Rate Measurement characteristic (0x2A37)
 *
 * Usage:
 *   const conn = await connectToMachine(MACHINE_TYPES.ECHO_BIKE, onMetrics, onDisconnect, onReconnecting);
 *   const conn = await reconnectToMachine(MACHINE_TYPES.ECHO_BIKE, ...); // no picker, uses getDevices()
 *   const conn = await connectToHRMonitor(onHeartRate, onDisconnect, onReconnecting);
 *   conn.disconnect();
 */

const FTMS_SERVICE = 0x1826;
const CHAR_INDOOR_BIKE_DATA = 0x2ad2;   // Echo Bike
const CHAR_ROWING_MACHINE_DATA = 0x2ad1; // Ski Erg

const HR_SERVICE = 0x180d;
const CHAR_HR_MEASUREMENT = 0x2a37;

export const MACHINE_TYPES = {
  ECHO_BIKE: 'echo_bike',
  SKI_ERG: 'ski_erg',
};

export const DEVICE_TYPES = {
  ...MACHINE_TYPES,
  HR_MONITOR: 'hr_monitor',
};

// ---------------------------------------------------------------------------
// Indoor Bike Data (0x2AD2) parser — used for Echo Bike
// Spec: FTMS v1.0, Section 4.9.1
// ---------------------------------------------------------------------------
function parseIndoorBikeData(dataView) {
  const flags = dataView.getUint16(0, true);
  let offset = 2;

  const result = { watts: null, cadence: null, distance: null, calories: null, elapsedTime: null };

  if ((flags & 0x0001) === 0) offset += 2;  // Instantaneous Speed
  if (flags & 0x0002) offset += 2;          // Average Speed
  if (flags & 0x0004) {                      // Instantaneous Cadence
    result.cadence = dataView.getUint16(offset, true) * 0.5;
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
  if (flags & 0x0020) offset += 2;          // Resistance Level
  if (flags & 0x0040) {                      // Instantaneous Power
    result.watts = dataView.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x0080) offset += 2;          // Average Power
  if (flags & 0x0100) {                      // Expended Energy
    result.calories = dataView.getUint16(offset, true);
    offset += 5;
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
// Rowing Machine Data (0x2AD1) parser — used for Ski Erg
// Spec: FTMS v1.0, Section 4.8.1
// ---------------------------------------------------------------------------
function parseRowingMachineData(dataView) {
  const flags = dataView.getUint16(0, true);
  let offset = 2;

  const result = { watts: null, strokeRate: null, distance: null, calories: null, elapsedTime: null };

  if ((flags & 0x0001) === 0) {
    result.strokeRate = dataView.getUint8(offset) * 0.5;
    offset += 3;
  }
  if (flags & 0x0002) offset += 1;          // Average Stroke Rate
  if (flags & 0x0004) {                      // Total Distance, uint24
    result.distance =
      dataView.getUint8(offset) |
      (dataView.getUint8(offset + 1) << 8) |
      (dataView.getUint8(offset + 2) << 16);
    offset += 3;
  }
  if (flags & 0x0008) offset += 2;          // Instantaneous Pace
  if (flags & 0x0010) offset += 2;          // Average Pace
  if (flags & 0x0020) {                      // Instantaneous Power
    result.watts = dataView.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x0040) offset += 2;          // Average Power
  if (flags & 0x0080) offset += 2;          // Resistance Level
  if (flags & 0x0100) {                      // Expended Energy
    result.calories = dataView.getUint16(offset, true);
    offset += 5;
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
// Heart Rate Measurement (0x2A37) parser
// BLE HR spec: flags byte bit 0 = 0 → uint8 HR, bit 0 = 1 → uint16 HR (LE)
// ---------------------------------------------------------------------------
function parseHRMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  return (flags & 0x01)
    ? dataView.getUint16(1, true)
    : dataView.getUint8(1);
}

// All known FTMS characteristic UUIDs — needed in optionalServices for the
// fallback picker so Chrome grants access without a service filter.
const FTMS_CHARACTERISTICS = [
  0x2acc, 0x2ad1, 0x2ad2, 0x2ad3, 0x2ad6, 0x2ad8, 0x2ad9, 0x2ada,
];

function shortUuid(uuid) {
  return '0x' + uuid.slice(4, 8).toUpperCase();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// _connectWithDevice  (internal)
//
// Shared GATT connection logic used by connectToMachine and reconnectToMachine.
// Takes an already-selected BluetoothDevice and drives the full setup:
//   subscribe → reconnect-on-disconnect loop → return handle.
//
// opts.maxAttempts       — GATT connect attempts (default 3)
// opts.stabilizationDelay — ms to wait after connect() resolves (default 2000)
//   Lower values make reconnectToMachine faster at the cost of BlueZ stability.
// ---------------------------------------------------------------------------
async function _connectWithDevice(device, machineType, onMetrics, onDisconnect, onReconnecting, opts = {}) {
  const {
    maxAttempts = 3,
    stabilizationDelay = 2000,
  } = opts;

  const charUuid =
    machineType === MACHINE_TYPES.SKI_ERG ? CHAR_ROWING_MACHINE_DATA : CHAR_INDOOR_BIKE_DATA;
  const parseData =
    machineType === MACHINE_TYPES.SKI_ERG ? parseRowingMachineData : parseIndoorBikeData;

  function handleNotification(event) {
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
  }

  async function subscribeToCharacteristic(service) {
    const char = await service.getCharacteristic(charUuid);
    char.addEventListener('characteristicvaluechanged', handleNotification);
    console.log('[bluetooth] Subscribing to characteristic:', shortUuid(char.uuid));
    try {
      await char.startNotifications();
    } catch (notifyErr) {
      console.warn('[bluetooth] startNotifications() failed, retrying in 1 s…', notifyErr.message);
      await sleep(1000);
      await char.startNotifications();
    }
    console.log('[bluetooth] Notifications started.');
  }

  let fullyConnected = false;
  let disconnectTimer = null;

  async function attemptSilentReconnect() {
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[bluetooth] Silent reconnect attempt ${i}/3…`);
        const server = await device.gatt.connect();
        await sleep(1000);
        if (!server.connected) throw new Error('GATT dropped immediately after reconnect');
        const service = await server.getPrimaryService(FTMS_SERVICE);
        await subscribeToCharacteristic(service);
        console.log('[bluetooth] Silent reconnect successful.');
        return true;
      } catch (err) {
        console.warn(`[bluetooth] Silent reconnect ${i}/3 failed:`, err.message);
        if (i < 3) await sleep(1000);
      }
    }
    return false;
  }

  function onGattDisconnected() {
    if (!fullyConnected) return;
    clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(async () => {
      if (device.gatt.connected) return;
      console.log('[bluetooth] Still disconnected after 5 s — attempting silent reconnect…');
      onReconnecting?.();
      const reconnected = await attemptSilentReconnect();
      if (!reconnected) {
        console.warn('[bluetooth] All reconnect attempts failed — returning to connect screen.');
        fullyConnected = false;
        onDisconnect?.();
      }
    }, 5000);
  }

  device.addEventListener('gattserverdisconnected', onGattDisconnected);

  // GATT connection with BlueZ retry loop
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[bluetooth] GATT connect attempt ${attempt}/${maxAttempts}…`);
      let server = await device.gatt.connect();
      console.log(`[bluetooth] GATT connected. Waiting ${stabilizationDelay} ms for BlueZ to stabilise…`);

      await sleep(stabilizationDelay);

      if (!server.connected) {
        console.warn('[bluetooth] GATT dropped during stabilisation delay — reconnecting…');
        server = await device.gatt.connect();
      }

      // NOTE: getPrimaryServices() with no args is intentionally avoided here.
      // On Linux/BlueZ it triggers a full GATT discovery that the Rogue rejects.
      const service = await server.getPrimaryService(FTMS_SERVICE);
      console.log('[bluetooth] FTMS service (0x1826) obtained.');

      await sleep(500);

      try {
        const allChars = await service.getCharacteristics();
        console.log('[bluetooth] Characteristics:', allChars.map((c) => shortUuid(c.uuid)));
      } catch (charErr) {
        console.warn('[bluetooth] Could not enumerate characteristics:', charErr.message);
      }

      await sleep(500);

      await subscribeToCharacteristic(service);

      fullyConnected = true;
      return {
        deviceName: device.name ?? 'Unknown Device',
        disconnect() {
          clearTimeout(disconnectTimer);
          fullyConnected = false;
          device.removeEventListener('gattserverdisconnected', onGattDisconnected);
          if (device.gatt.connected) device.gatt.disconnect();
        },
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[bluetooth] Attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        console.log('[bluetooth] Waiting 1 s before next attempt…');
        await sleep(1000);
      }
    }
  }

  // All attempts failed — clean up the listener we added
  device.removeEventListener('gattserverdisconnected', onGattDisconnected);
  throw lastErr;
}

// ---------------------------------------------------------------------------
// connectToMachine  (public)
//
// Opens the browser Bluetooth device picker (requires a user gesture),
// then delegates to _connectWithDevice.
//
// On Linux/Raspberry Pi the strict FTMS service filter sometimes fails because
// the device only includes the UUID in scan-response data.  The function first
// tries the strict filter, then falls back to acceptAllDevices.
// ---------------------------------------------------------------------------
export async function connectToMachine(machineType, onMetrics, onDisconnect, onReconnecting) {
  if (!navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not supported. Use Chrome or Edge, and serve over HTTPS (or localhost).'
    );
  }

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

  return _connectWithDevice(device, machineType, onMetrics, onDisconnect, onReconnecting);
}

// ---------------------------------------------------------------------------
// reconnectToMachine  (public)
//
// Attempts to reconnect to a previously authorised Bluetooth device without
// opening the picker.  Uses navigator.bluetooth.getDevices() — which returns
// devices the browser has already granted permission for — and tries each one
// in turn with a single connection attempt and a shorter stabilisation delay.
//
// Throws if getDevices() is unsupported, no devices are found, or every
// candidate fails.  Callers should fall back to connectToMachine on error.
// ---------------------------------------------------------------------------
export async function reconnectToMachine(machineType, onMetrics, onDisconnect, onReconnecting) {
  if (!navigator.bluetooth?.getDevices) {
    throw new Error('navigator.bluetooth.getDevices() is not supported in this browser.');
  }

  const devices = await navigator.bluetooth.getDevices();
  console.log(`[bluetooth/reconnect] ${devices.length} previously authorised device(s) found.`);

  if (devices.length === 0) {
    throw new Error('No previously authorised Bluetooth devices found.');
  }

  for (const device of devices) {
    try {
      console.log('[bluetooth/reconnect] Trying device:', device.name);
      return await _connectWithDevice(
        device, machineType, onMetrics, onDisconnect, onReconnecting,
        { maxAttempts: 1, stabilizationDelay: 1000 },
      );
    } catch (err) {
      console.warn('[bluetooth/reconnect] Device failed:', device.name, err.message);
    }
  }

  throw new Error('Could not reconnect to any previously authorised device.');
}

// ---------------------------------------------------------------------------
// connectToHRMonitor  (public)
//
// Opens the picker for a Heart Rate Service (0x180D) device, subscribes to
// Heart Rate Measurement notifications, and returns a disconnect handle.
// Mirrors the reconnect logic used for machine connections.
// ---------------------------------------------------------------------------
export async function connectToHRMonitor(onHeartRate, onDisconnect, onReconnecting) {
  if (!navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not supported. Use Chrome or Edge, and serve over HTTPS (or localhost).'
    );
  }

  let device;
  try {
    console.log('[bluetooth/HR] Requesting device with strict HR service filter (0x180D)…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
    });
    console.log('[bluetooth/HR] Device selected via strict filter:', device.name);
  } catch (strictErr) {
    console.warn('[bluetooth/HR] Strict HR filter failed:', strictErr.message);
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [HR_SERVICE, CHAR_HR_MEASUREMENT],
    });
    console.log('[bluetooth/HR] Device selected via fallback picker:', device.name);
  }

  function handleNotification(event) {
    try {
      const bpm = parseHRMeasurement(event.target.value);
      console.log('[bluetooth/HR] BPM:', bpm);
      onHeartRate(bpm);
    } catch (err) {
      console.warn('[bluetooth/HR] Failed to parse HR measurement:', err);
    }
  }

  async function subscribeToHR(service) {
    const char = await service.getCharacteristic(CHAR_HR_MEASUREMENT);
    char.addEventListener('characteristicvaluechanged', handleNotification);
    try {
      await char.startNotifications();
    } catch (notifyErr) {
      console.warn('[bluetooth/HR] startNotifications() failed, retrying in 1 s…', notifyErr.message);
      await sleep(1000);
      await char.startNotifications();
    }
    console.log('[bluetooth/HR] HR notifications started.');
  }

  let fullyConnected = false;
  let disconnectTimer = null;

  async function attemptSilentReconnect() {
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[bluetooth/HR] Silent reconnect attempt ${i}/3…`);
        const server = await device.gatt.connect();
        await sleep(1000);
        if (!server.connected) throw new Error('GATT dropped immediately');
        const service = await server.getPrimaryService(HR_SERVICE);
        await subscribeToHR(service);
        console.log('[bluetooth/HR] Silent reconnect successful.');
        return true;
      } catch (err) {
        console.warn(`[bluetooth/HR] Silent reconnect ${i}/3 failed:`, err.message);
        if (i < 3) await sleep(1000);
      }
    }
    return false;
  }

  function onGattDisconnected() {
    if (!fullyConnected) return;
    clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(async () => {
      if (device.gatt.connected) return;
      console.log('[bluetooth/HR] Still disconnected after 3 s — attempting silent reconnect…');
      onReconnecting?.();
      const reconnected = await attemptSilentReconnect();
      if (!reconnected) {
        console.warn('[bluetooth/HR] All reconnect attempts failed.');
        fullyConnected = false;
        onDisconnect?.();
      }
    }, 3000);
  }

  device.addEventListener('gattserverdisconnected', onGattDisconnected);

  const MAX_ATTEMPTS = 3;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[bluetooth/HR] GATT connect attempt ${attempt}/${MAX_ATTEMPTS}…`);
      let server = await device.gatt.connect();
      await sleep(1000);
      if (!server.connected) {
        server = await device.gatt.connect();
      }
      const service = await server.getPrimaryService(HR_SERVICE);
      await subscribeToHR(service);
      fullyConnected = true;
      return {
        deviceName: device.name ?? 'HR Monitor',
        disconnect() {
          clearTimeout(disconnectTimer);
          fullyConnected = false;
          device.removeEventListener('gattserverdisconnected', onGattDisconnected);
          if (device.gatt.connected) device.gatt.disconnect();
        },
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[bluetooth/HR] Attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_ATTEMPTS) await sleep(1000);
    }
  }

  device.removeEventListener('gattserverdisconnected', onGattDisconnected);
  throw lastErr;
}
