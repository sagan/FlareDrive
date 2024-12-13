import React, { SyntheticEvent, useState } from "react";
import { Box, Breadcrumbs, Button, Link, Typography, ClickAwayListener, IconButton, Tooltip } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import PublicIcon from '@mui/icons-material/Public';
import { Permission, key2Path } from "../lib/commons";
import { PreventDefaultEventCb } from "./commons";

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
}

export function PathBreadcrumb({ permission, path, onCwdChange }: {
  permission: Permission;
  path: string;
  onCwdChange: (newCwd: string) => void
}) {
  const parts = path ? path.replace(/\/$/, "").split("/") : [];

  let cwdHref = "/" + key2Path(path)
  if (!cwdHref.endsWith("/")) {
    cwdHref += "/"
  }

  return (
    <Breadcrumbs separator="›" sx={{ padding: 1 }}>
      <Button
        onClick={() => onCwdChange("")}
        sx={{
          minWidth: 0,
          padding: 0,
        }}
      >
        <HomeIcon />
      </Button>
      {parts.map((part, index) =>
        index === parts.length - 1 ? (
          <Typography key={index} color="text.primary">
            {part}
          </Typography>
        ) : (
          <Link
            key={index}
            component="button"
            onClick={() => {
              onCwdChange(parts.slice(0, index + 1).join("/") + "/");
            }}
          >
            {part}
          </Link>
        )
      )}
      {permission !== Permission.RequireAuth && <Button sx={{
        minWidth: 0,
        padding: 0,
      }}
        title={
          permission === Permission.OpenDir
            ? "Public Dir Permalink: this dir can be publicly accessed (read)"
            : "Files inside this dir can be publicly accessed (read), but dir browsing is not available"
        }
        {...(permission === Permission.OpenDir ? {
          href: cwdHref,
          onClick: PreventDefaultEventCb,
        } : {})}>
        <PublicIcon color={permission == Permission.OpenDir ? "inherit" : "disabled"} />
      </Button>}
    </Breadcrumbs>
  );
}

export function CopyButton({ disabled, isIcon, get, text, children, ...others }: {
  disabled?: boolean;
  isIcon?: boolean;
  children?: any;
  text: string | (() => string);
  [key: string]: any;
  href?: string;
}) {
  const [open, setOpen] = useState(false);

  const onClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  const isDisabled = disabled !== undefined ? disabled : !text

  const onCopy = React.useCallback((e: SyntheticEvent) => {
    e.preventDefault();
    const txt = typeof text == "function" ? text() : text
    if (txt) {
      navigator.clipboard.writeText(txt)
      setOpen(true)
    }
  }, [text]);

  return <ClickAwayListener onClickAway={onClose}>
    <Tooltip
      PopperProps={{
        disablePortal: true,
      }}
      onClose={onClose}
      open={open}
      disableFocusListener
      disableHoverListener
      disableTouchListener
      title="Copied"
    >
      {
        isIcon ? <IconButton disabled={isDisabled} onClick={onCopy} {...others}>{children || "Copy"}</IconButton> :
          <Button disabled={isDisabled} onClick={onCopy} {...others}>{children || "Copy"}</Button>
      }
    </Tooltip>
  </ClickAwayListener>
}