// The main CF worker file. Used in Worker deployment mode.
// It depends on "./dist_worker/index.js",
// which itself is compiled at build time by "npm run build:worker".
import Worker from "./dist_worker/index.js";
import { ReindexerDO } from "./workers/reindexer-do.js";

export default Worker;
export { ReindexerDO };
