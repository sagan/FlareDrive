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
import FilerobotImageEditor, { TABS, TOOLS, } from 'react-filerobot-image-editor';
import {
  EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE,
  dirname, fileUrl, parseFilePath, str2int
} from '../lib/commons';
import { FileViewerProps, dataUrltoBlob, useConfig } from './commons';
import { putFile } from './app/transfer';

export default function ImageEditorDialog({ filekey, open, close, setError }: FileViewerProps) {
  const { auth, authSearchParams, expires } = useConfig()

  const fileLink = useMemo(() => fileUrl({
    key: filekey,
    auth,
    expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
    scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
    token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
  }), [filekey, auth])

  const { base } = parseFilePath(filekey)

  // filerobot-image-editor popup's z-index is 1300
  // right-bottom drawer icon's z-index: 1050
  return <Dialog open={open} fullScreen sx={{ zIndex: 1060 }}>
    <DialogTitle component={Typography} className='single-line' sx={{ p: 1 }}>
      <IconButton title="Close" color='secondary' onClick={close}><CloseIcon /></IconButton>
      <Link href={fileLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent>
      <Box sx={{ minHeight: "50vh", height: "calc(100vh - 76px)" }}>
        <FilerobotImageEditor
          defaultSavedImageName={base}
          savingPixelRatio={4}
          previewPixelRatio={window.devicePixelRatio}
          source={fileLink}
          onSave={async (x) => {
            if (!x.imageBase64 || !x.fullName) {
              setError("image data or name is empty")
              return
            }
            const dir = dirname(filekey)
            const key = (dir ? dir + "/" : "") + x.fullName
            try {
              await putFile({ key, auth, body: dataUrltoBlob(x.imageBase64), contentType: x.mimeType })
            } catch (e) {
              setError(e)
            }
          }}
          annotationsCommon={{
            fill: '#ff0000',
          }}
          useBackendTranslations={false}
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
