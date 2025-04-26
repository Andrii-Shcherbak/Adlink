import { Response } from "express";
import { Url } from "@shared/schema";
import { azureStorageService } from "./services/azure-storage-service";

export function servePdfDocument(res: Response, url: Url): void {
  // Make sure pdfDocumentUrl is not null
  if (!url.pdfDocumentUrl) {
    res.status(404).send("PDF document URL not found");
    return;
  }

  // Generate SAS token for secure access
  const secureUrl = azureStorageService.getBlobUrlWithSAS(url.pdfDocumentUrl);
  
  console.log(`PDF Document URL: Serving PDF document:`, {
    title: url.title,
    shortCode: url.shortCode,
    pdfDocumentName: url.pdfDocumentName,
    pdfDocumentSize: url.pdfDocumentSize
  });
  console.log('Secure URL with SAS token generated');
  
  // Serve the PDF viewer page with the document URL with SAS token
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
        .error-message {
          text-align: center;
          margin-top: 100px;
          color: #d32f2f;
          font-size: 18px;
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${url.pdfDocumentName || 'PDF Document'}</h1>
        <a href="${secureUrl}" download="${url.pdfDocumentName || 'document.pdf'}">Download</a>
      </div>
      <div class="embed-container">
        <iframe src="${secureUrl}" class="pdf-container" type="application/pdf"></iframe>
        <div id="error-message" class="error-message">
          There was an error loading the PDF document. Please try downloading it instead.
        </div>
      </div>
      
      <script>
        // Add error handling for the iframe
        const iframe = document.querySelector('iframe');
        const errorMessage = document.getElementById('error-message');
        
        iframe.onerror = function() {
          iframe.style.display = 'none';
          errorMessage.style.display = 'block';
        };
        
        // Also check if iframe fails to load
        iframe.onload = function() {
          // Check if we can access the iframe content
          try {
            // If we can't access iframe content, it might have failed to load
            if (iframe.contentDocument === null || iframe.contentWindow === null) {
              iframe.style.display = 'none';
              errorMessage.style.display = 'block';
            }
          } catch (e) {
            // If we get security error, it's fine - iframe loaded but same-origin policy blocks access
          }
        };
      </script>
    </body>
    </html>
  `);
}