import { exec, spawn } from 'child_process';
import ora from 'ora';
import { promisify } from 'util';
import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

/**
 * Transcribe audio file to text using Windows Speech Recognition (PowerShell)
 * This is a FREE, built-in Windows solution
 */
export async function transcribeAudio(audioFilePath: string): Promise<string> {
    try {
        // Check if the file exists
        if (!fs.existsSync(audioFilePath)) {
            throw new Error(`Audio file not found: ${audioFilePath}`);
        }

        console.log(chalk.yellow('🔄 Transcribing audio...'));

        // Try multiple approaches in order of preference

        // Approach 1: Try using Ollama with Whisper model (if available)
        try {
            const text = await transcribeWithOllama(audioFilePath);
            if (text) {
                return text;
            }
        } catch (err) {
            console.log(chalk.gray('Ollama Whisper not available, trying alternative...'));
        }

        // Approach 2: Use basic PowerShell speech recognition
        const text = await transcribeWithPowerShell(audioFilePath);
        return text;

    } catch (error: any) {
        console.error(chalk.red('Transcription error:'), error.message);
        throw error;
    }
}

/**
 * Attempt to use Ollama with Whisper model
 * Note: This requires pulling the whisper model first: ollama pull whisper
 */
async function transcribeWithOllama(audioFilePath: string): Promise<string | null> {
    try {
        // This is a placeholder - Ollama doesn't directly support audio yet
        // But we're preparing for when it does, or using whisper.cpp
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Use Windows built-in Speech Recognition via PowerShell
 * This creates a simple speech recognition using .NET
 */
async function transcribeWithPowerShell(audioFilePath: string): Promise<string> {
    // PowerShell script for speech recognition
    const psScript = `
Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToWaveFile("${audioFilePath.replace(/\\/g, '\\\\')}")

# Load default grammar
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)

try {
  $result = $recognizer.Recognize([TimeSpan]::FromSeconds(10))
  if ($result) {
    Write-Output $result.Text
  } else {
    Write-Output "SPEECH_NOT_RECOGNIZED"
  }
} catch {
  Write-Output "SPEECH_ERROR: $_"
}
`.trim();

    // Save PowerShell script to temp file
    const scriptPath = audioFilePath.replace('.wav', '.ps1');
    fs.writeFileSync(scriptPath, psScript);

    try {
        const { stdout, stderr } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`,
            { timeout: 15000 }
        );

        // Cleanup script file
        fs.unlinkSync(scriptPath);

        const result = stdout.trim();

        if (result.startsWith('SPEECH_ERROR')) {
            throw new Error('Windows Speech Recognition failed');
        }

        if (result === 'SPEECH_NOT_RECOGNIZED' || !result) {
            throw new Error('Could not recognize speech. Please speak clearly.');
        }

        return result;
    } catch (err: any) {
        // Cleanup script file
        try {
            fs.unlinkSync(scriptPath);
        } catch { }

        throw new Error(`Speech recognition failed: ${err.message}`);
    }
}

/**
 * Check if speech recognition is available
 */
export async function checkSpeechAvailability(): Promise<boolean> {
    try {
        const { stdout } = await execAsync(
            'powershell -Command "Add-Type -AssemblyName System.Speech; Write-Output \\"OK\\""',
            { timeout: 5000 }
        );
        return stdout.trim() === 'OK';
    } catch {
        return false;
    }
}

/**
 * Directly listen from microphone using Python's SpeechRecognition library
 * This provides MUCH higher accuracy than Windows SAPI (PowerShell)
 */
export async function listenAndRecognize(): Promise<string> {
    const spinner = ora('Initializing voice engine...').start();

    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'listener.py');
        const pythonProcess = spawn('python', [scriptPath]);

        let result = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();

            if (output.includes('LISTENING')) {
                spinner.text = '🎤 Listening... (Speak now)';
                spinner.color = 'red';
            } else if (output.includes('PROCESSING')) {
                spinner.text = '🧠 Processing speech...';
                spinner.color = 'yellow';
            } else if (output.startsWith('RESULT:')) {
                result = output.replace('RESULT:', '').trim();
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            const err = data.toString();
            // Ignore ALSA/Jack errors on Linux/Windows that are just warnings
            if (!err.includes('ALSA') && !err.includes('jack')) {
                errorOutput += err;
            }
        });

        pythonProcess.on('close', (code) => {
            if (result) {
                spinner.succeed('Voice captured');
                resolve(result);
            } else {
                spinner.fail('Voice recognition failed');
                if (errorOutput.includes('ModuleNotFoundError')) {
                    reject(new Error('Missing python dependencies. Run: pip install SpeechRecognition pyaudio'));
                } else {
                    reject(new Error(errorOutput || 'No speech detected or could not understand.'));
                }
            }
        });

        pythonProcess.on('error', (err) => {
            spinner.fail('Failed to start voice engine');
            reject(err);
        });
    });
}
