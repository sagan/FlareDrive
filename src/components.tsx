import React, { FC, SyntheticEvent, useState } from "react";
import { Link as ReactRouterLink } from "react-router-dom";
import {
  Box, Breadcrumbs, Button, LinkProps,
  Link as MuiLink, Typography, ClickAwayListener, IconButton, Tooltip
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import PublicIcon from '@mui/icons-material/Public';
import { EXPIRES_VARIABLE, SCOPE_VARIABLE, Permission, dirUrlPath, fileUrl, str2int } from "../lib/commons";
import { PreventDefaultEventCb, useConfig } from "./commons";

const permissionDescriptions: Record<Permission, string> = {
  [Permission.RequireAuth]: "Private dir: this dir can only be accessed by authorized user",
  [Permission.OpenDir]: "Public Dir Permalink: this dir can be publicly accessed (read)",
  [Permission.OpenFile]: "Files inside this dir can be publicly accessed (read), but dir browsing is not available",
}

export const Link: FC<LinkProps> = props => {
  return (
    <MuiLink {...props} component={ReactRouterLink} to={props.href ?? "#"} />
  );
};

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

export function PathBreadcrumb({ permission, path, setCwd }: {
  permission: Permission;
  path: string;
  setCwd: (newCwd: string) => void
}) {
  const { auth, authSearchParams, expires, fullControl } = useConfig()
  const parts = path ? path.replace(/\/$/, "").split("/") : [];

  const cwdHref = dirUrlPath(path);

  const scope = authSearchParams?.get(SCOPE_VARIABLE) || ""

  return (
    <Breadcrumbs separator="›" sx={{ padding: 1 }}>
      <Button href="/" sx={{ minWidth: 0, padding: 0 }} onClick={(e) => {
        e.preventDefault();
        setCwd("");
      }}>
        <HomeIcon />
      </Button>
      {parts.map((part, index) => {
        const key = parts.slice(0, index + 1).join("/")
        const sx = (scope === key || scope === key + "/") ? { color: "red", fontWeight: "bold" } : undefined
        const url = fileUrl({
          key,
          isDir: true,
          auth,
          expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
          scope: auth ? "" : scope,
          token: auth ? "" : scope,
          fullControl: auth ? undefined : fullControl,
        })
        return index === parts.length - 1 ? (
          <Typography key={index} color="text.primary" sx={sx}>{part}</Typography>
        ) : (
          <Link key={index} href={url} sx={sx} onClick={e => {
            e.preventDefault()
            setCwd(key)
          }}>{part}</Link>
        )
      })}
      {!!path && (permission === Permission.OpenDir || permission === Permission.OpenFile) &&
        <Button sx={{ minWidth: 0, padding: 0 }}
          title={permissionDescriptions[permission]}
          {...(permission === Permission.OpenDir ? {
            href: cwdHref,
            onClick: PreventDefaultEventCb,
          } : {})}>
          <PublicIcon color={permission == Permission.OpenDir ? "inherit" : "disabled"} />
        </Button>
      }
      {!auth && !!authSearchParams?.get(EXPIRES_VARIABLE) && <span>
        ! Expires at {new Date(parseInt(authSearchParams.get(EXPIRES_VARIABLE)!)).toISOString()}
      </span>}
    </Breadcrumbs >
  );
}

export function TooltipIconButton({ href, children, ...others }: {
  title: string,
  href?: string, color?: string, children: any
}) {
  return <Tooltip
    PopperProps={{
      disablePortal: true,
    }}
    {...others}
  >
    <IconButton {...(href ? { href } : {})} >{children}</IconButton>
  </Tooltip>
}

export function CopyButton({ disabled, isIcon, isLink, get, text, children, ...others }: {
  disabled?: boolean;
  isIcon?: boolean;
  isLink?: boolean;
  children?: any;
  text: string | (() => string);
  [key: string]: any;
  href?: string;
}) {
  const [open, setOpen] = useState(false);

  const onClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  const isDisabled = disabled !== undefined ? disabled : !text;

  const Component: React.FC<Record<string, any>> = isIcon ? IconButton : Button;

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
      <Component disabled={isDisabled} onClick={onCopy}
        {...(isLink && typeof text == "string" ? { href: text } : {})}
        {...others}>
        {children || "Copy"}
      </Component>
    </Tooltip>
  </ClickAwayListener>
}
