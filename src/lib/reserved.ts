// The cube's reserved tokens that Build offers as a value (docs/CUBE_SCHEMA.md, Reserved tokens). Pure, with no imports.
//
// Not recorded and no reference match each say something true of the vehicles they hold (the source gave no value; the reference
// has no row for it), so a visitor may count them, compare them, or keep only them. Beyond the cap is not a fact about any vehicle:
// it is where a cardinality cap puts the values below it, and which values those are moves with the cap's basis. It is not "a model",
// so Build does not offer it as a value to compare or as a condition, and a ranking already gives it no place.
export const BEYOND_CAP = "__OTHER__";

// Whether a value is one Build offers to choose. Every value but the one the cap collapses to.
export const isChoosable = (value: string): boolean => value !== BEYOND_CAP;

// The name of the one line a grid keeps for every value it does not show. The mix chart's remainder has the same words. Here, with the other reserved words, so Build can name it without
// loading the grid.
export const REST_NAME = "All other";
