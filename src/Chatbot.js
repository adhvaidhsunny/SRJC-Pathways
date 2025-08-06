import React, { useState } from 'react';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from './aws-config';
import './Chatbot.css';

function Chatbot() {
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your SRJC Pathways assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');

    try {
      const prompt = `You are a helpful assistant for Santa Rosa Junior College (SRJC) pathways. Help students with academic programs, career paths, and transfer planning. Keep responses concise and helpful.\n\nStudent question: ${userInput}\n\nResponse:`;
      
      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: prompt
          }]
        })
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const botText = responseBody.content[0].text;

      const botResponse = { text: botText, sender: 'bot' };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Bedrock error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode
      });
      const errorResponse = { 
        text: `Connection error: ${error.message || 'Unknown error'}. Check console for details.`, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorResponse]);
    }
  };

  return (
    <div className="chatbot-container">
      <header className="chatbot-header">
        <h1>SRJC Pathways Assistant</h1>
        <p>Ask me about programs, careers, and transfer options</p>
      </header>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about SRJC programs..."
          className="chat-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
    </div>
  );
}

export default Chatbot;