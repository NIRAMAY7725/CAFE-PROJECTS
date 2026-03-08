import speech_recognition as sr
import webbrowser
import pyttsx3
import os
import wikipedia
from GoogleNews import GoogleNews
from openai import OpenAI

# --- 1. CONFIGURATION ---

client = OpenAI(
       api_key="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"

)


engine = pyttsx3.init()
engine.setProperty('rate', 170) 
engine.setProperty('volume', 1.0)
# Set voice 
voices = engine.getProperty('voices')
if len(voices) > 1:
    engine.setProperty('voice', voices[0].id)

# Initialize Google News (English, 1 Day period)
googlenews = GoogleNews(lang='en', period='1d')

# Conversation History 
chat_history = [
    {"role": "system", "content": "You are Techno, a helpful AI assistant. Keep answers concise."}
]

# Music Collection
music_library = {
    "pop": "https://youtu.be/Bf2ml3oE2JA?si=F4DWpUkzk4J1-sV1",
    "next": "https://youtu.be/KgayxOF4Y7E?si=kV71wh6lQvis47EX",
    "song": "https://youtu.be/YJpeJwHsvI8?si=KxcoPO1XSp_TTwf_",
    "lOG" : "https://youtu.be/8mtxEbvzkHs?si=V1W1OZ8sujlQlh80",
    "wIN" : "https://youtu.be/8mtxEbvzkHs?si=tMTlgQVJvs3iKd-E"
}

# --- 2. CORE FUNCTIONS ---

def speak(text):
    """Speaks the text and prints it to the console."""
    print(f"Techno: {text}")
    engine.say(text)
    engine.runAndWait()

def take_command():
    """Listens to the microphone and returns text."""
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("\nListening...")
        r.adjust_for_ambient_noise(source, duration=0.5)
        try:
            # Increased timeout slightly for better listening
            audio = r.listen(source, timeout=5, phrase_time_limit=8)
            print("Recognizing...")
            query = r.recognize_google(audio, language='en-in').lower()
            print(f"User said: {query}")
            return query
        except Exception:
            return "None"

def ask_chatgpt(query):
    """Sends the query to OpenAI and returns the response."""
    try:
        chat_history.append({"role": "user", "content": query})
        
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=chat_history
        )
        
        response = completion.choices[0].message.content
        chat_history.append({"role": "assistant", "content": response})
        return response
    except Exception as e:
        print(f"OpenAI Error: {e}")
        return "I am having trouble connecting to my brain right now."

def play_music(command):
    """Handles music playing logic."""
    song_name = command.replace("play", "").strip()

    if not song_name:
        speak("What song would you like me to play?")
        return

    if song_name in music_library:
        speak(f"Playing {song_name} from your collection.")
        webbrowser.open(music_library[song_name])
    else:
        speak(f"Playing {song_name} on YouTube.")
        # Fixed the URL structure for general search
        search_url = f"https://www.youtube.com/results?search_query={song_name}"
        webbrowser.open(search_url)

def get_wikipedia_info(query):
    """Searches Wikipedia for a summary."""
    speak("Searching Wikipedia...")
    query = query.replace("wikipedia", "").replace("search", "").strip()
    try:
        results = wikipedia.summary(query, sentences=2)
        speak(f"According to Wikipedia: {results}")
    except Exception:
        speak("I couldn't find that topic on Wikipedia.")

def get_latest_news():
    """Fetches top news headlines."""
    speak("Fetching the latest news...")
    try:
        googlenews.clear()
        googlenews.get_news()
        result = googlenews.result()
        
        # Read top 3 headlines
        for i in range(min(3, len(result))):
            speak(f"Headline {i+1}: {result[i]['title']}")
        speak("That's the latest news.")
    except Exception:
        speak("I am unable to access the news right now.")

# --- 3. MAIN EXECUTION FLOW ---

if __name__ == '__main__':
    print("--- TECHNO CAFE ASSISTANT ONLINE ---")
    speak("Hello, I am Techno. How can I help?")

    while True:
        query = take_command()
        
        if query == "None":
            continue 

        # --- COMMANDS ---

        # 1. Exit
        if "exit" in query or "quit" in query or "bye" in query:
            speak("Goodbye! Have a nice day.")
            break 

        # 2. Cafe / Website Commands
        elif "menu" in query:
            speak("Opening the menu.")
            webbrowser.open("menu.html") 

        elif "contact" in query:
            speak("Opening contact page.")
            webbrowser.open("contect.html")

        elif "home" in query:
            speak("Going to home page.")
            webbrowser.open("index.html")
        
        elif "log" in query or "sign in" in query:
            speak("Opening login page.")
            webbrowser.open("sign-in.html")
            
        elif "open google" in query:
            speak("Opening Google.")
            webbrowser.open("google.com")

        elif "open youtube" in query:
            speak("Opening YouTube.")
            webbrowser.open("youtube.com")

        # 3. Features
        elif "play" in query:
            play_music(query)

        elif "wikipedia" in query:
            get_wikipedia_info(query)

        elif "news" in query or "headlines" in query:
            get_latest_news()

        # 4. Fallback: Ask ChatGPT
        else:
            response = ask_chatgpt(query)
            speak(response)