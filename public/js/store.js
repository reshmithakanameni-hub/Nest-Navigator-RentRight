// Single place for browser state. Listings and shortlist come from the API only.
export const store = {
  allHomes: [],     // every listing, used for lookups, forms and the lease preview
  visible: [],      // listings returned for the current filters
  saved: [],        // shortlist ids for the signed-in user (empty when signed out)
  compareIds: [],   // up to three listing ids selected for comparison
  user: null        // signed-in user returned by /api/auth/me or login
};

export const findHome = id => store.allHomes.find(home => home.id === id);
export const isSignedIn = () => store.user !== null;
