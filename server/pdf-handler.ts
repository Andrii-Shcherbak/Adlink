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
  
  // Serve the PDF viewer page with Mozilla's PDF.js (industry standard)
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          overflow: hidden;
          background-color: #f8f9fa;
          color: #333;
        }
        
        .app-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background-color: #2c2c3d;
          color: white;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          transition: top 0.3s;
        }
        
        .app-header.hidden {
          top: -60px;
        }
        
        .app-title {
          font-size: 18px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        
        .app-actions {
          display: flex;
          gap: 10px;
        }
        
        .button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        
        .primary-button {
          background-color: #4c6ef5;
          color: white;
        }
        
        .primary-button:hover {
          background-color: #3a59d0;
        }
        
        .secondary-button {
          background-color: #636879;
          color: white;
        }
        
        .secondary-button:hover {
          background-color: #505464;
        }
        
        #viewerContainer {
          position: absolute;
          top: 60px;
          bottom: 0;
          left: 0;
          right: 0;
        }
        
        #viewer { 
          height: 100%;
          width: 100%;
          border: none;
        }
        
        .loader {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(76, 110, 245, 0.2);
          border-radius: 50%;
          border-top-color: #4c6ef5;
          animation: spin 1s ease-in-out infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .fallback {
          display: none;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.15);
          text-align: center;
          max-width: 90%;
          width: 400px;
        }
        
        .fallback-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #2c2c3d;
        }
        
        .fallback-message {
          margin-bottom: 20px;
          color: #636879;
          line-height: 1.5;
        }
        
        .fallback-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        @media (max-width: 768px) {
          .app-header {
            padding: 0 10px;
          }
          
          .app-title {
            font-size: 16px;
            max-width: 50%;
          }
          
          .button {
            padding: 6px 12px;
            font-size: 13px;
          }
        }
      </style>
    </head>
    <body>
      <header class="app-header" id="appHeader">
        <div class="app-title">${url.pdfDocumentName || 'PDF Document'}</div>
        <div class="app-actions">
          <a href="${secureUrl}" download="${url.pdfDocumentName || 'document.pdf'}" class="button secondary-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </a>
        </div>
      </header>
      
      <div id="viewerContainer">
        <div class="loader" id="loader">
          <div class="spinner"></div>
          <div>Loading PDF...</div>
        </div>
        <div id="viewerWrapper"></div>
      </div>
      
      <div class="fallback" id="fallback">
        <div class="fallback-title">Unable to Display PDF</div>
        <div class="fallback-message">
          The PDF viewer couldn't load this document. You can still download it or open it in a new tab.
        </div>
        <div class="fallback-actions">
          <a href="${secureUrl}" target="_blank" class="button primary-button">Open in New Tab</a>
          <a href="${secureUrl}" download="${url.pdfDocumentName || 'document.pdf'}" class="button secondary-button">Download PDF</a>
        </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.min.js"></script>
      <script>
        // Set workerSrc property to pdf.worker.min.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.worker.min.js';
        
        // The PDF URL
        const pdfUrl = "${secureUrl}";
        const container = document.getElementById('viewerWrapper');
        const loader = document.getElementById('loader');
        const fallback = document.getElementById('fallback');
        
        // Auto-hide header after 3 seconds
        let headerTimeout;
        const appHeader = document.getElementById('appHeader');
        
        function resetHeaderTimeout() {
          clearTimeout(headerTimeout);
          appHeader.classList.remove('hidden');
          
          headerTimeout = setTimeout(() => {
            appHeader.classList.add('hidden');
          }, 3000);
        }
        
        document.addEventListener('mousemove', resetHeaderTimeout);
        resetHeaderTimeout();
        
        // Load the PDF document
        async function loadPDF() {
          try {
            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            
            // Show loading progress
            loadingTask.onProgress = (progressData) => {
              if (progressData.total > 0) {
                const progress = Math.round((progressData.loaded / progressData.total) * 100);
                loader.textContent = \`Loading PDF... \${progress}%\`;
              }
            };
            
            const pdf = await loadingTask.promise;
            
            // Create PDF viewer element
            const viewerElement = document.createElement('div');
            viewerElement.id = 'viewer';
            viewerElement.style.height = '100%';
            viewerElement.style.overflow = 'auto';
            container.appendChild(viewerElement);
            
            // Keep track of rendered pages
            const renderedPages = new Set();
            const pageElements = {};
            
            // Create placeholder for each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const pageContainer = document.createElement('div');
              pageContainer.className = 'page-container';
              pageContainer.style.position = 'relative';
              pageContainer.style.margin = '10px auto';
              pageContainer.style.maxWidth = '1000px';
              pageContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
              pageContainer.style.background = 'white';
              
              // Create placeholder element
              const placeholder = document.createElement('div');
              placeholder.style.width = '100%';
              placeholder.style.height = '1400px';
              placeholder.dataset.pageNumber = pageNum;
              pageContainer.appendChild(placeholder);
              
              // Create page number badge
              const pageNumBadge = document.createElement('div');
              pageNumBadge.textContent = pageNum;
              pageNumBadge.style.position = 'absolute';
              pageNumBadge.style.bottom = '10px';
              pageNumBadge.style.right = '10px';
              pageNumBadge.style.background = 'rgba(0,0,0,0.6)';
              pageNumBadge.style.color = 'white';
              pageNumBadge.style.padding = '4px 8px';
              pageNumBadge.style.borderRadius = '4px';
              pageNumBadge.style.fontSize = '12px';
              pageContainer.appendChild(pageNumBadge);
              
              viewerElement.appendChild(pageContainer);
              pageElements[pageNum] = {
                container: pageContainer,
                placeholder: placeholder
              };
            }
            
            // Hide loader once all placeholders are created
            loader.style.display = 'none';
            
            // Set up intersection observer to load pages when they become visible
            const observer = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
                  if (!renderedPages.has(pageNum)) {
                    renderPage(pageNum);
                    renderedPages.add(pageNum);
                  }
                }
              });
            }, {
              rootMargin: '200px 0px' // Load pages a bit before they come into view
            });
            
            // Observe each page placeholder
            Object.values(pageElements).forEach(({placeholder}) => {
              observer.observe(placeholder);
            });
            
            async function renderPage(pageNum) {
              try {
                const page = await pdf.getPage(pageNum);
                const scale = 1.5;
                const viewport = page.getViewport({scale});
                
                // Create canvas element
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.display = 'block';
                
                // Update placeholder dimensions to match the page
                const pageElement = pageElements[pageNum];
                pageElement.placeholder.style.height = \`\${viewport.height}px\`;
                pageElement.container.style.width = \`\${viewport.width}px\`;
                
                // Replace placeholder with canvas
                pageElement.placeholder.replaceWith(canvas);
                pageElement.canvas = canvas;
                
                // Render the page content
                const renderContext = {
                  canvasContext: context,
                  viewport: viewport
                };
                
                await page.render(renderContext).promise;
              } catch (err) {
                console.error(\`Error rendering page \${pageNum}: \${err}\`);
              }
            }
            
            // Render the first couple of pages immediately
            for (let i = 1; i <= Math.min(2, pdf.numPages); i++) {
              renderPage(i);
              renderedPages.add(i);
            }
            
          } catch (error) {
            console.error('Error loading PDF:', error);
            loader.style.display = 'none';
            fallback.style.display = 'block';
          }
        }
        
        loadPDF();
      </script>
    </body>
    </html>
  `);
}