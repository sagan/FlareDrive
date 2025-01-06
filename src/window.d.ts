// these variables get assigned in the top of index.html at build time.
declare interface Window {
  __SITENAME__: string;
  __DEV__: boolean;
  /**
   * Public prefix list. Each one in list is guaranteed to be not empty
   * and do not start or end with white space or "/".
   */
  __PUBLIC_PREFIX__: string[];
  /**
   * Public dir prefix list. Each one in list is guaranteed to be not empty
   * and do not start or end with white space or "/".
   */
  __PUBLIC_DIR_PREFIX__: string[];
}
