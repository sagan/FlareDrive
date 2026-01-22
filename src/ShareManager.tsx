import {
  CircularProgress,
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import React, { useState, useMemo } from 'react';
import ShareIcon from '@mui/icons-material/Share';
import { ShareObject } from "../lib/commons";
import { Centered } from "./components";
import { getShare } from "./app/share";
import { useConfig } from "./commons";
import ShareDialog from "./ShareDialog";

export default function ShareManager({ search, shares, loading, shareObject, setShareObject, fetchFiles, setError }: {
  search: string;
  shares: string[];
  loading: boolean;
  shareObject: ShareObject | null;
  setShareObject: React.Dispatch<React.SetStateAction<ShareObject | null>>;
  fetchFiles: () => void;
  setError: React.Dispatch<React.SetStateAction<unknown>>;
}) {
  const { auth } = useConfig();
  const [shareKey, setShareKey] = useState("");

  const filteredShares = useMemo(
    () =>
      (search ? shares.filter((share) => share.toLowerCase().includes(search.toLowerCase())) : shares),
    [shares, search]
  );

  return <>{loading || filteredShares.length == 0 ? (
    <Centered>
      {loading ? <CircularProgress /> : "No shared files"}
    </Centered>
  ) : (
    <Grid container sx={{ paddingBottom: "48px" }}>
      {filteredShares.map((share) => {
        return <Grid item key={share} xs={12} sm={6} md={4} lg={3} xl={2}>
          <ListItemButton
            onClick={() => {
              const shareKey = share;
              getShare(shareKey, auth).then(shareObject => {
                setShareObject(shareObject)
                setShareKey(shareKey)
              }).catch(e => { });
            }}
            sx={{ userSelect: "none" }}
          >
            <ListItemIcon>
              <ShareIcon />
            </ListItemIcon>
            <ListItemText
              primary={share}
              primaryTypographyProps={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            />
          </ListItemButton>
        </Grid>
      })}
    </Grid>
  )}
    {!!shareObject && <ShareDialog shareKey={shareKey} shareObject={shareObject} setError={setError}
      open={!!shareObject} onClose={() => setShareObject(null)} postDelete={() => {
        fetchFiles();
        setShareObject(null)
      }} />}
  </>
}