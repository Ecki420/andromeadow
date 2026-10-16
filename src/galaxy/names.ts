import { pick, rangeInt } from "./rng.ts";

/**
 * Procedural star and planet names. Original syllable sets; nothing borrowed
 * from any existing game's catalogue. Deterministic given the shared rng.
 */
const ONSETS = ["Ka", "Ve", "Tho", "Mar", "Sel", "Ori", "Dun", "Hal", "Zy", "Pe", "Ra", "Lu", "Qen", "Isa", "Vor", "Ny", "Tal", "Bre", "Osh", "Kir"];
const MIDS = ["ra", "lo", "ni", "va", "the", "ri", "mo", "sa", "de", "ku", "li", "no", "ta", "ve", "xi"];
const CODAS = ["n", "s", "th", "r", "l", "x", "m", "k", "", "", "d", "sh"];
const DESIGNATORS = ["Prime", "Reach", "Verge", "Hollow", "Drift", "Crown", "Gate", "Deep"];
const GREEK = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Kappa", "Sigma", "Tau"];

export function starName(rng: () => number): string {
  const syllables = rangeInt(rng, 1, 2);
  let name = pick(rng, ONSETS);
  for (let i = 0; i < syllables; i++) name += pick(rng, MIDS);
  name += pick(rng, CODAS);
  const style = rng();
  if (style < 0.2) return `${pick(rng, GREEK)} ${name}`;
  if (style < 0.35) return `${name} ${pick(rng, DESIGNATORS)}`;
  return name;
}

/** Rev 1: one planet per system, named after its star with a roman numeral. */
export function planetName(star: string, index: number): string {
  const numerals = ["I", "II", "III", "IV", "V", "VI"];
  return `${star} ${numerals[index] ?? String(index + 1)}`;
}
