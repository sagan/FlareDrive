import { SyntheticEvent } from "react";

export const PreventDefaultEventCb: React.EventHandler<SyntheticEvent> = function (e) {
  e.preventDefault();
};

export const LOCAL_STORAGE_KEY_AUTH = "auth";
