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
import ShareDialog from "./ShareDialog";
import { useConfig } from "./commons";

export default function ShareManager({ search, shares, loading, fetchFiles }: {
  search: string;
  shares: string[];
  loading: boolean;
  fetchFiles: () => void
}) {
  const { auth } = useConfig()
  const [shareObject, setShareObject] = useState<ShareObject | null>(null)
  const [shareKey, setShareKey] = useState("")

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
            onClick={async () => {
              const shareKey = share
              const shareObject = await getShare(shareKey, auth)
              setShareObject(shareObject)
              setShareKey(shareKey)
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
    {!!shareObject && <ShareDialog shareKey={shareKey} shareObject={shareObject}
      open={!!shareObject} onClose={() => setShareObject(null)} postDelete={() => {
        fetchFiles();
        setShareObject(null)
      }} />}
  </>
}