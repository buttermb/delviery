/**
 * Unit Conversion Utilities
 * Converts between common cannabis weight units
 */

export const gramsToOunces = (grams: number): number => {
  return grams / 28.3495;
};

export const ouncesToGrams = (ounces: number): number => {
  return ounces * 28.3495;
};

export const gramsToPounds = (grams: number): number => {
  return grams / 453.592;
};

export const poundsToGrams = (pounds: number): number => {
  return pounds * 453.592;
};

export const formatWeightWithConversion = (
  grams: number,
  precision = 2
): string => {
  const ounces = gramsToOunces(grams);

  if (grams < 28.35) {
    // Less than 1 oz, show grams only
    return `${grams.toFixed(precision)}g`;
  } else if (grams < 453.59) {
    // Less than 1 lb, show grams and ounces
    return `${grams.toFixed(precision)}g (${ounces.toFixed(precision)}oz)`;
  } else {
    // 1 lb or more, show all three
    const pounds = gramsToPounds(grams);
    return `${grams.toFixed(precision)}g (${ounces.toFixed(precision)}oz / ${pounds.toFixed(precision)}lb)`;
  }
};
