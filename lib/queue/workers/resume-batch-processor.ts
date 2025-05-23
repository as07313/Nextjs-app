import fs from 'fs';
import FormData from 'form-data';
import { ResumeProcessingMessage } from '../auto-ranking';
import { Resume } from '../../../models/Resume';
import { Applicant } from '../../../models/Applicant';
import { logInfo, logError } from '../../logger';
import redis from '../../redis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { config } from 'dotenv';
import { Readable } from 'stream';
import { r2Client, R2_BUCKET_NAME } from '../../r2-client'; // Assuming R2 client setup is here
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { streamToBuffer } from '../../utils'; // Assuming streamToBuffer is here

config(); // Load environment variables from .env file

interface ParsedResumeData {
  Name?: string;
  Summary?: string;
  'Contact Information'?: string;
  Education?: any[];
  'Work Experience'?: any[];
  Skills?: string[];
  metadata?: Record<string, any>;
  error?: string; 
}

const PYTHON_PARSER_URL = process.env.PYTHON_PARSER_URL || 'http://localhost:8080/api/parse-resume'; // Use env var


/**
 * Process a batch of resumes concurrently
 */
export async function processBatchOfResumes(batch: ResumeProcessingMessage[]): Promise<void> {
  if (!batch.length) return;
  
  logInfo(`Processing batch of ${batch.length} resumes`);
  
  // Process all resumes in the batch concurrently using Promise.allSettled
  const results = await Promise.allSettled(
    batch.map(message => processResumeInBatch(message))
  );
  
  // Log statistics
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  logInfo(`Batch processing completed: ${successful} succeeded, ${failed} failed`);
}

/**
 * Process a single resume as part of a batch
 */
