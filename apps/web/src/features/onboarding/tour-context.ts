import { createContext, useContext } from "react";

export interface TourApi {
  /** Start (or restart) the tour from the first step. */
  start: () => void;
  active: boolean;
}

export const TourContext = createContext<TourApi>({
  start: () => {},
  active: false,
});

export function useTour(): TourApi {
  return useContext(TourContext);
}
