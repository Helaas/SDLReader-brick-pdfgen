// make-pdf.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const OUT_DIR = 'build';
const TMP_DIR = path.join(OUT_DIR, 'tmp');
const FINAL_PDF = path.join(OUT_DIR, 'docs.pdf');

const PAGES = [
  'https://nextui.loveretro.games/docs/',
  'https://nextui.loveretro.games/usage/',
  'https://nextui.loveretro.games/customizing/',
  'https://nextui.loveretro.games/paks/',
  'https://nextui.loveretro.games/shaders/',
  'https://nextui.loveretro.games/support/faq/',
];

// --- Helpers ---
function cleanForToc(rawTitle) {
  // Remove "Next UI Docs" or "NextUI Docs" prefix/suffix with common separators.
  let t = rawTitle
    // Prefix: "Next UI Docs — Foo"
    .replace(/^\s*Next\s*UI\s*Docs\s*[-–—:|]\s*/i, '')
    .replace(/^\s*NextUI\s*Docs\s*[-–—:|]\s*/i, '')
    // Suffix: "Foo — Next UI Docs"
    .replace(/\s*[-–—:|]\s*Next\s*UI\s*Docs\s*$/i, '')
    .replace(/\s*[-–—:|]\s*NextUI\s*Docs\s*$/i, '')
    .trim();
  // Fallback
  return t || rawTitle.trim();
}

const UNIVERSAL_PRINT_CSS = `
  @page { margin: 16mm; }

  /* Force white background instead of site grey */
  html, body {
    background: #ffffff !important;
  }

  /* Collapse site chrome */
  header, nav, aside, footer { display: none !important; }
  main { margin: 0 !important; }

  /* Safer sizing & wrapping */
  *, *::before, *::after { box-sizing: border-box !important; }
  img, svg, video, canvas { max-width: 100% !important; height: auto !important; }

  /* Code blocks often cause overflows */
  pre, code, kbd, samp {
    white-space: pre-wrap !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }

  /* Tables: fixed layout + wrap + slight downsize */
  table {
    width: 100% !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
    font-size: 90% !important;
    background: #ffffff !important; /* strip table bg too */
  }
  th, td {
    white-space: normal !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
    vertical-align: top;
    padding: 6px 8px;
    background: #ffffff !important; /* ensure no shaded cells */
  }

  /* Avoid hidden content in scroll containers when printing */
  .overflow-x-auto, .overflow-auto, .overflow-scroll, .overflow-x-scroll {
    overflow: visible !important;
  }

  /* Exclude YouTube videos */
  iframe[src*="youtube.com"] { display: none !important; }
`;

// --- Playwright printing (no headers/footers) ---
async function printToPdf(page, url, outPath) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  try { await page.emulateMedia({ colorScheme: 'light', media: 'print' }); } catch {}
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: UNIVERSAL_PRINT_CSS });

  await page.pdf({
    path: outPath,
    printBackground: true,
    format: 'A4',
    // No header/footer => clean pages; we'll add global numbering later.
  });

  const title = await page.title();
  return title;
}

