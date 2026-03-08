from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allows our frontend to communicate with this backend

@app.route('/api/chat', methods=['POST'])
def chat_operator():
    # 1. Receive data from the frontend
    data = request.json
    user_message = data.get("message", "").lower()

    # 2. Process the message (Replace this logic with an actual AI API later)
    if not user_message:
        bot_response = "I didn't catch that. Could you repeat?"
    elif "hello" in user_message or "hi" in user_message:
        bot_response = "Hello there! How can I assist you today?"
    elif "time" in user_message:
        bot_response = "I don't have a watch, but I'm always ready to help!"
    else:
        bot_response = f"I received your message: '{user_message}'. I am a backend operator!"

    # 3. Send response back to frontend
    return jsonify({"response": bot_response})

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(debug=True, port=5000)