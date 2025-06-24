// these variables get assigned in the top of index.html at build time.
declare interface Window {
  __SITENAME__: readonly string;
  __JS_URL__: readonly string;
  __CSS_URL__: readonly string;
}