async function processResumeInBatch(message: ResumeProcessingMessage): Promise<void> {
  const { taskId, resumeId, applicantId, jobId } = message;
  let parsedData: ParsedResumeData | null = null;
  let parsingError: string | null = null;
  let fileBuffer: Buffer | null = null; // To store file content from R2

  try {
    logInfo(`Batch processing resume ${resumeId} for application ${applicantId}`);

    // Update status to processing
    await updateResumeStatus(resumeId, taskId, 'processing', 10);

    // Find the resume to get the R2 key (filePath)
    const resume = await Resume.findById(resumeId).select('filePath fileName'); // Select filePath and fileName

    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    if (!resume.filePath) {
      throw new Error(`Resume ${resumeId} has no file path (R2 key)`);
    }

    // --- Start: Fetch file from R2 ---
    try {
      logInfo(`Fetching resume ${resume.filePath} from R2 bucket ${R2_BUCKET_NAME}`);
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: resume.filePath,
      });
      const { Body } = await r2Client.send(command);

      if (!Body || !(Body instanceof Readable)) {
        throw new Error(`Failed to get readable stream for R2 object: ${resume.filePath}`);
      }
      fileBuffer = await streamToBuffer(Body); // Read stream into buffer
      logInfo(`Successfully fetched resume ${resume.filePath} from R2`);
    } catch (r2Error) {
      logError(`Failed to fetch resume ${resume.filePath} from R2:`, r2Error);
      throw new Error(`Failed to fetch resume from R2: ${resume.filePath}`);
    }
    // --- End: Fetch file from R2 ---

    // --- Start: Call Python Parser ---
    try {
      logInfo(`Calling Python parser for resume ${resumeId} with R2 key: ${resume.filePath}`);
      await updateResumeStatus(resumeId, taskId, 'processing', 20, 'Requesting OpenAI Parsing via Python Service'); // Update progress

      // REMOVED: No longer need to check fileBuffer here for this specific call,
      // as we are sending the R2 key, not the buffer.
      // if (!fileBuffer) {
      //   throw new Error('File buffer is null after fetching from R2');
      // }

      // REMOVED: FormData creation for Python parser
      // const formData = new FormData();
      // formData.append('file', fileBuffer, { filename: resume.fileName });

      // NEW: Prepare JSON payload for the Python parser
      const pythonParserPayload = {
        r2_object_key: resume.filePath, // This is the key for the file in R2
        file_name: resume.fileName     // The original filename
      };

      const parseResponse = await axios.post<ParsedResumeData>(
        PYTHON_PARSER_URL, 
        pythonParserPayload, 
        {
          headers: {
            'Content-Type': 'application/json', // Set content type to JSON
          },
          timeout: 60000, // 60 second timeout for parsing
        }
      );

      if (parseResponse.status === 200) {
          parsedData = parseResponse.data;
          console.log("parsedData from Python service", parsedData);
          logInfo(`Successfully parsed resume ${resumeId} with Python parser.`);
          // Store parsedData immediately
          await Resume.findByIdAndUpdate(resumeId, {
            parsedData: parsedData,
            processingStatus: 'processing', // Or a more specific status like 'parsed_internally'
            lastModified: new Date(),
            // Clear any previous parsingError if this step is successful
            processingError: null 
          });
          await updateResumeStatus(resumeId, taskId, 'processing', 25, 'Internal parsing complete, data stored');
      } else {
          // Attempt to get more detailed error from response if available
          const errorDetail = parseResponse.data?.error || parseResponse.statusText;
          logError(`Python parser returned status ${parseResponse.status}: ${errorDetail}`);
      }
    }
    catch (err: any) {
      // Log more detailed error from axios if available
      if (axios.isAxiosError(err) && err.response) {
        const errorDetail = err.response.data?.detail || err.message;
        parsingError = `Failed to call Python parser (status ${err.response.status}): ${errorDetail}`;
      } else {
        parsingError = `Failed to call Python parser: ${err.message || err}`;
      }
      logError(`Error calling Python parser for ${resumeId}:`, err);
    }


    
    // Update status to uploading
    await updateResumeStatus(resumeId, taskId, 'processing', 30, 'Sending to LlamaCloud');
    
    // Dynamically import fetch to avoid ESM issues
    const { default: fetch } = await import('node-fetch');
    
    // Create form data for LlamaCloud API
    const formDataLlama = new FormData(); // Use a different FormData instance
    if (!fileBuffer) { // Check buffer again
      throw new Error('File buffer is null before sending to LlamaCloud');
    }
    // const fileStream = fs.createReadStream(resume.filePath); // REMOVED: Don't read from local path
    // Use the buffer directly
    formDataLlama.append('files', fileBuffer, { 
      filename: resume.fileName || 'resume.pdf'
    });
    
    // Send to LlamaCloud API with retry mechanism
    let retries = 0;
    let llamaResponse;
    let llamaError = null;
    const LLAMA_API_TIMEOUT = 120000; // 120 seconds timeout for LlamaCloud API

    while (retries < 3) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLAMA_API_TIMEOUT);

      try {
        logInfo(`Attempt ${retries + 1}/3: Sending resume ${resumeId} to LlamaCloud API.`);
        llamaResponse = await fetch(
          'https://hirehub-api-795712866295.europe-west4.run.app/api/upload', 
          {
            method: 'POST',
            body: formDataLlama, 
            headers: formDataLlama.getHeaders(), 
            signal: controller.signal as any, 
          }
        );
        clearTimeout(timeoutId); 
        
        if (llamaResponse.ok) {
          llamaError = null;
          logInfo(`Successfully sent resume ${resumeId} to LlamaCloud API on attempt ${retries + 1}`);
          break;
        }

        const errorText = await llamaResponse.text();
        llamaError = `LlamaCloud API returned status ${llamaResponse.status}: ${errorText}`;
        logError(`${llamaError} (Attempt ${retries + 1}/3 for resume ${resumeId})`);
        
        // Break on non-retryable errors or if it's the last attempt
        if (llamaResponse.status >= 400 && llamaResponse.status < 500) { // Client errors are usually not retryable
            logError(`Non-retryable client error ${llamaResponse.status} from LlamaCloud. Aborting retries for ${resumeId}.`);
            break;
        }
        
      } catch (error: any) {
        clearTimeout(timeoutId); // Clear timeout if request fails
        if (error.name === 'AbortError') {
          llamaError = `LlamaCloud API request timed out after ${LLAMA_API_TIMEOUT / 1000}s.`;
        } else {
          llamaError = `Network error during LlamaCloud API call: ${error.message || error}`;
        }
        logError(`${llamaError} (Attempt ${retries + 1}/3 for resume ${resumeId})`);
      }
      
      retries++;
      if (retries >= 3) {
        logError(`All ${retries} attempts to send resume ${resumeId} to LlamaCloud failed.`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Exponential backoff
    }
    
    if (!llamaResponse || !llamaResponse.ok) {
      logError(`Final LlamaCloud processing failed for ${resumeId}: ${llamaError}`);
      // Use the last captured llamaError
      throw new Error(llamaError || `Failed to process resume ${resumeId} with LlamaCloud after multiple retries.`);
    }
    else {
      logInfo(`LlamaCloud processed resume ${resumeId} successfully after LlamaCloud call.`);
    }
    
    // Update status to parsing
    await updateResumeStatus(resumeId, taskId, 'processing', 60, 'LlamaCloud processing complete');
    
    // Parse response
    //const responseData = await llamaResponse.json(); // Assuming LlamaCloud returns JSON
    logInfo(`LlamaCloud response processed for resume ${resumeId}`);
        
    // Update status to storing
    await updateResumeStatus(resumeId, taskId, 'processing', 80, 'Storing final data');
    
    // Determine final status based on errors

    const finalProcessingStatus = parsingError ? 'error' : 'completed';
    const finalStatus = llamaError ? 'error' : 'completed';
    const combinedError = [parsingError, llamaError].filter(Boolean).join('; ');

    await Resume.findByIdAndUpdate(resumeId, {
      status: finalStatus,
      processingStatus: finalProcessingStatus,
      parsedData: parsedData, 
      processingError: combinedError || undefined, 
      lastModified: new Date()
    });

    // Update applicant only if the overall process didn't have critical errors (adjust as needed)
    if (applicantId !== 'direct-upload') {
      await Applicant.findByIdAndUpdate(applicantId, {
        resumeProcessed: true,
        resumeProcessedAt: new Date()
      });
    }
    
    
    // Update final status
    await updateResumeStatus(resumeId, taskId, 'completed', 100);
    
    logInfo(`Successfully processed resume ${resumeId}`);
    
  } catch (error) {
    logError(`Error processing resume ${resumeId}:`, error);
    
    // Update resume with error status
    try {
      await Resume.findByIdAndUpdate(resumeId, {
        status: 'error',
        processingStatus: 'error',
        lastModified: new Date(),
        processingError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Update status in Redis
      await updateResumeStatus(
        resumeId, 
        taskId, 
        'error', 
        0, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (updateError) {
      logError(`Failed to update resume status:`, updateError);
    }
    
    throw error;
  }
}

/**
 * Update resume processing status in Redis
 */
async function updateResumeStatus(
  resumeId: string, 
  taskId: string, 
  status: string, 
  progress: number, 
  message?: string // Changed 'error' to 'message' for more general use
): Promise<void> {
  try {
    const statusKey = `resume:processing:${resumeId}`;
    
    const statusPayload: any = {
      taskId,
      status,
      progress,
      timestamp: Date.now()
    };

    if (message) {
      if (status === 'error') {
        statusPayload.error = message;
      } else {
        statusPayload.message = message;
      }
    }
    
    // Update status
    await redis.set(
      statusKey,
      JSON.stringify(statusPayload),
      { EX: 24 * 60 * 60 } // 24 hours expiry
    );
  } catch (error) {
    logError(`Failed to update resume status in Redis for ${resumeId}:`, error);
  }
}