# SDLReader-brick-pdfgen

A Node.js script that crawls web pages and generates a consolidated PDF document with custom formatting and an image cover page.

## Features

- **Web Scraping**: Uses Playwright to capture clean PDF versions of web pages
- **Custom Cover Page**: Adds a landscape 4:3 cover page with a background image fetched from GitHub
- **Table of Contents**: Automatically generates a TOC with page references
- **Page Numbering**: Adds continuous page numbers throughout the document
- **Content Filtering**: Excludes YouTube videos and other unwanted elements
- **Clean Output**: Applies CSS to remove site chrome and ensure readable formatting

## Prerequisites

- Node.js 18+ (for fetch API support)
- npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Helaas/SDLReader-brick-pdfgen.git
cd SDLReader-brick-pdfgen
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install
```

## Usage

Run the script to generate the PDF:

```bash
node crawl-to-pdf.mjs
```

The generated PDF will be saved as `build/docs.pdf`.

## Configuration

### Pages to Scrape

Edit the `PAGES` array in `crawl-to-pdf.mjs` to specify which URLs to include:

```javascript
const PAGES = [
  'https://example.com/page1',
  'https://example.com/page2',
  // Add more URLs here
];
```

### Cover Image

The script fetches a cover image from GitHub. To change it, modify the `imagePath` in the `main()` function:

```javascript
const imagePath = 'https://raw.githubusercontent.com/your-repo/main/path/to/image.png';
```

### Page Settings

- **Cover Page**: 4:3 aspect ratio landscape
- **Content Pages**: A4 portrait
- **Background Color**: Dark theme (#0d1117) for cover page
- **Margins**: 16mm for content pages

## Output Structure

```
build/
├── docs.pdf          # Final merged PDF
└── tmp/              # Temporary individual page PDFs
    ├── 00.pdf
    ├── 01.pdf
    └── ...
```

## Dependencies

- **playwright**: For browser automation and PDF generation
- **pdf-lib**: For PDF manipulation and merging
- **fs-extra**: For file system operations

## Customization

### CSS Styling

Modify the `UNIVERSAL_PRINT_CSS` constant to adjust how pages are rendered:

- Hide additional elements
- Adjust fonts and colors
- Modify layout

### PDF Options

In the `printToPdf` function, you can adjust:

- Page format (currently A4)
- Print background (currently enabled)
- Other PDF options

## Troubleshooting

- **Playwright Installation**: Run `npx playwright install` if you encounter browser-related errors
- **Network Issues**: Ensure stable internet connection for fetching the cover image
- **Memory Usage**: Large numbers of pages may require more RAM

## License

ISC License - see LICENSE file for details.
