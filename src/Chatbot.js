import React, { useState, useEffect } from 'react';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from './aws-config';
import './Chatbot.css';

function Chatbot() {
  // Load initial state from localStorage or use defaults
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatbot-messages');
    return saved ? JSON.parse(saved) : [
      { text: "Hi! I'm your SRJC Pathways assistant. How can I help you today? TYPE 'explore careers' to start our questionnaire and help me choose the pathway and career that's best for you", sender: 'bot'}
    ];
  });
  const [input, setInput] = useState('');

  //change this to pull from s3
  const questions = [
    "I enjoy building or fixing things with my hands (like cabinets or appliances). What do you think about that?",
    "I like creating beautiful things, like paintings, music, or designs for movies. Does that sound like you?",
    "I'm curious about science and like doing experiments or learning how things work. How about you?",
    "I want to help protect the planet and find ways to reduce pollution. What are your thoughts?"
  ];
  
  const [conversationHistory, setConversationHistory] = useState(() => {
    const saved = localStorage.getItem('chatbot-conversation-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem('chatbot-question-index');
    return saved ? parseInt(saved) : 0;
  });
  const [isGuidedMode, setIsGuidedMode] = useState(() => {
    const saved = localStorage.getItem('chatbot-guided-mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('chatbot-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('chatbot-conversation-history', JSON.stringify(conversationHistory));
  }, [conversationHistory]);

  useEffect(() => {
    localStorage.setItem('chatbot-question-index', currentQuestionIndex.toString());
  }, [currentQuestionIndex]);

  useEffect(() => {
    localStorage.setItem('chatbot-guided-mode', JSON.stringify(isGuidedMode));
  }, [isGuidedMode]);

  const sendMessage = async () => {
    if (!input.trim()) return;
  
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
  
    if (!isGuidedMode && userInput.toLowerCase().includes("explore careers")) {
      // Trigger guided flow
      setIsGuidedMode(true);
      const firstQuestion = questions[0];
      setCurrentQuestionIndex(0);
      setMessages(prev => [...prev, { text: firstQuestion, sender: 'bot' }]);
      return;
    }
  
    try {
      let prompt;
  
      if (isGuidedMode) {
        // In guided mode: collect history + build prompt with context
        const updatedHistory = [
          ...conversationHistory,
          {
            question: questions[currentQuestionIndex],
            answer: userInput
          }
        ];
        setConversationHistory(updatedHistory);
  
        const nextIndex = currentQuestionIndex + 1;
        const nextQuestion = questions[nextIndex];
  
        setCurrentQuestionIndex(nextIndex);
  
        prompt = `You are a friendly career discovery assistant. You're guiding a student through career interest questions. After each answer, respond conversationally and warmly, then ask the next question from this list if one exists. Keep your tone supportive and brief.\n\nHere is the conversation so far:\n`;
  
        updatedHistory.forEach((item, i) => {
          prompt += `Q${i + 1}: ${item.question}\nUser: ${item.answer}\n`;
        });
  
        if (nextQuestion) {
          prompt += `Now respond to the user's last answer, then ask: "${nextQuestion}"`;
        } else {
          prompt += `Now respond to the user's last answer and wrap up the conversation. Suggest they explore programs at SRJC based on their interests.`;
          setIsGuidedMode(false); // End guided mode
        }
      } else {
        // Default (non-guided) use
        prompt = `You are a helpful assistant for Santa Rosa Junior College (SRJC) pathways. Help students with academic programs, career paths, and transfer planning. Keep responses concise and helpful.\n\nStudent question: ${userInput}\n\nResponse:`;
      }
  
      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });
  
      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const botText = responseBody.content[0].text;
  
      const botResponse = { text: botText, sender: 'bot' };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Bedrock error:', error);
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
        <button 
          onClick={() => {
            localStorage.removeItem('chatbot-messages');
            localStorage.removeItem('chatbot-conversation-history');
            localStorage.removeItem('chatbot-question-index');
            localStorage.removeItem('chatbot-guided-mode');
            setMessages([{ text: "Hi! I'm your SRJC Pathways assistant. How can I help you today? TYPE 'explore careers' to start our questionnaire and help me choose the pathway and career that's best for you", sender: 'bot' }]);
            setConversationHistory([]);
            setCurrentQuestionIndex(0);
            setIsGuidedMode(false);
          }}
          className="clear-button"
        >
          Clear Chat
        </button>
      </div>
    </div>
  );
}

export default Chatbot;