// --- Merge PDFs, add TOC and continuous page numbers ---
async function mergeAndEnhance(pdfPaths, sectionTitles, outPath, imagePath) {
  const merged = await PDFDocument.create();

  // Insert image as first page (4:3 aspect ratio)
  const response = await fetch(imagePath);
  const imageBytes = new Uint8Array(await response.arrayBuffer());
  const image = await merged.embedPng(imageBytes);
  const imagePage = merged.insertPage(0, [793.706, 595.28]); // 4:3
  const { width: imgWidth, height: imgHeight } = imagePage.getSize();
  // Set background color
  imagePage.drawRectangle({
    x: 0,
    y: 0,
    width: imgWidth,
    height: imgHeight,
    color: rgb(13 / 255, 17 / 255, 23 / 255),
  });
  const imgDims = image.scaleToFit(imgWidth, imgHeight);
  imagePage.drawImage(image, {
    x: (imgWidth - imgDims.width) / 2,
    y: (imgHeight - imgDims.height) / 2,
    width: imgDims.width,
    height: imgDims.height,
  });

  const sectionStartPages = [];
  let runningPageIndex = 2; // Account for image and TOC pages

  for (let i = 0; i < pdfPaths.length; i++) {
    const bytes = await fs.promises.readFile(pdfPaths[i]);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    sectionStartPages.push(runningPageIndex + 1);
    copied.forEach(p => merged.addPage(p));
    runningPageIndex += copied.length;
  }

  const helv = await merged.embedFont(StandardFonts.Helvetica);
  const helvBold = await merged.embedFont(StandardFonts.HelveticaBold);

  // Insert TOC page after image
  const tocPage = merged.insertPage(1);
  const { width } = tocPage.getSize();

  let y = 780;
  tocPage.drawText('Contents', { x: 50, y, size: 22, font: helvBold });
  y -= 32;

  const adjustedStartPages = sectionStartPages.map(n => n);
  const leftX = 60;
  const dotRightX = width - 60;
  const lineHeight = 20;

  for (let i = 0; i < sectionTitles.length; i++) {
    const title = cleanForToc(sectionTitles[i]);
    const pageNo = adjustedStartPages[i];

    // Title
    tocPage.drawText(title, { x: leftX, y, size: 12, font: helv });

    // Dotted leader
    const textWidth = helv.widthOfTextAtSize(title, 12);
    const dotsStartX = leftX + textWidth + 8;
    const dotsWidth = Math.max(0, dotRightX - dotsStartX - 20);
    const dotW = helv.widthOfTextAtSize('.', 12);
    const dotCount = Math.max(0, Math.floor(dotsWidth / dotW));
    if (dotCount > 0) {
      tocPage.drawText('.'.repeat(dotCount), { x: dotsStartX, y, size: 12, font: helv });
    }

    // Page number (right-ish aligned)
    const pageText = String(pageNo);
    const pageTextWidth = helv.widthOfTextAtSize(pageText, 12);
    tocPage.drawText(pageText, { x: dotRightX - pageTextWidth, y, size: 12, font: helv });

    y -= lineHeight;
    if (y < 80 && i < sectionTitles.length - 1) {
      // Add another TOC page if needed
      y = 780;
      const extra = merged.insertPage(2); // insert after the first TOC page
      extra.drawText('Contents (cont.)', { x: 50, y, size: 18, font: helvBold });
      y -= 28;
    }
  }

  // Continuous page numbers across *all* pages (including TOC)
  const totalPages = merged.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = merged.getPage(i);
    const { width: w } = page.getSize();
    const label = `${i + 1} / ${totalPages}`;
    const labelWidth = helv.widthOfTextAtSize(label, 10);
    page.drawText(label, {
      x: (w - labelWidth) / 2,
      y: 18,
      size: 10,
      font: helv,
      color: rgb(0, 0, 0),
    });
  }

  const outBytes = await merged.save();
  await fs.promises.writeFile(outPath, outBytes);
}

// --- Main ---
async function main() {
  fse.ensureDirSync(TMP_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const pdfPaths = [];
  const sectionTitles = [];

  let i = 0;
  for (const url of PAGES) {
    const u = new URL(url);
    if (u.search && u.search !== '') {
      console.log(`Skipping URL with query: ${url}`);
      continue;
    }
    const outPath = path.join(TMP_DIR, `${String(i++).padStart(2,'0')}.pdf`);
    console.log(`Printing ${url}`);
    const title = await printToPdf(page, url, outPath);
    pdfPaths.push(outPath);
    sectionTitles.push(title);
  }

  await browser.close();

  console.log('Merging and enhancing…');
  const imagePath = 'https://raw.githubusercontent.com/Helaas/SDLReader-brick/main/.github/resources/tg5040%20controls.png';
  await mergeAndEnhance(pdfPaths, sectionTitles, FINAL_PDF, imagePath);
  console.log(`\nDone! -> ${FINAL_PDF}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
