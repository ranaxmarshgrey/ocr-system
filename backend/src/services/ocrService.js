import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = (process.env.VERCEL || process.env.NODE_ENV === 'production')
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../../uploads');

const LOGS_DIR = (process.env.VERCEL || process.env.NODE_ENV === 'production')
  ? path.join(os.tmpdir(), 'logs')
  : path.join(__dirname, '../../logs');

const RAW_LOG_PATH = path.join(LOGS_DIR, 'ocr-raw.log');

/* Ensure logs directory exists */
async function ensureLogsDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

/**
 * Log raw OCR response alongside parsed JSON for auditing & model tuning
 */
async function logRawOcrOutput(entry) {
  try {
    await ensureLogsDir();
    const timestamp = new Date().toISOString();
    const logLine = JSON.stringify({ timestamp, ...entry }) + '\n';
    await fs.appendFile(RAW_LOG_PATH, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write OCR raw log:', err.message);
  }
}

/**
 * Define JSON schema for Gemini Vision response
 */
const ocrResponseSchema = {
  type: Type.OBJECT,
  properties: {
    lrNumber: { type: Type.STRING, nullable: true, description: 'Lorry receipt number or LR No.' },
    date: { type: Type.STRING, nullable: true, description: 'Date in YYYY-MM-DD format' },
    consignor: { type: Type.STRING, nullable: true, description: 'Consignor or sender name' },
    consignee: { type: Type.STRING, nullable: true, description: 'Consignee or receiver name' },
    destination: { type: Type.STRING, nullable: true, description: 'Destination city or location' },
    articles: { type: Type.STRING, nullable: true, description: 'Number or count of packages/articles' },
    description: { type: Type.STRING, nullable: true, description: 'Description of goods' },
    invoiceNumber: { type: Type.STRING, nullable: true, description: 'Invoice or bill number' },
    freightType: { type: Type.STRING, enum: ['Paid', 'To Pay'], nullable: true, description: 'Freight status: Paid or To Pay' },
    acknowledgementStatus: { type: Type.STRING, enum: ['Pending', 'Received', 'Later'], nullable: true, description: 'Acknowledgement status' },
    remarks: { type: Type.STRING, nullable: true, description: 'Additional notes or remarks' },
    ocrConfidence: { type: Type.NUMBER, description: 'Overall confidence score from 0 to 100' },
    fieldConfidence: {
      type: Type.OBJECT,
      description: 'Confidence scores (0-100) per field',
      properties: {
        lrNumber: { type: Type.NUMBER },
        date: { type: Type.NUMBER },
        consignor: { type: Type.NUMBER },
        consignee: { type: Type.NUMBER },
        destination: { type: Type.NUMBER },
        articles: { type: Type.NUMBER },
        description: { type: Type.NUMBER },
        invoiceNumber: { type: Type.NUMBER },
        freightType: { type: Type.NUMBER },
      },
    },
  },
  required: ['lrNumber', 'consignor', 'consignee', 'destination', 'ocrConfidence'],
};

const SYSTEM_INSTRUCTION = `You are a high-precision OCR extraction engine for Indian Lorry Receipts (LRs) and transport bills.

Extraction Rules:
1. Extract values strictly visible in the image.
2. Normalize date format to YYYY-MM-DD whenever a valid date is detected.
3. For freightType, return exactly "Paid" or "To Pay" if indicated; otherwise null.
4. For acknowledgementStatus, return "Pending", "Received", or "Later". Default to "Pending" if not specified.
5. Set field values to null if text is illegible, absent, cut off, or unclear.
6. IGNORE printed disclaimers, terms & conditions, company footers, and general non-business boilerplate text.
7. NEVER hallucinate or guess missing digits/letters.
8. Calculate an overall ocrConfidence (0 to 100) reflecting visual clarity and field completeness.
9. Provide per-field confidence scores (0 to 100) in fieldConfidence object.`;

/**
 * Fallback parser for testing or when Gemini API key is unconfigured / rate-limited
 */
function generateFallbackOCRResult(imagePath, remarkText) {
  return {
    extractedData: {
      lrNumber: 'LR-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString().split('T')[0],
      consignor: 'Sample Logistics Pvt Ltd',
      consignee: 'Apex Freight Solutions',
      destination: 'Bengaluru',
      articles: '25 Boxes',
      description: 'Industrial Spare Parts',
      invoiceNumber: 'INV-2026-889',
      freightType: 'Paid',
      acknowledgementStatus: 'Pending',
      remarks: remarkText || 'Extracted via Dev Fallback Engine (GEMINI_API_KEY missing/mock mode)',
    },
    ocrConfidence: 85,
    fieldConfidence: {
      lrNumber: 90,
      date: 90,
      consignor: 80,
      consignee: 80,
      destination: 85,
      articles: 75,
      description: 75,
      invoiceNumber: 80,
      freightType: 90,
    },
    rawOcrOutput: 'Simulated OCR output fallback',
    imagePath,
    isFallback: true,
  };
}

/**
 * Execute OCR extraction using Gemini Vision API
 * @param {string} relativeOrAbsolutePath - Path to the image file
 */
export async function processReceiptOCR(relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath) {
    throw new AppError('Image path is required for OCR processing', 400);
  }

  // Resolve absolute file path
  let absolutePath = relativeOrAbsolutePath;
  if (relativeOrAbsolutePath.startsWith('/uploads/')) {
    absolutePath = path.join(UPLOADS_ROOT, relativeOrAbsolutePath.replace(/^\/uploads\//, ''));
  } else if (relativeOrAbsolutePath.startsWith('uploads/')) {
    absolutePath = path.join(UPLOADS_ROOT, relativeOrAbsolutePath.replace(/^uploads\//, ''));
  } else if (!path.isAbsolute(relativeOrAbsolutePath)) {
    absolutePath = path.join(UPLOADS_ROOT, 'processed', relativeOrAbsolutePath);
  }

  // Check file existence
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError(`Receipt image file not found at path: ${relativeOrAbsolutePath}`, 404);
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Use fallback if API key is not set or set to placeholder
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    console.warn('GEMINI_API_KEY not configured. Returning structured fallback OCR response.');
    const fallback = generateFallbackOCRResult(relativeOrAbsolutePath);
    await logRawOcrOutput({ imagePath: relativeOrAbsolutePath, raw: fallback.rawOcrOutput, parsed: fallback.extractedData, isFallback: true });
    return fallback;
  }

  const imageBuffer = await fs.readFile(absolutePath);
  const base64Data = imageBuffer.toString('base64');
  
  // Determine mime type
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: 'Extract all receipt structured data from this Lorry Receipt image adhering strictly to the system rules and JSON schema.',
              },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ocrResponseSchema,
          temperature: 0.1,
        },
      });

      const rawText = response.text || '';
      let parsed;

      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new AppError('Failed to parse Gemini OCR JSON response', 502);
      }

      const { ocrConfidence = 85, fieldConfidence = {}, ...extractedData } = parsed;

      const result = {
        extractedData,
        ocrConfidence,
        fieldConfidence,
        rawOcrOutput: rawText,
        imagePath: relativeOrAbsolutePath,
        isFallback: false,
      };

      await logRawOcrOutput({
        imagePath: relativeOrAbsolutePath,
        raw: rawText,
        parsed: extractedData,
        confidence: ocrConfidence,
        isFallback: false,
      });

      return result;
    } catch (err) {
      console.warn(`Gemini Vision API call failed with model ${modelName}:`, err.message);

      // If quota is exhausted (429 / RESOURCE_EXHAUSTED), try next model or fallback
      const isQuotaError = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('quota');
      
      if (isQuotaError && modelName === modelsToTry[modelsToTry.length - 1]) {
        console.warn('All Gemini API models exhausted quota. Returning graceful structured fallback response.');
        const fallback = generateFallbackOCRResult(
          relativeOrAbsolutePath,
          'Extracted via Fallback Engine (Gemini API Free Tier Quota Limit Reached — please wait 1 min or upgrade API key)'
        );
        return fallback;
      }

      if (!isQuotaError) {
        if (err instanceof AppError) throw err;
        throw new AppError(`OCR extraction failed: ${err.message}`, 502);
      }
    }
  }
}
