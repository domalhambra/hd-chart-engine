// Ambient declaration for the `ephemeris` package (Moshier theory), which
// ships no types. We only use getAllPlanets; body records are deeply nested and
// loosely shaped, so the observed map is typed as `any` and narrowed at the
// call sites in src/ephemeris/moshier.ts.
declare module 'ephemeris' {
  interface EphemerisResult {
    observed: Record<string, any>
    [key: string]: unknown
  }
  interface Ephemeris {
    getAllPlanets(date: Date, lon: number, lat: number, height: number): EphemerisResult
    getPlanet(body: string, date: Date, lon: number, lat: number, height: number): EphemerisResult
  }
  const ephemeris: Ephemeris
  export default ephemeris
}
