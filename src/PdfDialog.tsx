import React, { useMemo, useState } from 'react';
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
import { Document, Page } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE, fileUrl, str2int } from '../lib/commons';
import { FileViewerProps, useConfig } from './commons';

export default function PdfDialog({ filekey, open, close }: FileViewerProps) {
  const { auth, authSearchParams, expires } = useConfig()
  const fileLink = useMemo(() => fileUrl({
    key: filekey,
    auth,
    expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
    scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
    token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
  }), [filekey, auth])
  const [numPages, setNumPages] = useState<number>();

  function onDocumentLoadSuccess({ numPages: nextNumPages }: PDFDocumentProxy): void {
    setNumPages(nextNumPages);
  }

  return <Dialog open={open} onClose={close} fullWidth maxWidth="xl">
    <DialogTitle component={Typography} className='single-line' sx={{ p: 1 }}>
      <IconButton title="Close" color='secondary' onClick={close}><CloseIcon /></IconButton>
      <Link href={fileLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent>
      {/*
      Dialog max-height: calc(100vh - 64px)
      DialogTitle height: 40px + 16px (padding-top + padding-bottom ) = 56px
      DialogContent padding-bottom: 20px
      */}
      <Box sx={{ minHeight: "50vh", height: "calc(100vh - 140px)" }}>
        <Document file={fileLink} onLoadSuccess={onDocumentLoadSuccess} >
          {Array.from(new Array(numPages), (_el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
            />
          ))}
        </Document>
      </Box>
    </DialogContent>
  </Dialog >;
}
