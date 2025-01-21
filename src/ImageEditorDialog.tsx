import React, { useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from "@mui/material"
import CloseIcon from '@mui/icons-material/Close';
import FilerobotImageEditor, {
  TABS,
  TOOLS,
  FilerobotImageEditorConfig,
} from 'react-filerobot-image-editor';
import { EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE, fileUrl, str2int } from '../lib/commons';
import { FileViewerProps, useConfig } from './commons';

export default function ImageEditorDialog({ filekey, open, close }: FileViewerProps) {
  const { auth, authSearchParams, expires } = useConfig()

  const fileLink = useMemo(() => fileUrl({
    key: filekey,
    auth,
    expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
    scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
    token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
  }), [filekey, auth])


  return <Dialog open={open} fullWidth maxWidth="xl">
    <DialogTitle component={Typography} className='single-line' sx={{ p: 1 }}>
      <IconButton title="Close" color='secondary' onClick={close}><CloseIcon /></IconButton>
      <Link href={fileLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent>
      <Box sx={{ minHeight: "50vh", height: "calc(100vh - 140px)" }}>
        <FilerobotImageEditor
          savingPixelRatio={4}
          previewPixelRatio={window.devicePixelRatio}
          source={fileLink}
          onBeforeSave={(data) => {
            console.log("before save", data.imageCanvas)
            return true
          }}
          onSave={(x) => {
            console.log("save", x)
          }}
          annotationsCommon={{
            fill: '#ff0000',
          }}
          Text={{ text: 'Text' }}
          Rotate={{ angle: 90, componentType: 'slider' }}
          Crop={{
            presetsItems: [
              {
                titleKey: 'classicTv',
                descriptionKey: '4:3',
                ratio: 4 / 3,
                // icon: CropClassicTv, // optional, CropClassicTv is a React Function component. Possible (React Function component, string or HTML Element)
              },
              {
                titleKey: 'cinemascope',
                descriptionKey: '21:9',
                ratio: 21 / 9,
                // icon: CropCinemaScope, // optional, CropCinemaScope is a React Function component.  Possible (React Function component, string or HTML Element)
              },
            ],
            presetsFolders: [
              {
                titleKey: 'socialMedia', // will be translated into Social Media as backend contains this translation key
                // icon: Social, // optional, Social is a React Function component. Possible (React Function component, string or HTML Element)
                groups: [
                  {
                    titleKey: 'facebook',
                    items: [
                      {
                        titleKey: 'profile',
                        width: 180,
                        height: 180,
                        descriptionKey: 'fbProfileSize',
                      },
                      {
                        titleKey: 'coverPhoto',
                        width: 820,
                        height: 312,
                        descriptionKey: 'fbCoverPhotoSize',
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          tabsIds={[TABS.RESIZE, TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.FINETUNE]}
          defaultTabId={TABS.RESIZE} // or 'Annotate'
          defaultToolId={TOOLS.TEXT} // or 'Text'
        />
      </Box>
    </DialogContent>
  </Dialog >;
}
