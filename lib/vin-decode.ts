export type VinDecodeResult = {
  vin: string;
  fields: Record<string, string>;
  errorText?: string;
};

const VIN_FIELD_LABELS: Record<string, string> = {
  Make: "Make",
  Model: "Model",
  ModelYear: "Year",
  BodyClass: "Body class",
  VehicleType: "Vehicle type",
  DriveType: "Drive type",
  FuelTypePrimary: "Fuel type",
  EngineCylinders: "Engine cylinders",
  DisplacementL: "Engine displacement (L)",
  PlantCountry: "Plant country",
  PlantCity: "Plant city",
  Manufacturer: "Manufacturer",
  Trim: "Trim",
  Doors: "Doors",
  Series: "Series",
  TransmissionStyle: "Transmission",
  GVWR: "GVWR",
  ErrorText: "Notes",
};

const SKIP_VALUES = new Set(["Not Applicable", "null", "undefined"]);

export function normalizeVin(input: string): string | null {
  const vin = input.trim().toUpperCase().replace(/\s+/g, "");

  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return null;

  return vin;
}

export async function decodeVin(input: string): Promise<VinDecodeResult> {
  const vin = normalizeVin(input);

  if (!vin) {
    throw new Error("Enter a valid 11–17 character VIN.");
  }

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );

  if (!res.ok) {
    throw new Error("VIN decode failed");
  }

  const data = (await res.json()) as {
    Results?: Array<Record<string, string>>;
  };

  const raw = data.Results?.[0] ?? {};
  const fields: Record<string, string> = {};

  for (const [key, label] of Object.entries(VIN_FIELD_LABELS)) {
    const value = raw[key]?.trim();

    if (!value || SKIP_VALUES.has(value)) continue;

    fields[label] = value;
  }

  if (Object.keys(fields).length === 0) {
    throw new Error("No vehicle details returned for that VIN.");
  }

  return {
    vin,
    fields,
    errorText: raw.ErrorText?.trim() || undefined,
  };
}
