// these variables get assigned in the top of index.html at build time.
declare interface Window {
  __SITENAME__: readonly string;
  __DEV__: readonly boolean;
  /**
   * Public prefix list. Each one in list is guaranteed to be not empty
   * and do not start or end with white space or "/".
   */
  __PUBLIC_PREFIX__: readonly string[];
  /**
   * Public dir prefix list. Each one in list is guaranteed to be not empty
   * and do not start or end with white space or "/".
   */
  __PUBLIC_DIR_PREFIX__: readonly string[];
  /**
   * Public writable dir prefix list. Each one in list is guaranteed to be not empty
   * and do not start or end with white space or "/".
   */
  __PUBLIC_RWDIR_PREFIX__: readonly string[];
}
