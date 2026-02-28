/**
 * machineName — human-readable label for a machine type string.
 * Matches the lowercase values stored by MACHINE_TYPES in bluetooth.js.
 */
export function machineName(machine) {
  return machine === 'echo_bike' ? 'Echo Bike' : 'Ski Erg';
}
