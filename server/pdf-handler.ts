import { Response } from "express";
import { Url } from "@shared/schema";
import { fileStorage } from "./services/file-storage";

export async function servePdfDocument(res: Response, url: Url): Promise<void> {
  // Make sure pdfDocumentUrl is not null
  if (!url.pdfDocumentUrl) {
    res.status(404).send("PDF document URL not found");
    return;
  }

  // Generate a time-limited signed URL for secure access
  const secureUrl = await fileStorage.getSignedDocumentUrl(url.pdfDocumentUrl);
  
  console.log(`PDF Document URL: Serving PDF document:`, {
    title: url.title,
    shortCode: url.shortCode,
    pdfDocumentName: url.pdfDocumentName,
    pdfDocumentSize: url.pdfDocumentSize
  });
  console.log('Signed document URL generated');
  
  // Serve the PDF viewer page with the document URL with SAS token
  // Using PDF.js viewer for more reliable PDF rendering
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
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #fff;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          margin: 0;
          font-size: 20px;
          color: #333;
        }
        .btn {
          display: inline-block;
          background-color: #0066cc;
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          text-decoration: none;
          font-size: 14px;
          transition: background-color 0.3s ease;
        }
        .btn:hover {
          background-color: #0055aa;
        }
        .pdf-box {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .pdf-direct-link {
          display: block;
          margin: 20px 0;
          text-align: center;
        }
        .direct-view-btn {
          background-color: #4CAF50;
        }
        .direct-view-btn:hover {
          background-color: #45a049;
        }
        .pdf-fallback {
          text-align: center;
          padding: 40px 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
          margin-top: 20px;
        }
        .pdf-fallback p {
          margin-bottom: 20px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${url.pdfDocumentName || 'PDF Document'}</h1>
          <a href="${secureUrl}" download="${url.pdfDocumentName || 'document.pdf'}" class="btn">Download PDF</a>
        </div>
        
        <div class="pdf-box">
          <object 
            data="${secureUrl}" 
            type="application/pdf" 
            width="100%" 
            height="600px" 
            id="pdf-object">
            <!-- Fallback if object tag doesn't work -->
            <div class="pdf-fallback">
              <p>Your browser cannot display the PDF directly. Please use one of the options below:</p>
              <a href="${secureUrl}" class="btn direct-view-btn" target="_blank">Open PDF in new tab</a>
              <a href="${secureUrl}" download="${url.pdfDocumentName || 'document.pdf'}" class="btn">Download PDF</a>
            </div>
          </object>
        </div>
        
        <div class="pdf-direct-link">
          <a href="${secureUrl}" class="btn direct-view-btn" target="_blank">Open PDF in new tab</a>
        </div>
      </div>
      
      <script>
        // Check if PDF loads
        const pdfObject = document.getElementById('pdf-object');
        
        pdfObject.onload = function() {
          console.log("PDF object loaded successfully");
        };
        
        pdfObject.onerror = function() {
          console.error("Error loading PDF object");
          showFallback();
        };
        
        // Show fallback if needed
        function showFallback() {
          const fallbackDiv = document.querySelector('.pdf-fallback');
          if (fallbackDiv) {
            fallbackDiv.style.display = 'block';
          }
        }
        
        // Additional check - if after 3 seconds the PDF isn't loaded, show fallback options
        setTimeout(function() {
          try {
            // Check if content loaded
            if (pdfObject.contentDocument && 
                pdfObject.contentDocument.body && 
                pdfObject.contentDocument.body.childNodes.length === 0) {
              showFallback();
            }
          } catch (e) {
            // Cross-origin error is expected and can be ignored
            console.log("Cross-origin check failed, which is normal");
          }
        }, 3000);
      </script>
    </body>
    </html>
  `);
}