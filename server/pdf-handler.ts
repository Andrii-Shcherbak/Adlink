import { Response } from "express";
import { Url } from "@shared/schema";

export function servePdfDocument(res: Response, url: Url): void {
  console.log(`PDF Document URL: Serving PDF document:`, {
    title: url.title,
    shortCode: url.shortCode,
    pdfDocumentUrl: url.pdfDocumentUrl,
    pdfDocumentName: url.pdfDocumentName,
    pdfDocumentSize: url.pdfDocumentSize
  });
  
  // Serve the PDF viewer page with the document URL
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${url.title || 'PDF Document'}</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }
        .pdf-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 10px;
          background: rgba(255, 255, 255, 0.8);
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }
        .header a {
          text-decoration: none;
          color: #0066cc;
        }
        .header h1 {
          margin: 0;
          font-size: 16px;
        }
        .embed-container {
          position: absolute;
          top: 50px;
          left: 0;
          right: 0;
          bottom: 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${url.pdfDocumentName || 'PDF Document'}</h1>
        <a href="${url.pdfDocumentUrl}" download="${url.pdfDocumentName || 'document.pdf'}">Download</a>
      </div>
      <div class="embed-container">
        <iframe src="${url.pdfDocumentUrl}" class="pdf-container" type="application/pdf"></iframe>
      </div>
    </body>
    </html>
  `);
}