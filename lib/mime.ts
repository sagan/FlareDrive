import { Mime } from "mime";
import standardTypes from "mime/types/standard.js";
import otherTypes from "mime/types/other.js";
import { MIME_URL } from "./commons";

const mime = new Mime(standardTypes, otherTypes);

mime.define({ [MIME_URL]: ["url"] });

export default mime;
