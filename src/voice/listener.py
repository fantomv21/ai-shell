import speech_recognition as sr
import sys

def listen_and_recognize():
    recognizer = sr.Recognizer()
    
    # Adjust for ambient noise and listen via microphone
    try:
        with sr.Microphone() as source:
            print("LISTENING")
            sys.stdout.flush()
            
            # Calibrate for 1 second to background noise
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            
            # Listen to audio
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            
            print("PROCESSING")
            sys.stdout.flush()
            
            # Use Google Speech Recognition (API key is public/free for dev/personal use)
            text = recognizer.recognize_google(audio)
            
            # Print the result with a prefix so Node can find it easily
            print(f"RESULT:{text}")
            
    except sr.WaitTimeoutError:
        print("ERROR:Timeout - No speech detected")
    except sr.UnknownValueError:
        print("ERROR:Could not understand audio")
    except sr.RequestError as e:
        print(f"ERROR:Could not request results; {e}")
    except Exception as e:
        print(f"ERROR:Unexpected error: {str(e)}")

if __name__ == "__main__":
    listen_and_recognize()
